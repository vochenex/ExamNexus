import { getAuthSession } from "./authUser";
import { resolvePromptGenerationSettings } from "./promptPreferences";

import { API_BASE, isLocalApiBase } from "./apiBase.js";

const AI_REQUEST_TIMEOUT_MS = 600000;
/** Keep each hosted API round small so Vercel's 60s limit is not exceeded. */
const PROMPT_CLIENT_ROUND_SIZE = 8;

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

function startWaitingProgress({ onProgress, phase, total }) {
  let percent = 3;
  const cap = 78;
  onProgress?.({
    phase,
    current: 0,
    total,
    percent,
    status: "waiting",
  });

  const timer = setInterval(() => {
    percent = Math.min(cap, percent + 2 + Math.random() * 3);
    onProgress?.({
      phase,
      current: 0,
      total,
      percent: Math.round(percent),
      status: "waiting",
    });
  }, 350);

  return () => clearInterval(timer);
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
    percent: 100,
    status: "done",
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

  const assertNotAborted = () => {
    if (signal?.aborted) {
      const error = new Error("Generation cancelled.");
      error.name = "AbortError";
      throw error;
    }
  };

  onProgress?.({
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

    onProgress?.({
      phase: "prompt",
      current: allQuestions.length,
      total,
      percent: Math.min(
        76,
        Math.round(4 + (allQuestions.length / total) * 72)
      ),
      status: "waiting",
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

    for (const question of batch) {
      if (allQuestions.length >= total) break;
      allQuestions.push(question);
      const current = allQuestions.length;
      onProgress?.({
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

    // Avoid infinite loops if the model keeps returning the same count with no progress.
    if (batch.length === 0) break;
  }

  if (!allQuestions.length) {
    throw lastError || new Error("AI did not return any usable questions.");
  }

  onProgress?.({
    phase: "prompt",
    current: allQuestions.length,
    total,
    percent: 100,
    status: "done",
  });

  return {
    success: true,
    questions: allQuestions,
    suggestedTitle,
    suggestedDescription,
    meta: {
      ...meta,
      requestedCount: total,
      generatedCount: allQuestions.length,
      partial: allQuestions.length < total,
      warning:
        allQuestions.length < total
          ? `Generated ${allQuestions.length} of ${total} questions. You can run generate again to add more.`
          : null,
    },
    resolvedSettings: {
      ...resolved,
      questionCount: total,
    },
  };
}

export async function classifyAssessmentDocument({ file, signal }) {
  if (!file) {
    throw new Error("Choose a PDF, Word (.docx), or PowerPoint (.pptx) file to upload.");
  }

  const session = await getAuthSession({ forceRefresh: true });
  if (!session?.access_token) {
    throw new Error("Your session expired. Please sign in again.");
  }

  const formData = new FormData();
  formData.append("file", file);

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
  questionCount,
  difficulty,
  formats,
  isQuestionnaire = true,
  onProgress,
  onQuestionGenerated,
  signal,
}) {
  if (!file) {
    throw new Error("Choose a PDF, Word (.docx), or PowerPoint (.pptx) file to upload.");
  }

  const session = await getAuthSession({ forceRefresh: true });
  if (!session?.access_token) {
    throw new Error("Your session expired. Please sign in again.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("isQuestionnaire", isQuestionnaire ? "true" : "false");
  if (questionCount != null && String(questionCount).trim() !== "" && Number(questionCount) > 0) {
    formData.append("questionCount", String(questionCount));
  }
  if (difficulty) {
    formData.append("difficulty", String(difficulty));
  }
  if (Array.isArray(formats) && formats.length) {
    formData.append("formats", JSON.stringify(formats));
  }

  let res;
  const stopWaiting = startWaitingProgress({
    onProgress,
    phase: "reading",
    total: questionCount || undefined,
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

  const questions = Array.isArray(payload.questions) ? payload.questions : [];
  if (!questions.length) {
    throw new Error("AI did not return any usable questions from this document.");
  }

  await revealQuestionsIncrementally({
    questions,
    onProgress,
    onQuestionGenerated,
    phase: "structuring",
    payload,
  });

  return payload;
}
