import { getAuthSession } from "./authUser";
import { resolvePromptGenerationSettings } from "./promptPreferences";

import { API_BASE } from "./apiBase.js";

const AI_REQUEST_TIMEOUT_MS = 600000;

async function fetchWithTimeout(url, options = {}, timeoutMs = AI_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(
        "The request took too long. Check your internet connection and try again."
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function getAuthHeaders(json = true) {
  const session = await getAuthSession();
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
          "AI is not ready. Add GEMINI_API_KEY to backend/.env, then restart the backend.",
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
        ? "Cannot reach the backend. Start it with npm start in the backend folder."
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
}) {
  const trimmed = String(prompt || "").trim();
  const resolved = resolvePromptGenerationSettings({
    prompt: trimmed,
    questionCount,
    difficulty,
    formats,
  });

  const headers = await getAuthHeaders();

  let res;
  const stopWaiting = startWaitingProgress({
    onProgress,
    phase: "prompt",
    total: resolved.questionCount,
  });

  try {
    res = await fetchWithTimeout(`${API_BASE}/assessment-ai/generate-from-prompt`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        prompt: trimmed,
        formats: resolved.formats,
        questionCount: resolved.questionCount,
        difficulty: resolved.difficulty,
      }),
    });
  } catch (error) {
    stopWaiting();
    if (isBackendUnreachable(error)) {
      throw new Error(
        "Cannot reach the backend. Start it with npm start in the backend folder."
      );
    }
    throw error;
  } finally {
    stopWaiting();
  }

  const payload = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(formatApiError(payload, "Failed to generate questions"));
  }

  const questions = Array.isArray(payload.questions) ? payload.questions : [];
  if (!questions.length) {
    throw new Error("AI did not return any usable questions.");
  }

  await revealQuestionsIncrementally({
    questions,
    onProgress,
    onQuestionGenerated,
    phase: "prompt",
    payload,
  });

  return {
    ...payload,
    resolvedSettings: payload.resolvedSettings || resolved,
  };
}

export async function generateAssessmentFromDocument({
  file,
  onProgress,
  onQuestionGenerated,
}) {
  if (!file) {
    throw new Error("Choose a PDF or Word (.docx) file to upload.");
  }

  const session = await getAuthSession();
  if (!session?.access_token) {
    throw new Error("Your session expired. Please sign in again.");
  }

  const formData = new FormData();
  formData.append("file", file);

  let res;
  const stopWaiting = startWaitingProgress({
    onProgress,
    phase: "reading",
  });

  try {
    res = await fetchWithTimeout(`${API_BASE}/assessment-ai/analyze-document`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: formData,
    });
  } catch (error) {
    stopWaiting();
    if (isBackendUnreachable(error)) {
      throw new Error(
        "Cannot reach the backend. Start it with npm start in the backend folder."
      );
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
