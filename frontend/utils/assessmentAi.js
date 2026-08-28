import { getAuthSession } from "./authUser";
import { resolvePromptGenerationSettings } from "./promptPreferences";

import { API_BASE, isLocalApiBase } from "./apiBase.js";

const AI_REQUEST_TIMEOUT_MS = 600000;
/** Keep each hosted API round small so Vercel's 60s limit is not exceeded. */
const PROMPT_CLIENT_ROUND_SIZE = 8;
const DOCUMENT_CLIENT_ROUND_SIZE = 8;

function backendUnreachableMessage() {
  if (isLocalApiBase()) {
    return `Cannot reach the backend at ${API_BASE}. On a local APK, start the backend (npm start in backend/), keep the phone on the same Wi‑Fi, and rebuild. For public users, deploy to Vercel and build with npm run cap:apk:prod.`;
  }
  return `Cannot reach the backend at ${API_BASE}. Check that the API is online (Vercel /api/health), then try again.`;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = AI_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const externalSignal = options.signal;

  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      const error = new Error("Generation cancelled.");
      error.name = "AbortError";
      throw error;
    }
    externalSignal.addEventListener("abort", onExternalAbort, { once: true });
  }

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      if (externalSignal?.aborted) {
        const cancelled = new Error("Generation cancelled.");
        cancelled.name = "AbortError";
        throw cancelled;
      }
      throw new Error(
        "The request took too long. Check your internet connection and try again."
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", onExternalAbort);
    }
  }
}

async function getAuthHeaders(json = true, { forceRefresh = false } = {}) {
  let session = await getAuthSession({ forceRefresh });

  if (!session?.access_token) {
    throw new Error("Your session expired. Please sign in again.");
  }

  const headers = {
    Authorization: `Bearer ${session.access_token}`,
  };

  if (json) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

async function fetchAuthedWithRetry(url, options = {}, timeoutMs = AI_REQUEST_TIMEOUT_MS) {
  let res = await fetchWithTimeout(url, options, timeoutMs);

  if (res.status !== 401) {
    return res;
  }

  const refreshedHeaders = await getAuthHeaders(!(options.body instanceof FormData), {
    forceRefresh: true,
  });

  const retryOptions = {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...refreshedHeaders,
    },
  };

  res = await fetchWithTimeout(url, retryOptions, timeoutMs);

  if (res.status === 401) {
    throw new Error("Your session expired. Please sign out and sign in again.");
  }

  return res;
}

function formatApiError(payload, fallback) {
  const message = payload?.error;
  if (typeof message === "string" && message.trim()) {
    return message.trim();
  }
  return fallback || "AI request failed";
}

function isBackendUnreachable(error) {
  const message = String(error?.message || "");
  return (
    message.includes("Failed to fetch") ||
    message.includes("NetworkError") ||
    message.includes("fetch")
  );
}

function emitQuestionReady({ onQuestionGenerated, question, step, total, phase, payload }) {
  if (!question || !onQuestionGenerated) return;

  onQuestionGenerated({
    question,
    index: step,
    total,
    phase,
    suggestedTitle: payload?.suggestedTitle,
    suggestedDescription: payload?.suggestedDescription,
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startWaitingProgress({ onProgress, phase, total, floorPercent = 3 }) {
  let percent = Math.max(3, Number(floorPercent) || 3);
  const cap = 72;
  let highest = percent;
  onProgress?.({
    phase,
    current: 0,
    total,
    percent: highest,
    status: "waiting",
  });

  const timer = setInterval(() => {
    // Slow crawl only — never jump backward; stay below revealing range.
    percent = Math.min(cap, percent + 0.6);
    highest = Math.max(highest, Math.round(percent));
    onProgress?.({
      phase,
      current: 0,
      total,
      percent: highest,
      status: "waiting",
    });
  }, 500);

  return () => clearInterval(timer);
}

function appendFilesToFormData(formData, files) {
  const list = Array.isArray(files) ? files.filter(Boolean) : files ? [files] : [];
  if (!list.length) {
    throw new Error("Choose a PDF, Word (.docx), or PowerPoint (.pptx) file to upload.");
  }
  for (const file of list) {
    formData.append("files", file);
  }
  // Legacy single-file field only when exactly one upload (avoids duplicating file #1).
  if (list.length === 1) {
    formData.append("file", list[0]);
  }
  return list;
}

async function revealQuestionsIncrementally({
  questions,
  onProgress,
  onQuestionGenerated,
  phase,
  payload,
}) {
  const total = questions.length;
  const revealStart = 78;

  for (let step = 0; step < total; step += 1) {
    const current = step + 1;
    const percent =
      total === 0
        ? 100
        : Math.round(revealStart + (current / total) * (100 - revealStart));

    onProgress?.({
      phase,
      current,
      total,
      percent,
      status: "revealing",
    });

    emitQuestionReady({
      onQuestionGenerated,
      question: questions[step],
      step,
      total,
      phase,
      payload,
    });

    if (step < total - 1) {
      await sleep(55);
    }
  }

  onProgress?.({
    phase,
    current: total,
    total,
    percent: Math.min(99, Math.round(revealStart + (100 - revealStart))),
    status: "revealing",
  });
}

function mapStatusPayload(payload) {
  return {
    configured: Boolean(payload.configured),
    provider: payload.provider || "gemini",
    model: payload.model || payload.documentModel || null,
    promptProvider: payload.promptProvider || "gemini",
    documentProvider: payload.documentProvider || "gemini",
    promptModel: payload.promptModel || payload.model || null,
    documentModel: payload.documentModel || payload.model || null,
    gemini: payload.gemini || null,
    error: payload.error || null,
  };
}

export async function fetchAssessmentAiStatus() {
  try {
    const res = await fetch(`${API_BASE}/assessment-ai/public-config`);
    const payload = await res.json().catch(() => ({}));
    const status = mapStatusPayload(payload);

    if (!status.configured) {
      return {
        ...status,
        error:
          status.error ||
          "AI is not ready. Add GEMINI_API_KEY (documents) and GROQ_API_KEY (prompts) to backend/.env, then restart the backend.",
      };
    }

    let session = null;
    try {
      session = await getAuthSession();
    } catch {
      session = null;
    }

    if (!session?.access_token) {
      return {
        ...status,
        error: "Sign in as faculty to generate questions.",
      };
    }

    return {
      ...status,
      error: null,
    };
  } catch (error) {
    return {
      configured: false,
      error: isBackendUnreachable(error)
        ? backendUnreachableMessage()
        : error.message,
    };
  }
}

export async function generateAssessmentFromPrompt({
  prompt,
  formats,
  questionCount,
  difficulty,
  onProgress,
  onQuestionGenerated,
  signal,
}) {
  const trimmed = String(prompt || "").trim();
  const resolved = resolvePromptGenerationSettings({
    prompt: trimmed,
    questionCount,
    difficulty,
    formats,
  });

  const total = Number(resolved.questionCount);
  if (!Number.isFinite(total) || total < 1) {
    throw new Error(
      "Enter how many questions to generate (1–150), or include a count in your prompt."
    );
  }
  const allQuestions = [];
  let suggestedTitle = "";
  let suggestedDescription = "";
  let meta = {};
  let lastError = null;
  let highestPercent = 2;

  const emitProgress = (payload) => {
    const nextPercent = Math.max(
      highestPercent,
      Number(payload.percent) || highestPercent
    );
    highestPercent = Math.min(100, nextPercent);
    onProgress?.({
      ...payload,
      percent: highestPercent,
    });
  };

  const assertNotAborted = () => {
    if (signal?.aborted) {
      const error = new Error("Generation cancelled.");
      error.name = "AbortError";
      throw error;
    }
  };

  emitProgress({
    phase: "prompt",
    current: 0,
    total,
    percent: 2,
    status: "waiting",
  });

  while (allQuestions.length < total) {
    assertNotAborted();

    const need = Math.min(PROMPT_CLIENT_ROUND_SIZE, total - allQuestions.length);
    const recent = allQuestions
      .map((item) => item?.question)
      .filter(Boolean)
      .slice(-12)
      .join(" | ");

    const additionalInstructions = allQuestions.length
      ? [
          `Already created ${allQuestions.length} of ${total} questions.`,
          `Generate exactly ${need} NEW distinct questions.`,
          recent ? `Do not repeat or paraphrase any of these existing questions: ${recent}` : "",
        ]
          .filter(Boolean)
          .join(" ")
      : "";

    emitProgress({
      phase: "prompt",
      current: allQuestions.length,
      total,
      percent: Math.min(76, Math.round(4 + (allQuestions.length / total) * 72)),
      status: "generating",
    });

    let res;
    try {
      const headers = await getAuthHeaders(true, { forceRefresh: allQuestions.length === 0 });
      res = await fetchAuthedWithRetry(`${API_BASE}/assessment-ai/generate-from-prompt`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          prompt: trimmed,
          formats: resolved.formats,
          questionCount: need,
          difficulty: resolved.difficulty,
          additionalInstructions,
          lockQuestionCount: true,
        }),
        signal,
      });
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      lastError = isBackendUnreachable(error)
        ? new Error(backendUnreachableMessage())
        : error;
      break;
    }

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      lastError = new Error(formatApiError(payload, "Failed to generate questions"));
      break;
    }

    const batch = Array.isArray(payload.questions) ? payload.questions : [];
    if (!batch.length) {
      lastError = new Error("AI did not return any usable questions.");
      break;
    }

    if (!suggestedTitle && payload.suggestedTitle) {
      suggestedTitle = payload.suggestedTitle;
    }
    if (!suggestedDescription && payload.suggestedDescription) {
      suggestedDescription = payload.suggestedDescription;
    }
    meta = {
      ...(payload.meta || {}),
      ...(meta || {}),
      requestedCount: total,
      generatedCount: allQuestions.length + batch.length,
      rounds: (meta.rounds || 0) + 1,
    };

    let addedThisRound = 0;
    for (const question of batch) {
      if (allQuestions.length >= total) break;
      allQuestions.push(question);
      addedThisRound += 1;
      const current = allQuestions.length;
      emitProgress({
        phase: "prompt",
        current,
        total,
        percent: Math.round(78 + (current / total) * 22),
        status: "revealing",
      });
      emitQuestionReady({
        onQuestionGenerated,
        question,
        step: current - 1,
        total,
        phase: "prompt",
        payload: {
          suggestedTitle,
          suggestedDescription,
        },
      });
      if (current < total) {
        await sleep(40);
      }
    }

    // Avoid infinite loops if the model keeps returning only duplicates/empty progress.
    if (addedThisRound === 0) break;
  }

  const finalQuestions = allQuestions.slice(0, total);

  if (!finalQuestions.length) {
    throw lastError || new Error("AI did not return any usable questions.");
  }

  emitProgress({
    phase: "prompt",
    current: finalQuestions.length,
    total,
    percent: 100,
    status: "done",
  });

  return {
    success: true,
    questions: finalQuestions,
    suggestedTitle,
    suggestedDescription,
    meta: {
      ...meta,
      requestedCount: total,
      generatedCount: finalQuestions.length,
      partial: finalQuestions.length < total,
      warning:
        finalQuestions.length < total
          ? `Generated ${finalQuestions.length} of ${total} questions. You can run generate again to add more.`
          : null,
    },
    resolvedSettings: {
      ...resolved,
      questionCount: total,
    },
  };
}

export async function classifyAssessmentDocument({ file, files, signal }) {
  const session = await getAuthSession({ forceRefresh: true });
  if (!session?.access_token) {
    throw new Error("Your session expired. Please sign in again.");
  }

  const formData = new FormData();
  appendFilesToFormData(formData, files || file);

  let res;
  try {
    res = await fetchAuthedWithRetry(`${API_BASE}/assessment-ai/classify-document`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: formData,
      signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    if (isBackendUnreachable(error)) {
      throw new Error(backendUnreachableMessage());
    }
    throw error;
  }

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(formatApiError(payload, "Failed to classify document"));
  }

  return payload;
}

export async function generateAssessmentFromDocument({
  file,
  files,
  fileIndexes,
  questionCount,
  difficulty,
  formats,
  isQuestionnaire = true,
  onProgress,
  onQuestionGenerated,
  signal,
}) {
  const requested = Number(questionCount);

  // Source material with large N: extract once, then short client rounds (same pattern as prompts).
  if (
    !isQuestionnaire &&
    Number.isFinite(requested) &&
    requested > DOCUMENT_CLIENT_ROUND_SIZE
  ) {
    return generateSourceMaterialBatched({
      file,
      files,
      fileIndexes,
      questionCount: requested,
      difficulty,
      formats,
      onProgress,
      onQuestionGenerated,
      signal,
    });
  }

  const session = await getAuthSession({ forceRefresh: true });
  if (!session?.access_token) {
    throw new Error("Your session expired. Please sign in again.");
  }

  const formData = new FormData();
  appendFilesToFormData(formData, files || file);
  formData.append("isQuestionnaire", isQuestionnaire ? "true" : "false");
  if (Array.isArray(fileIndexes) && fileIndexes.length) {
    formData.append("fileIndexes", JSON.stringify(fileIndexes));
  }
  if (questionCount != null && String(questionCount).trim() !== "" && Number(questionCount) > 0) {
    formData.append("questionCount", String(questionCount));
  }
  if (difficulty) {
    formData.append("difficulty", String(difficulty));
  }
  if (Array.isArray(formats) && formats.length) {
    formData.append("formats", JSON.stringify(formats));
  }

  let highestPercent = 3;
  const guardedProgress = (payload) => {
    const next = Math.max(highestPercent, Number(payload?.percent) || highestPercent);
    highestPercent = Math.min(100, next);
    onProgress?.({ ...payload, percent: highestPercent });
  };

  let res;
  const stopWaiting = startWaitingProgress({
    onProgress: guardedProgress,
    phase: "reading",
    total: questionCount || undefined,
    floorPercent: 3,
  });

  try {
    res = await fetchAuthedWithRetry(`${API_BASE}/assessment-ai/analyze-document`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: formData,
      signal,
    });
  } catch (error) {
    stopWaiting();
    if (error?.name === "AbortError") throw error;
    if (isBackendUnreachable(error)) {
      throw new Error(backendUnreachableMessage());
    }
    throw error;
  } finally {
    stopWaiting();
  }

  const payload = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(formatApiError(payload, "Failed to analyze document"));
  }

  let questions = Array.isArray(payload.questions) ? payload.questions : [];
  if (
    !isQuestionnaire &&
    Number.isFinite(requested) &&
    requested > 0 &&
    questions.length > requested
  ) {
    questions = questions.slice(0, requested);
  }

  if (!questions.length) {
    throw new Error("AI did not return any usable questions from this document.");
  }

  await revealQuestionsIncrementally({
    questions,
    onProgress: guardedProgress,
    onQuestionGenerated,
    phase: "structuring",
    payload: { ...payload, questions },
  });

  return { ...payload, questions };
}

async function extractDocumentsText({ file, files, fileIndexes, signal }) {
  const session = await getAuthSession({ forceRefresh: true });
  if (!session?.access_token) {
    throw new Error("Your session expired. Please sign in again.");
  }

  const formData = new FormData();
  appendFilesToFormData(formData, files || file);
  if (Array.isArray(fileIndexes) && fileIndexes.length) {
    formData.append("fileIndexes", JSON.stringify(fileIndexes));
  }

  const res = await fetchAuthedWithRetry(`${API_BASE}/assessment-ai/extract-document`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    body: formData,
    signal,
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(formatApiError(payload, "Failed to read document text"));
  }

  const text = String(payload.text || "").trim();
  if (!text) {
    throw new Error("The document did not contain readable text.");
  }
  return text;
}

async function generateSourceMaterialBatched({
  file,
  files,
  fileIndexes,
  questionCount,
  difficulty,
  formats,
  onProgress,
  onQuestionGenerated,
  signal,
}) {
  const total = Math.min(150, Math.max(1, Number(questionCount) || 1));
  let highestPercent = 2;

  const emitProgress = (payload) => {
    const nextPercent = Math.max(highestPercent, Number(payload.percent) || highestPercent);
    highestPercent = Math.min(100, nextPercent);
    onProgress?.({ ...payload, percent: highestPercent });
  };

  const assertNotAborted = () => {
    if (signal?.aborted) {
      const error = new Error("Generation cancelled.");
      error.name = "AbortError";
      throw error;
    }
  };

  emitProgress({
    phase: "reading",
    current: 0,
    total,
    percent: 4,
    status: "waiting",
  });

  const sourceText = await extractDocumentsText({ file, files, fileIndexes, signal });

  const allQuestions = [];
  let suggestedTitle = "";
  let suggestedDescription = "";
  let meta = {};
  let lastError = null;

  while (allQuestions.length < total) {
    assertNotAborted();

    const need = Math.min(DOCUMENT_CLIENT_ROUND_SIZE, total - allQuestions.length);
    const recent = allQuestions
      .map((item) => item?.question)
      .filter(Boolean)
      .slice(-12)
      .join(" | ");

    const additionalInstructions = allQuestions.length
      ? [
          `Already created ${allQuestions.length} of ${total} questions from this source.`,
          `Generate exactly ${need} NEW distinct questions grounded in the source.`,
          recent ? `Do not repeat or paraphrase any of these: ${recent}` : "",
        ]
          .filter(Boolean)
          .join(" ")
      : `Generate exactly ${need} questions grounded in the source.`;

    emitProgress({
      phase: "structuring",
      current: allQuestions.length,
      total,
      percent: Math.min(76, Math.round(8 + (allQuestions.length / total) * 68)),
      status: "generating",
    });

    let res;
    try {
      const headers = await getAuthHeaders(true, { forceRefresh: allQuestions.length === 0 });
      res = await fetchAuthedWithRetry(`${API_BASE}/assessment-ai/generate-from-source-text`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          sourceText,
          formats,
          questionCount: need,
          difficulty,
          additionalInstructions,
        }),
        signal,
      });
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      lastError = isBackendUnreachable(error)
        ? new Error(backendUnreachableMessage())
        : error;
      break;
    }

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      lastError = new Error(formatApiError(payload, "Failed to generate from source"));
      break;
    }

    const batch = Array.isArray(payload.questions) ? payload.questions : [];
    if (!batch.length) {
      lastError = new Error("AI did not return any usable questions from this source.");
      break;
    }

    if (!suggestedTitle && payload.suggestedTitle) {
      suggestedTitle = payload.suggestedTitle;
    }
    if (!suggestedDescription && payload.suggestedDescription) {
      suggestedDescription = payload.suggestedDescription;
    }
    meta = {
      ...(payload.meta || {}),
      ...(meta || {}),
      requestedCount: total,
      generatedCount: allQuestions.length + batch.length,
      rounds: (meta.rounds || 0) + 1,
    };

    let addedThisRound = 0;
    for (const question of batch) {
      if (allQuestions.length >= total) break;
      allQuestions.push(question);
      addedThisRound += 1;
      const current = allQuestions.length;
      emitProgress({
        phase: "structuring",
        current,
        total,
        percent: Math.round(78 + (current / total) * 22),
        status: "revealing",
      });
      emitQuestionReady({
        onQuestionGenerated,
        question,
        step: current - 1,
        total,
        phase: "structuring",
        payload: {
          suggestedTitle,
          suggestedDescription,
        },
      });
      if (current < total) {
        await sleep(40);
      }
    }

    if (addedThisRound === 0) break;
  }

  const finalQuestions = allQuestions.slice(0, total);

  if (!finalQuestions.length) {
    throw lastError || new Error("AI did not return any usable questions from this document.");
  }

  emitProgress({
    phase: "structuring",
    current: finalQuestions.length,
    total,
    percent: 100,
    status: "done",
  });

  return {
    success: true,
    questions: finalQuestions,
    suggestedTitle,
    suggestedDescription,
    meta: {
      ...meta,
      requestedCount: total,
      generatedCount: finalQuestions.length,
      partial: finalQuestions.length < total,
      warning:
        finalQuestions.length < total
          ? `Generated ${finalQuestions.length} of ${total} source questions. You can generate again to add more.`
          : null,
      mode: "document_source_material_client_batched",
    },
  };
}
