import { getAuthSession } from "./authUser";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

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
  return payload?.error || fallback || "AI request failed";
}

function isBackendUnreachable(error) {
  const message = String(error?.message || "");
  return (
    message.includes("Failed to fetch") ||
    message.includes("NetworkError") ||
    message.includes("fetch")
  );
}

export async function fetchAssessmentAiStatus() {
  try {
    let session = null;
    try {
      session = await getAuthSession();
    } catch {
      session = null;
    }

    if (session?.access_token) {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/assessment-ai/status`, { headers });
      const payload = await res.json().catch(() => ({}));

      if (res.status === 401 || res.status === 403) {
        return {
          configured: false,
          provider: payload.provider || null,
          model: payload.model || null,
          error: formatApiError(
            payload,
            "Sign in as approved faculty to use AI generation."
          ),
        };
      }

      if (!res.ok) {
        return {
          configured: false,
          provider: payload.provider || null,
          model: payload.model || null,
          error: formatApiError(payload, "AI service unavailable"),
        };
      }

      return {
        configured: Boolean(payload.configured),
        provider: payload.provider || null,
        model: payload.model || null,
        error: null,
      };
    }

    const res = await fetch(`${API_BASE}/assessment-ai/public-config`);
    const payload = await res.json().catch(() => ({}));

    return {
      configured: Boolean(payload.configured),
      provider: payload.provider || null,
      model: payload.model || null,
      error: payload.configured
        ? "Sign in as faculty to generate questions."
        : payload.error || "AI service unavailable",
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

function isOllamaProvider(provider) {
  return String(provider || "").toLowerCase() === "ollama";
}

async function generateOneQuestion({
  prompt,
  sourceText,
  formats,
  format,
  difficulty,
  stepIndex,
  totalSteps,
  additionalInstructions,
}) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/assessment-ai/generate-one`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      prompt,
      sourceText,
      formats,
      format,
      difficulty,
      stepIndex,
      totalSteps,
      additionalInstructions,
    }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(formatApiError(payload, "Failed to generate question"));
  }

  return payload;
}

async function generateWithOllamaSteps({
  prompt,
  sourceText,
  formats,
  questionCount,
  difficulty,
  additionalInstructions,
  onProgress,
}) {
  const total = Math.max(1, Number(questionCount) || 1);
  const questions = [];
  let suggestedTitle = "";
  let suggestedDescription = "";
  let meta = null;

  for (let step = 0; step < total; step += 1) {
    onProgress?.({ current: step + 1, total });

    const payload = await generateOneQuestion({
      prompt,
      sourceText,
      formats,
      difficulty,
      stepIndex: step,
      totalSteps: total,
      additionalInstructions,
    });

    if (payload.question) {
      questions.push(payload.question);
    }

    if (!suggestedTitle && payload.suggestedTitle) {
      suggestedTitle = payload.suggestedTitle;
    }
    if (!suggestedDescription && payload.suggestedDescription) {
      suggestedDescription = payload.suggestedDescription;
    }
    meta = payload.meta || meta;
  }

  if (!questions.length) {
    throw new Error("AI did not return any usable questions.");
  }

  return {
    success: true,
    suggestedTitle,
    suggestedDescription,
    questions,
    meta: {
      requestedCount: total,
      generatedCount: questions.length,
      formats,
      provider: meta?.provider || "ollama",
      model: meta?.model,
      batched: true,
    },
  };
}

export async function generateAssessmentFromPrompt({
  prompt,
  formats,
  questionCount,
  difficulty,
  additionalInstructions,
  onProgress,
}) {
  const status = await fetchAssessmentAiStatus();

  if (isOllamaProvider(status.provider)) {
    try {
      return await generateWithOllamaSteps({
        prompt,
        formats,
        questionCount,
        difficulty,
        additionalInstructions,
        onProgress,
      });
    } catch (error) {
      if (isBackendUnreachable(error)) {
        throw new Error(
          "Cannot reach the backend. Start it with npm start in the backend folder."
        );
      }
      throw error;
    }
  }

  const headers = await getAuthHeaders();

  let res;
  try {
    res = await fetch(`${API_BASE}/assessment-ai/generate-from-prompt`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        prompt,
        formats,
        questionCount,
        difficulty,
        additionalInstructions,
      }),
    });
  } catch (error) {
    if (isBackendUnreachable(error)) {
      throw new Error(
        "Cannot reach the backend. Start it with npm start in the backend folder."
      );
    }
    throw error;
  }

  const payload = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(formatApiError(payload, "Failed to generate questions"));
  }

  return payload;
}

export async function generateAssessmentFromDocument({
  file,
  formats,
  questionCount,
  difficulty,
  additionalInstructions,
  onProgress,
}) {
  if (!file) {
    throw new Error("Choose a PDF or Word (.docx) file to upload.");
  }

  const status = await fetchAssessmentAiStatus();

  if (isOllamaProvider(status.provider)) {
    const session = await getAuthSession();
    if (!session?.access_token) {
      throw new Error("Your session expired. Please sign in again.");
    }

    const extractForm = new FormData();
    extractForm.append("file", file);

    let extractRes;
    try {
      extractRes = await fetch(`${API_BASE}/assessment-ai/extract-document`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: extractForm,
      });
    } catch (error) {
      if (isBackendUnreachable(error)) {
        throw new Error(
          "Cannot reach the backend. Start it with npm start in the backend folder."
        );
      }
      throw error;
    }

    const extracted = await extractRes.json().catch(() => ({}));
    if (!extractRes.ok) {
      throw new Error(formatApiError(extracted, "Failed to read document"));
    }

    return generateWithOllamaSteps({
      sourceText: extracted.text,
      formats,
      questionCount,
      difficulty,
      additionalInstructions,
      onProgress,
    });
  }

  const session = await getAuthSession();
  if (!session?.access_token) {
    throw new Error("Your session expired. Please sign in again.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("formats", JSON.stringify(formats || []));
  formData.append("questionCount", String(questionCount ?? 8));
  formData.append("difficulty", difficulty || "medium");
  if (additionalInstructions) {
    formData.append("additionalInstructions", additionalInstructions);
  }

  let res;
  try {
    res = await fetch(`${API_BASE}/assessment-ai/generate-from-document`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: formData,
    });
  } catch (error) {
    if (isBackendUnreachable(error)) {
      throw new Error(
        "Cannot reach the backend. Start it with npm start in the backend folder."
      );
    }
    throw error;
  }

  const payload = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(formatApiError(payload, "Failed to generate from document"));
  }

  return payload;
}
