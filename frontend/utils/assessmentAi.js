import { getAuthSession } from "./authUser";
import { resolvePromptGenerationSettings } from "./promptPreferences";

import { API_BASE, isLocalApiBase } from "./apiBase.js";

const AI_REQUEST_TIMEOUT_MS = 600000;
/** Keep each hosted API round small so Groq/Vercel do not truncate mid-JSON. */
const PROMPT_CLIENT_ROUND_SIZE = 4;
/** Source rounds: 5 matches backend DEFAULT_CHUNK_SIZE and keeps Gemini JSON reliable. */
const DOCUMENT_CLIENT_ROUND_SIZE = 5;
const DOCUMENT_SOURCE_MAX_CHARS = 14000;
const DOCUMENT_ROUND_DELAY_MS = 2500;
const DOCUMENT_MAX_ROUND_ATTEMPTS = 3;
const DOCUMENT_MAX_SOFT_FAILURES = 4;

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

function formatApiError(payload, fallback, status) {
  const message = payload?.error;
  if (typeof message === "string" && message.trim()) {
    return message.trim();
  }

  const code = Number(status);
  if (code === 504 || code === 408) {
    return "The server timed out analyzing this document. Try a shorter file, or split it into a smaller upload.";
  }
  if (code === 502 || code === 503) {
    return "The AI service is temporarily unavailable. Wait a moment and try again.";
  }
  if (code === 413) {
    return "That file is too large for the server. Upload a smaller PDF, Word, or PowerPoint file.";
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
          "AI is not ready. Add GEMINI_DOCUMENT_API_KEY (or GEMINI_API_KEY) for documents and a separate GEMINI_PROMPT_API_KEY for prompts to backend/.env, then restart the backend.",
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
  let consecutiveSoftFailures = 0;

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
    let roundAttempts = 0;
    const maxRoundAttempts = 2;
    try {
      while (roundAttempts < maxRoundAttempts) {
        roundAttempts += 1;
        const headers = await getAuthHeaders(true, {
          forceRefresh: allQuestions.length === 0 && roundAttempts === 1,
        });
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

        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          lastError = new Error(formatApiError(payload, "Failed to generate questions", res.status));
          if (roundAttempts < maxRoundAttempts) {
            await sleep(700 * roundAttempts);
            continue;
          }
          break;
        }

        const batch = Array.isArray(payload.questions) ? payload.questions : [];
        if (!batch.length) {
          lastError = new Error("AI did not return any usable questions.");
          if (roundAttempts < maxRoundAttempts) {
            await sleep(700 * roundAttempts);
            continue;
          }
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

        // Short rounds are OK — keep looping until we hit the requested total.
        if (addedThisRound === 0 && roundAttempts < maxRoundAttempts) {
          await sleep(700 * roundAttempts);
          continue;
        }
        if (addedThisRound === 0) break;
        lastError = null;
        break;
      }
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      lastError = isBackendUnreachable(error)
        ? new Error(backendUnreachableMessage())
        : error;
      break;
    }

    if (lastError && allQuestions.length === 0) break;
    if (lastError && allQuestions.length > 0 && allQuestions.length < total) {
      consecutiveSoftFailures += 1;
      if (consecutiveSoftFailures >= 3) break;
      lastError = null;
      await sleep(500);
      continue;
    }
    consecutiveSoftFailures = 0;
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

  const list = Array.isArray(files) ? files.filter(Boolean) : files ? [files] : file ? [file] : [];
  if (!list.length) {
    throw new Error("Choose a PDF, Word (.docx), or PowerPoint (.pptx) file to upload.");
  }

  const postClassify = async (uploadFiles) => {
    const formData = new FormData();
    appendFilesToFormData(formData, uploadFiles);

    let res;
    try {
      // Classify is extract + heuristics; keep under typical hosted limits.
      res = await fetchAuthedWithRetry(
        `${API_BASE}/assessment-ai/classify-document`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
          signal,
        },
        90000
      );
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      if (isBackendUnreachable(error)) {
        throw new Error(backendUnreachableMessage());
      }
      throw error;
    }

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(formatApiError(payload, "Failed to classify document", res.status));
    }
    return payload;
  };

  try {
    return await postClassify(list);
  } catch (batchError) {
    if (batchError?.name === "AbortError" || list.length <= 1) {
      throw batchError;
    }

    // Fallback: classify each file in parallel (avoids one oversized extract timing out).
    const settled = await Promise.all(
      list.map(async (single, index) => {
        try {
          const payload = await postClassify([single]);
          const row = payload?.files?.[0] || {
            index,
            name: single.name || `document-${index + 1}`,
            documentKind: payload?.documentKind || "study_material",
            isQuestionnaire: Boolean(payload?.isQuestionnaire),
            summary: payload?.summary || "",
            suggestedTitle: payload?.suggestedTitle || "",
          };
          const docText =
            Array.isArray(payload?.documents) && payload.documents[0]
              ? String(payload.documents[0].text || "")
              : "";
          return {
            ok: true,
            file: {
              index,
              name: single.name || row.name || `document-${index + 1}`,
              documentKind: row.documentKind || "study_material",
              isQuestionnaire: Boolean(row.isQuestionnaire),
              summary: row.summary || "",
              suggestedTitle: row.suggestedTitle || "",
            },
            document: {
              index,
              name: single.name || row.name || `document-${index + 1}`,
              text: docText,
            },
          };
        } catch (error) {
          return {
            ok: false,
            failure: {
              index,
              name: single.name || `document-${index + 1}`,
              error: error?.message || "Could not classify this file.",
            },
          };
        }
      })
    );

    const fileResults = settled.filter((item) => item.ok).map((item) => item.file);
    const documents = settled
      .filter((item) => item.ok)
      .map((item) => item.document)
      .filter((doc) => String(doc?.text || "").trim());
    const failures = settled.filter((item) => !item.ok).map((item) => item.failure);

    if (!fileResults.length) {
      throw batchError;
    }

    const questionnaireFiles = fileResults.filter((item) => item.isQuestionnaire);
    const sourceFiles = fileResults.filter((item) => !item.isQuestionnaire);
    const mixed = questionnaireFiles.length > 0 && sourceFiles.length > 0;
    const allQuestionnaire = questionnaireFiles.length === fileResults.length;
    const primary =
      (allQuestionnaire ? questionnaireFiles[0] : null) ||
      sourceFiles[0] ||
      fileResults[0];

    return {
      success: true,
      fileCount: list.length,
      readableFileCount: fileResults.length,
      mixed,
      hasQuestionnaire: questionnaireFiles.length > 0,
      hasSource: sourceFiles.length > 0,
      documentKind: mixed ? "mixed" : primary?.documentKind || "study_material",
      isQuestionnaire: allQuestionnaire,
      summary: mixed
        ? `Mixed upload: ${questionnaireFiles.length} questionnaire file(s) and ${sourceFiles.length} source/study file(s).`
        : primary?.summary || "",
      suggestedTitle: primary?.suggestedTitle || "",
      files: fileResults,
      documents,
      failures,
      questionnaireIndexes: questionnaireFiles.map((item) => item.index),
      sourceIndexes: sourceFiles.map((item) => item.index),
    };
  }
}

/** Prefer one fast questionnaire convert; only batch huge docs or after timeout. */
const QUESTIONNAIRE_SINGLE_SHOT_MAX_CHARS = 12000;
const QUESTIONNAIRE_CHUNK_CHARS = 9000;
const QUESTIONNAIRE_STEPS_PER_ROUND = 10;
const QUESTIONNAIRE_ROUND_DELAY_MS = 400;

function chunkTextForQuestionnaire(text, maxChars = QUESTIONNAIRE_CHUNK_CHARS) {
  const source = String(text || "").trim();
  if (!source) return [];
  if (source.length <= maxChars) return [source];

  const chunks = [];
  let cursor = 0;
  while (cursor < source.length) {
    let end = Math.min(source.length, cursor + maxChars);
    if (end < source.length) {
      const window = source.slice(cursor, end);
      const breakAt = Math.max(
        window.lastIndexOf("\n\n"),
        window.lastIndexOf("\n"),
        window.lastIndexOf(". ")
      );
      if (breakAt > maxChars * 0.45) {
        end = cursor + breakAt + 1;
      }
    }
    const piece = source.slice(cursor, end).trim();
    if (piece) chunks.push(piece);
    cursor = Math.max(end, cursor + 1);
  }
  return chunks;
}

function isTimeoutLikeError(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("timed out") ||
    message.includes("time limit") ||
    message.includes("timeout") ||
    message.includes("504") ||
    message.includes("408")
  );
}

async function fetchDocumentPlan(sourceText, signal) {
  const session = await getAuthSession({ forceRefresh: true });
  if (!session?.access_token) {
    throw new Error("Your session expired. Please sign in again.");
  }

  const res = await fetchAuthedWithRetry(`${API_BASE}/assessment-ai/document-plan`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sourceText }),
    signal,
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(formatApiError(payload, "Failed to plan document analysis", res.status));
  }
  return payload;
}

async function analyzeDocumentTextRound({
  sourceText,
  isQuestionnaire = true,
  questionCount,
  difficulty,
  formats,
  signal,
}) {
  const session = await getAuthSession({ forceRefresh: true });
  if (!session?.access_token) {
    throw new Error("Your session expired. Please sign in again.");
  }

  // Hosted functions die near 60s — fail sooner so questionnaire convert can chunk.
  const res = await fetchAuthedWithRetry(
    `${API_BASE}/assessment-ai/analyze-document-text`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sourceText,
        isQuestionnaire,
        questionCount,
        difficulty,
        formats,
      }),
      signal,
    },
    55000
  );

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(formatApiError(payload, "Failed to analyze document", res.status));
  }
  return payload;
}

function buildQuestionnaireRounds(rawSource, plan) {
  const steps = Array.isArray(plan?.steps) ? plan.steps : [];
  if (plan?.mode === "existing_questions" && steps.length > QUESTIONNAIRE_STEPS_PER_ROUND) {
    const rounds = [];
    for (let i = 0; i < steps.length; i += QUESTIONNAIRE_STEPS_PER_ROUND) {
      const batch = steps.slice(i, i + QUESTIONNAIRE_STEPS_PER_ROUND);
      const joined = batch
        .map((step) => String(step?.sourceText || "").trim())
        .filter(Boolean)
        .join("\n\n");
      if (joined) rounds.push(joined);
    }
    return rounds;
  }
  return chunkTextForQuestionnaire(rawSource);
}

async function generateQuestionnaireBatched({
  file,
  files,
  fileIndexes,
  onProgress,
  onQuestionGenerated,
  signal,
}) {
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

  const collectFromPayload = (payload, allQuestions, titles) => {
    const questions = Array.isArray(payload?.questions) ? payload.questions : [];
    if (!titles.suggestedTitle && payload?.suggestedTitle) {
      titles.suggestedTitle = payload.suggestedTitle;
    }
    if (!titles.suggestedDescription && payload?.suggestedDescription) {
      titles.suggestedDescription = payload.suggestedDescription;
    }

    for (let i = 0; i < questions.length; i += 1) {
      allQuestions.push(questions[i]);
      emitQuestionReady({
        onQuestionGenerated,
        question: questions[i],
        step: allQuestions.length - 1,
        total: allQuestions.length,
        phase: "structuring",
        payload: {
          suggestedTitle: titles.suggestedTitle,
          suggestedDescription: titles.suggestedDescription,
        },
      });
      emitProgress({
        phase: "structuring",
        current: allQuestions.length,
        total: Math.max(allQuestions.length, 1),
        percent: Math.min(96, 20 + Math.round((allQuestions.length / (allQuestions.length + 1)) * 70)),
        status: "revealing",
      });
    }

    return questions.length;
  };

  emitProgress({
    phase: "reading",
    percent: 8,
    status: "waiting",
  });

  const stopExtractWait = startWaitingProgress({
    onProgress: emitProgress,
    phase: "reading",
    floorPercent: 8,
  });

  let rawSource = "";
  try {
    rawSource = await extractDocumentsText({ file, files, fileIndexes, signal });
  } finally {
    stopExtractWait();
  }
  assertNotAborted();

  const titles = { suggestedTitle: "", suggestedDescription: "" };
  const allQuestions = [];
  let meta = {};
  let lastError = null;
  let mode = "document_questionnaire";

  // Fast path: one convert call (how the original questionnaire flow worked).
  if (rawSource.length <= QUESTIONNAIRE_SINGLE_SHOT_MAX_CHARS) {
    emitProgress({
      phase: "structuring",
      percent: 28,
      status: "waiting",
    });
    const stopAnalyzeWait = startWaitingProgress({
      onProgress: emitProgress,
      phase: "structuring",
      floorPercent: 28,
    });
    try {
      const payload = await analyzeDocumentTextRound({
        sourceText: rawSource,
        isQuestionnaire: true,
        signal,
      });
      stopAnalyzeWait();
      meta = { ...(payload.meta || {}) };
      const added = collectFromPayload(payload, allQuestions, titles);
      if (added > 0) {
        emitProgress({
          phase: "structuring",
          current: allQuestions.length,
          total: allQuestions.length,
          percent: 100,
          status: "done",
        });
        return {
          success: true,
          suggestedTitle: titles.suggestedTitle,
          suggestedDescription: titles.suggestedDescription,
          questions: allQuestions,
          meta: {
            ...meta,
            generatedCount: allQuestions.length,
            mode,
            isQuestionnaire: true,
            rounds: 1,
          },
        };
      }
    } catch (error) {
      stopAnalyzeWait();
      if (error?.name === "AbortError") throw error;
      lastError = error;
      if (!isTimeoutLikeError(error)) {
        throw error;
      }
      // Timed out on hosted limit — fall through to smaller rounds.
      mode = "document_questionnaire_batched";
    }
  }

  let rounds = [];
  try {
    const plan = await fetchDocumentPlan(rawSource, signal);
    rounds = buildQuestionnaireRounds(rawSource, plan);
  } catch {
    rounds = chunkTextForQuestionnaire(rawSource);
  }
  if (!rounds.length) {
    rounds = chunkTextForQuestionnaire(rawSource);
  }

  for (let roundIndex = 0; roundIndex < rounds.length; roundIndex += 1) {
    assertNotAborted();
    if (roundIndex > 0) {
      await sleep(QUESTIONNAIRE_ROUND_DELAY_MS);
    }

    const floor = Math.min(88, 20 + Math.round((roundIndex / rounds.length) * 60));
    emitProgress({
      phase: "structuring",
      percent: floor,
      status: "waiting",
    });
    const stopRoundWait = startWaitingProgress({
      onProgress: emitProgress,
      phase: "structuring",
      floorPercent: floor,
    });

    let roundOk = false;
    for (let attempt = 1; attempt <= 2 && !roundOk; attempt += 1) {
      try {
        if (attempt > 1) await sleep(600);
        const payload = await analyzeDocumentTextRound({
          sourceText: rounds[roundIndex],
          isQuestionnaire: true,
          signal,
        });
        meta = { ...(meta || {}), ...(payload.meta || {}) };
        const added = collectFromPayload(payload, allQuestions, titles);
        if (!added) {
          lastError = new Error(
            "AI did not return any usable questions from this document section."
          );
          continue;
        }
        roundOk = true;
      } catch (error) {
        if (error?.name === "AbortError") {
          stopRoundWait();
          throw error;
        }
        lastError = error;
      }
    }
    stopRoundWait();
  }

  if (!allQuestions.length) {
    throw lastError || new Error("AI did not return any usable questions from this document.");
  }

  emitProgress({
    phase: "structuring",
    current: allQuestions.length,
    total: allQuestions.length,
    percent: 100,
    status: "done",
  });

  return {
    success: true,
    suggestedTitle: titles.suggestedTitle,
    suggestedDescription: titles.suggestedDescription,
    questions: allQuestions,
    meta: {
      ...meta,
      generatedCount: allQuestions.length,
      mode,
      isQuestionnaire: true,
      rounds: rounds.length,
      warning:
        mode === "document_questionnaire_batched"
          ? `Converted ${allQuestions.length} question(s) in ${rounds.length} shorter rounds to fit the hosted time limit.`
          : undefined,
    },
  };
}

async function generateQuestionnaireFromText({
  sourceText,
  onProgress,
  onQuestionGenerated,
  signal,
}) {
  const resolved = String(sourceText || "").trim();
  if (!resolved) {
    throw new Error("The document did not contain readable text.");
  }

  let highestPercent = 18;
  const guardedProgress = (payload) => {
    const next = Math.max(highestPercent, Number(payload?.percent) || highestPercent);
    highestPercent = Math.min(92, next);
    onProgress?.({ ...payload, percent: highestPercent });
  };

  guardedProgress({
    phase: "structuring",
    percent: 22,
    status: "converting",
  });

  const stopWaiting = startWaitingProgress({
    onProgress: guardedProgress,
    phase: "structuring",
    floorPercent: 22,
  });

  try {
    // Prefer one convert call; only chunk if the hosted function times out.
    if (resolved.length <= QUESTIONNAIRE_SINGLE_SHOT_MAX_CHARS) {
      try {
        const payload = await analyzeDocumentTextRound({
          sourceText: resolved,
          isQuestionnaire: true,
          signal,
        });
        stopWaiting();
        const questions = Array.isArray(payload.questions) ? payload.questions : [];
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
        return {
          ...payload,
          questions,
          meta: {
            ...(payload.meta || {}),
            generatedCount: questions.length,
            mode: "document_questionnaire",
            isQuestionnaire: true,
            rounds: 1,
          },
        };
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        if (!isTimeoutLikeError(error)) throw error;
      }
    }

    stopWaiting();
    // Large / timed-out: chunk the already-extracted text (no second file upload).
    const rounds = chunkTextForQuestionnaire(resolved);
    const titles = { suggestedTitle: "", suggestedDescription: "" };
    const allQuestions = [];
    let meta = {};
    let lastError = null;

    for (let roundIndex = 0; roundIndex < rounds.length; roundIndex += 1) {
      if (signal?.aborted) {
        const error = new Error("Generation cancelled.");
        error.name = "AbortError";
        throw error;
      }
      if (roundIndex > 0) await sleep(QUESTIONNAIRE_ROUND_DELAY_MS);

      const floor = Math.min(88, 24 + Math.round((roundIndex / rounds.length) * 55));
      const stopRound = startWaitingProgress({
        onProgress: guardedProgress,
        phase: "structuring",
        floorPercent: floor,
      });
      try {
        const payload = await analyzeDocumentTextRound({
          sourceText: rounds[roundIndex],
          isQuestionnaire: true,
          signal,
        });
        const questions = Array.isArray(payload.questions) ? payload.questions : [];
        meta = { ...(meta || {}), ...(payload.meta || {}) };
        if (!titles.suggestedTitle && payload.suggestedTitle) {
          titles.suggestedTitle = payload.suggestedTitle;
        }
        if (!titles.suggestedDescription && payload.suggestedDescription) {
          titles.suggestedDescription = payload.suggestedDescription;
        }
        for (const question of questions) {
          allQuestions.push(question);
          emitQuestionReady({
            onQuestionGenerated,
            question,
            step: allQuestions.length - 1,
            total: allQuestions.length,
            phase: "structuring",
            payload: titles,
          });
          guardedProgress({
            phase: "structuring",
            current: allQuestions.length,
            total: Math.max(allQuestions.length, rounds.length),
            percent: Math.min(96, 30 + allQuestions.length),
            status: "revealing",
          });
        }
        if (!questions.length) {
          lastError = new Error("AI did not return questions for a document section.");
        }
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        lastError = error;
      } finally {
        stopRound();
      }
    }

    if (!allQuestions.length) {
      throw lastError || new Error("AI did not return any usable questions from this document.");
    }

    guardedProgress({
      phase: "structuring",
      current: allQuestions.length,
      total: allQuestions.length,
      percent: 100,
      status: "done",
    });

    return {
      success: true,
      suggestedTitle: titles.suggestedTitle,
      suggestedDescription: titles.suggestedDescription,
      questions: allQuestions,
      meta: {
        ...meta,
        generatedCount: allQuestions.length,
        mode: "document_questionnaire_batched",
        isQuestionnaire: true,
        rounds: rounds.length,
      },
    };
  } catch (error) {
    stopWaiting();
    throw error;
  }
}

export function mergeClassificationQuestionnaireText(classification) {
  const docs = Array.isArray(classification?.documents) ? classification.documents : [];
  if (!docs.length) return "";

  const indexes = Array.isArray(classification?.questionnaireIndexes)
    ? new Set(classification.questionnaireIndexes.map((value) => Number(value)))
    : null;

  const selected = docs.filter((doc) => {
    if (!indexes || !indexes.size) {
      return classification?.isQuestionnaire !== false;
    }
    return indexes.has(Number(doc.index));
  });

  return selected
    .map((doc) => String(doc?.text || "").trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

/**
 * Convert / generate from a document.
 * Questionnaires: prefer already-extracted classify text (one convert call).
 * Study guides: stay on short client rounds.
 */
export async function generateAssessmentFromDocument({
  file,
  files,
  fileIndexes,
  sourceText,
  questionCount,
  difficulty,
  formats,
  isQuestionnaire = true,
  onProgress,
  onQuestionGenerated,
  signal,
}) {
  const requested = Number(questionCount);

  if (!isQuestionnaire && Number.isFinite(requested) && requested > 0) {
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

  if (isQuestionnaire) {
    const resolvedText = String(sourceText || "").trim();
    if (resolvedText) {
      return generateQuestionnaireFromText({
        sourceText: resolvedText,
        onProgress,
        onQuestionGenerated,
        signal,
      });
    }
    // No classify text: extract once, then single convert (batched only on timeout).
    return generateQuestionnaireBatched({
      file,
      files,
      fileIndexes,
      onProgress,
      onQuestionGenerated,
      signal,
    });
  }

  throw new Error("Set a question count to generate from study/source material.");
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
    throw new Error(formatApiError(payload, "Failed to read document text", res.status));
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

  const rawSource = await extractDocumentsText({ file, files, fileIndexes, signal });
  const sourceText = String(rawSource || "").slice(0, DOCUMENT_SOURCE_MAX_CHARS);

  const allQuestions = [];
  let suggestedTitle = "";
  let suggestedDescription = "";
  let meta = {};
  let lastError = null;
  let consecutiveSoftFailures = 0;
  let roundIndex = 0;

  while (allQuestions.length < total) {
    assertNotAborted();

    if (roundIndex > 0) {
      // Space Gemini calls — free-tier RPM is the usual reason rounds stop at ~8.
      await sleep(DOCUMENT_ROUND_DELAY_MS);
    }
    roundIndex += 1;

    const need = Math.min(DOCUMENT_CLIENT_ROUND_SIZE, total - allQuestions.length);
    const recent = allQuestions
      .map((item) => item?.question)
      .filter(Boolean)
      .slice(-10)
      .join(" | ");

    const additionalInstructions = allQuestions.length
      ? [
          `Already created ${allQuestions.length} of ${total} questions from this source.`,
          `Generate exactly ${need} NEW distinct questions grounded in the source.`,
          recent ? `Avoid repeating these topics: ${recent}` : "",
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

    let batch = [];
    let roundPayload = null;
    let roundAttempts = 0;

    while (roundAttempts < DOCUMENT_MAX_ROUND_ATTEMPTS) {
      roundAttempts += 1;
      assertNotAborted();
      try {
        const headers = await getAuthHeaders(true, {
          forceRefresh: allQuestions.length === 0 && roundAttempts === 1,
        });
        const res = await fetchAuthedWithRetry(
          `${API_BASE}/assessment-ai/generate-from-source-text`,
          {
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
          }
        );

        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          lastError = new Error(formatApiError(payload, "Failed to generate from source", res.status));
          const message = String(lastError.message || "").toLowerCase();
          const retryable =
            res.status === 429 ||
            res.status >= 500 ||
            message.includes("quota") ||
            message.includes("rate") ||
            message.includes("timeout") ||
            message.includes("empty response") ||
            message.includes("try again");
          if (retryable && roundAttempts < DOCUMENT_MAX_ROUND_ATTEMPTS) {
            await sleep(1200 * roundAttempts + (res.status === 429 ? 4000 : 0));
            continue;
          }
          break;
        }

        roundPayload = payload;
        batch = Array.isArray(payload.questions) ? payload.questions : [];
        if (!batch.length) {
          lastError = new Error("AI did not return any usable questions from this source.");
          if (roundAttempts < DOCUMENT_MAX_ROUND_ATTEMPTS) {
            await sleep(900 * roundAttempts);
            continue;
          }
          break;
        }
        lastError = null;
        break;
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        lastError = isBackendUnreachable(error)
          ? new Error(backendUnreachableMessage())
          : error;
        if (roundAttempts < DOCUMENT_MAX_ROUND_ATTEMPTS) {
          await sleep(1200 * roundAttempts);
          continue;
        }
        break;
      }
    }

    if (!batch.length) {
      consecutiveSoftFailures += 1;
      if (consecutiveSoftFailures >= DOCUMENT_MAX_SOFT_FAILURES) {
        break;
      }
      continue;
    }

    consecutiveSoftFailures = 0;

    if (!suggestedTitle && roundPayload?.suggestedTitle) {
      suggestedTitle = roundPayload.suggestedTitle;
    }
    if (!suggestedDescription && roundPayload?.suggestedDescription) {
      suggestedDescription = roundPayload.suggestedDescription;
    }
    meta = {
      ...(roundPayload?.meta || {}),
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

    if (addedThisRound === 0) {
      consecutiveSoftFailures += 1;
      if (consecutiveSoftFailures >= DOCUMENT_MAX_SOFT_FAILURES) break;
    }
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
          ? `Generated ${finalQuestions.length} of ${total} source questions${
              lastError?.message ? ` (${lastError.message})` : ""
            }. You can generate again to add more.`
          : null,
      mode: "document_source_material_client_batched",
    },
  };
}
