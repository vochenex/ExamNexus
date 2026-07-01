const { Agent, fetch: undiciFetch } = require("undici");

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_CHAT_TIMEOUT_MS = 300000;
const DEFAULT_DOCUMENT_TIMEOUT_MS = 600000;
const GEMINI_RETRY_DELAYS_MS = [0, 3000, 6000];

function getChatTimeoutMs() {
  const configured = Number(process.env.AI_CHAT_TIMEOUT_MS);
  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }
  return DEFAULT_CHAT_TIMEOUT_MS;
}

function getDocumentTimeoutMs() {
  const configured = Number(process.env.AI_DOCUMENT_TIMEOUT_MS);
  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }
  return DEFAULT_DOCUMENT_TIMEOUT_MS;
}

function getGeminiAgent(timeoutMs) {
  return new Agent({
    connectTimeout: Math.min(timeoutMs, 120000),
    headersTimeout: timeoutMs,
    bodyTimeout: timeoutMs,
  });
}

function getGeminiModel() {
  return String(
    process.env.GEMINI_MODEL || process.env.GEMINI_ASSESSMENT_MODEL || DEFAULT_GEMINI_MODEL
  ).trim();
}

function getGeminiApiKey() {
  return String(
    process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_GEMINI_API_KEY ||
      ""
  ).trim();
}

function getGeminiRuntimeConfig() {
  const apiKey = getGeminiApiKey();
  if (!validateGeminiApiKey(apiKey)) {
    return null;
  }

  return {
    provider: "gemini",
    model: getGeminiModel(),
    apiKey,
  };
}

function isTimeoutError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  const code = String(error?.code || error?.cause?.code || "").toLowerCase();

  return (
    error?.name === "AbortError" ||
    code === "timeout" ||
    code === "und_err_headers_timeout" ||
    code === "und_err_body_timeout" ||
    message.includes("timeout") ||
    message.includes("took too long")
  );
}

function isConnectionError(error) {
  if (isTimeoutError(error)) {
    return false;
  }

  const message = String(error?.message || error || "").toLowerCase();
  const code = String(error?.code || error?.cause?.code || "").toLowerCase();

  return (
    code === "econnrefused" ||
    code === "enotfound" ||
    code === "econnreset" ||
    code === "und_err_connect_timeout" ||
    code === "network_error" ||
    message.includes("econnrefused") ||
    message.includes("econnreset") ||
    message.includes("fetch failed") ||
    message.includes("cannot connect") ||
    message.includes("connection refused") ||
    message.includes("connect timeout")
  );
}

function isTransientGeminiError(error) {
  return isTimeoutError(error) || isConnectionError(error);
}

function formatGeminiNetworkError() {
  return "Cannot reach Gemini right now. Check your internet connection and try again in a moment.";
}

function formatGeminiProcessingTimeoutError(isDocument) {
  if (isDocument) {
    return "Gemini took too long to analyze this document. Try a shorter file, or wait and try again.";
  }
  return "Gemini took too long to respond. Try fewer questions or a shorter prompt.";
}

function formatGeminiConfigError() {
  return "Gemini is not configured. Add GEMINI_API_KEY to backend/.env (not the root .env file), then restart the backend from the backend folder.";
}

function validateGeminiApiKey(apiKey) {
  const key = String(apiKey || "").trim();
  if (!key) return false;
  // Google AI Studio keys usually start with AIza; warn in status if unusual.
  return key.length >= 20;
}

function assertGeminiConfigured() {
  const config = getGeminiRuntimeConfig();
  if (!config) {
    const error = new Error(formatGeminiConfigError());
    error.statusCode = 503;
    throw error;
  }
  return config;
}

async function postJsonWithTimeout(urlString, body, timeoutMs, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const agent = getGeminiAgent(timeoutMs);

  try {
    const response = await undiciFetch(urlString, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      dispatcher: agent,
    });

    const raw = await response.text();

    if (response.status >= 400) {
      let detail = raw;
      try {
        const parsed = JSON.parse(raw);
        detail =
          parsed?.error?.message ||
          parsed?.error ||
          parsed?.message ||
          raw;
      } catch {
        // keep raw text
      }
      const error = new Error(
        typeof detail === "string" ? detail : "AI request failed"
      );
      error.statusCode = response.status;
      throw error;
    }

    try {
      return JSON.parse(raw);
    } catch (parseError) {
      throw parseError;
    }
  } catch (error) {
    if (error?.name === "AbortError") {
      throw Object.assign(new Error("AI request timed out."), {
        statusCode: 504,
        code: "TIMEOUT",
      });
    }
    throw error;
  } finally {
    clearTimeout(timer);
    await agent.close().catch(() => {});
  }
}

function messagesToGeminiPayload(messages) {
  let systemInstruction = null;
  const contents = [];

  for (const message of messages) {
    const text = String(message?.content || "");
    if (!text) continue;

    if (message.role === "system") {
      systemInstruction = { parts: [{ text }] };
      continue;
    }

    if (message.role === "assistant") {
      contents.push({ role: "model", parts: [{ text }] });
      continue;
    }

    contents.push({ role: "user", parts: [{ text }] });
  }

  if (!contents.length) {
    contents.push({ role: "user", parts: [{ text: "Respond with valid JSON only." }] });
  }

  return { systemInstruction, contents };
}

async function requestGeminiChatCompletion(
  config,
  { messages, temperature, jsonMode, timeoutMs, isDocument = false }
) {
  const effectiveTimeout = timeoutMs || getChatTimeoutMs();
  const { systemInstruction, contents } = messagesToGeminiPayload(messages);

  const body = {
    contents,
    generationConfig: {
      temperature,
      ...(jsonMode ? { responseMimeType: "application/json" } : {}),
    },
  };

  if (systemInstruction) {
    body.systemInstruction = systemInstruction;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    config.model
  )}:generateContent?key=${encodeURIComponent(config.apiKey)}`;

  let lastError = null;

  for (const delayMs of GEMINI_RETRY_DELAYS_MS) {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    try {
      const data = await postJsonWithTimeout(url, body, effectiveTimeout);
      const text =
        data?.candidates?.[0]?.content?.parts
          ?.map((part) => String(part?.text || ""))
          .join("") || "";

      if (!text.trim()) {
        const blockReason = data?.promptFeedback?.blockReason;
        throw new Error(
          blockReason
            ? `Gemini blocked the request: ${blockReason}`
            : "Gemini returned an empty response."
        );
      }

      return text;
    } catch (error) {
      lastError = error;

      if (error?.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
        throw error;
      }

      if (!isTransientGeminiError(error)) {
        throw error;
      }
    }
  }

  const error = lastError || new Error("Gemini request failed");
  if (isConnectionError(error)) {
    const wrapped = new Error(formatGeminiNetworkError());
    wrapped.statusCode = 503;
    wrapped.cause = error;
    throw wrapped;
  }

  if (isTimeoutError(error)) {
    const wrapped = new Error(formatGeminiProcessingTimeoutError(isDocument));
    wrapped.statusCode = 504;
    wrapped.cause = error;
    throw wrapped;
  }

  throw error;
}

async function requestChatCompletion({
  messages,
  temperature = 0.4,
  jsonMode = true,
  timeoutMs,
  isDocument = false,
}) {
  const config = assertGeminiConfigured();
  const content = await requestGeminiChatCompletion(config, {
    messages,
    temperature,
    jsonMode,
    timeoutMs,
    isDocument,
  });

  return {
    content,
    provider: config.provider,
    model: config.model,
  };
}

async function requestPromptChatCompletion(options) {
  return requestChatCompletion(options);
}

async function requestDocumentChatCompletion(options) {
  return requestChatCompletion({
    ...options,
    timeoutMs: getDocumentTimeoutMs(),
    isDocument: true,
  });
}

async function getAiServiceStatus() {
  const rawKey = getGeminiApiKey();
  const gemini = getGeminiRuntimeConfig();
  const configured = Boolean(gemini);

  let error = null;
  if (!configured) {
    if (!rawKey) {
      error =
        "Gemini API key is missing. Add GEMINI_API_KEY to backend/.env (not the project root .env), then restart the backend.";
    } else if (!rawKey.startsWith("AIza")) {
      error =
        'Gemini API key format looks unusual. Create a key at https://aistudio.google.com/apikey — it should start with "AIza".';
    } else {
      error = formatGeminiConfigError();
    }
  }

  return {
    ok: configured,
    configured,
    provider: "gemini",
    model: gemini?.model || getGeminiModel(),
    promptProvider: "gemini",
    documentProvider: "gemini",
    promptModel: gemini?.model || getGeminiModel(),
    documentModel: gemini?.model || getGeminiModel(),
    gemini: {
      configured,
      model: gemini?.model || getGeminiModel(),
      error: configured ? null : formatGeminiConfigError(),
    },
    error: configured ? null : error,
  };
}

module.exports = {
  getGeminiModel,
  getGeminiRuntimeConfig,
  assertGeminiConfigured,
  requestChatCompletion,
  requestPromptChatCompletion,
  requestDocumentChatCompletion,
  getAiServiceStatus,
  formatGeminiConfigError,
};
