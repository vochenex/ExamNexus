const { Agent, fetch: undiciFetch } = require("undici");

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_CHAT_TIMEOUT_MS = 300000;
const DEFAULT_DOCUMENT_TIMEOUT_MS = 600000;
const GEMINI_RETRY_DELAYS_MS = [0, 3000, 6000];
const GROQ_RETRY_DELAYS_MS = [0, 2000, 4000];
const GEMINI_QUOTA_MAX_ATTEMPTS = 10;
const GROQ_QUOTA_MAX_ATTEMPTS = 6;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isQuotaError(error) {
  const status = Number(error?.statusCode);
  const message = String(error?.message || "").toLowerCase();
  return (
    status === 429 ||
    message.includes("quota exceeded") ||
    message.includes("rate limit") ||
    message.includes("rate-limit") ||
    message.includes("resource_exhausted") ||
    message.includes("too many requests")
  );
}

function isGroqJsonFailure(error) {
  if (!error) return false;
  const message = String(error?.message || "").toLowerCase();
  const code = String(error?.code || error?.errorCode || "").toLowerCase();
  if (
    code === "json_validate_failed" ||
    message.includes("failed to generate json") ||
    message.includes("json_validate") ||
    message.includes("failed_generation") ||
    message.includes("could not return valid question json")
  ) {
    return true;
  }
  if (error?.cause && error.cause !== error) {
    return isGroqJsonFailure(error.cause);
  }
  return false;
}

function formatGroqJsonFailureError() {
  return "The AI could not return valid question JSON. Try a shorter or clearer prompt, generate fewer questions, or try again in a moment.";
}

function parseQuotaRetryMs(error) {
  const message = String(error?.message || "");
  const match = message.match(/retry in ([\d.]+)s/i);
  if (match) {
    const seconds = Number.parseFloat(match[1]);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(120000, Math.ceil(seconds * 1000) + 1000);
    }
  }
  return 62000;
}

function formatGeminiQuotaError(retryMs) {
  const seconds = Math.max(1, Math.ceil(retryMs / 1000));
  return `Gemini free-tier limit reached (20 requests/min). Wait about ${seconds} seconds and try again, or generate fewer questions at once.`;
}

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

function formatGroqConfigError() {
  return "Groq is not configured. Add GROQ_API_KEY to backend/.env (get a free key at https://console.groq.com), then restart the backend.";
}

function formatGroqQuotaError(retryMs) {
  const seconds = Math.max(1, Math.ceil(retryMs / 1000));
  return `Groq rate limit reached. Wait about ${seconds} seconds and try again, or generate fewer questions at once.`;
}

function formatGroqNetworkError() {
  return "Cannot reach Groq right now. Check your internet connection and try again in a moment.";
}

function formatGroqProcessingTimeoutError() {
  return "Groq took too long to respond. Try fewer questions or a shorter prompt.";
}

function validateGeminiApiKey(apiKey) {
  const key = String(apiKey || "").trim();
  if (!key) return false;
  // Google AI Studio keys usually start with AIza; warn in status if unusual.
  return key.length >= 20;
}

function getGroqModel() {
  return String(process.env.GROQ_MODEL || process.env.GROQ_ASSESSMENT_MODEL || DEFAULT_GROQ_MODEL).trim();
}

function getGroqApiKey() {
  return String(process.env.GROQ_API_KEY || "").trim();
}

function validateGroqApiKey(apiKey) {
  const key = String(apiKey || "").trim();
  if (!key) return false;
  return key.length >= 20;
}

function getGroqRuntimeConfig() {
  const apiKey = getGroqApiKey();
  if (!validateGroqApiKey(apiKey)) {
    return null;
  }

  return {
    provider: "groq",
    model: getGroqModel(),
    apiKey,
  };
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

function assertPromptAiConfigured() {
  const groq = getGroqRuntimeConfig();
  if (groq) {
    return groq;
  }
  return assertGeminiConfigured();
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
      let errorCode = null;
      let failedGeneration = null;
      try {
        const parsed = JSON.parse(raw);
        const nested = parsed?.error;
        detail =
          (typeof nested === "object" && nested?.message) ||
          (typeof nested === "string" ? nested : null) ||
          parsed?.message ||
          raw;
        errorCode =
          (typeof nested === "object" && nested?.code) ||
          parsed?.code ||
          null;
        failedGeneration =
          (typeof nested === "object" && nested?.failed_generation) ||
          parsed?.failed_generation ||
          null;
      } catch {
        // keep raw text
      }
      const error = new Error(
        typeof detail === "string" ? detail : "AI request failed"
      );
      error.statusCode = response.status;
      if (errorCode) error.code = errorCode;
      if (failedGeneration) error.failedGeneration = failedGeneration;
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

  for (let attempt = 0; attempt < GEMINI_QUOTA_MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 0 && !isQuotaError(lastError)) {
      const delayMs =
        GEMINI_RETRY_DELAYS_MS[Math.min(attempt, GEMINI_RETRY_DELAYS_MS.length - 1)] || 0;
      if (delayMs > 0) {
        await sleep(delayMs);
      }
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

      if (isQuotaError(error)) {
        const waitMs = parseQuotaRetryMs(error);
        if (attempt < GEMINI_QUOTA_MAX_ATTEMPTS - 1) {
          await sleep(waitMs);
          continue;
        }
        const wrapped = new Error(formatGeminiQuotaError(waitMs));
        wrapped.statusCode = 429;
        wrapped.cause = error;
        throw wrapped;
      }

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

async function requestGroqChatCompletion(
  config,
  { messages, temperature, jsonMode, timeoutMs, allowJsonFallback = true }
) {
  const effectiveTimeout = timeoutMs || getChatTimeoutMs();
  const body = {
    model: config.model,
    messages,
    temperature,
    ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
  };

  let lastError = null;

  for (let attempt = 0; attempt < GROQ_QUOTA_MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 0 && !isQuotaError(lastError)) {
      const delayMs =
        GROQ_RETRY_DELAYS_MS[Math.min(attempt, GROQ_RETRY_DELAYS_MS.length - 1)] || 0;
      if (delayMs > 0) {
        await sleep(delayMs);
      }
    }

    try {
      const data = await postJsonWithTimeout(
        GROQ_API_URL,
        body,
        effectiveTimeout,
        { Authorization: `Bearer ${config.apiKey}` }
      );
      const text = String(data?.choices?.[0]?.message?.content || "");

      if (!text.trim()) {
        throw new Error("Groq returned an empty response.");
      }

      return text;
    } catch (error) {
      lastError = error;

      if (isQuotaError(error)) {
        const waitMs = parseQuotaRetryMs(error);
        if (attempt < GROQ_QUOTA_MAX_ATTEMPTS - 1) {
          await sleep(waitMs);
          continue;
        }
        const wrapped = new Error(formatGroqQuotaError(waitMs));
        wrapped.statusCode = 429;
        wrapped.cause = error;
        throw wrapped;
      }

      // Groq json_object mode often fails validation; retry without forced JSON.
      if (jsonMode && allowJsonFallback && isGroqJsonFailure(error)) {
        return requestGroqChatCompletion(config, {
          messages,
          temperature: Math.min(Number(temperature) || 0.4, 0.2),
          jsonMode: false,
          timeoutMs: effectiveTimeout,
          allowJsonFallback: false,
        });
      }

      if (error?.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
        if (isGroqJsonFailure(error)) {
          const wrapped = new Error(formatGroqJsonFailureError());
          wrapped.statusCode = 502;
          wrapped.code = "json_validate_failed";
          wrapped.cause = error;
          throw wrapped;
        }
        throw error;
      }

      if (!isTransientGeminiError(error)) {
        throw error;
      }
    }
  }

  const error = lastError || new Error("Groq request failed");
  if (isConnectionError(error)) {
    const wrapped = new Error(formatGroqNetworkError());
    wrapped.statusCode = 503;
    wrapped.cause = error;
    throw wrapped;
  }

  if (isTimeoutError(error)) {
    const wrapped = new Error(formatGroqProcessingTimeoutError());
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
  const groq = getGroqRuntimeConfig();
  if (groq) {
    try {
      const content = await requestGroqChatCompletion(groq, options);
      return {
        content,
        provider: groq.provider,
        model: groq.model,
      };
    } catch (error) {
      // If Groq still cannot produce usable JSON, fall back to Gemini when available.
      if (isGroqJsonFailure(error) && getGeminiRuntimeConfig()) {
        console.warn(
          "[assessment-ai] Groq JSON generation failed; falling back to Gemini for prompt."
        );
        return requestChatCompletion(options);
      }
      throw error;
    }
  }

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
  const rawGeminiKey = getGeminiApiKey();
  const rawGroqKey = getGroqApiKey();
  const gemini = getGeminiRuntimeConfig();
  const groq = getGroqRuntimeConfig();
  const documentConfigured = Boolean(gemini);
  const promptConfigured = Boolean(groq || gemini);
  const configured = documentConfigured && promptConfigured;

  const promptProvider = groq ? "groq" : gemini ? "gemini" : "gemini";
  const promptModel = groq?.model || gemini?.model || getGroqModel();
  const documentModel = gemini?.model || getGeminiModel();

  let error = null;
  if (!configured) {
    if (!documentConfigured) {
      if (!rawGeminiKey) {
        error =
          "Gemini API key is missing (required for document analysis). Add GEMINI_API_KEY to backend/.env, then restart the backend.";
      } else if (!rawGeminiKey.startsWith("AIza") && rawGeminiKey.length < 20) {
        error =
          'Gemini API key format looks unusual. Create a key at https://aistudio.google.com/apikey — it should start with "AIza".';
      } else {
        error = formatGeminiConfigError();
      }
    } else if (!promptConfigured) {
      error =
        "No prompt AI configured. Add GROQ_API_KEY or GEMINI_API_KEY to backend/.env, then restart the backend.";
    }
  }

  return {
    ok: configured,
    configured,
    provider: promptProvider,
    model: promptModel,
    promptProvider,
    documentProvider: documentConfigured ? "gemini" : "gemini",
    promptModel,
    documentModel,
    gemini: {
      configured: documentConfigured,
      model: documentModel,
      error: documentConfigured ? null : formatGeminiConfigError(),
    },
    groq: {
      configured: Boolean(groq),
      model: groq?.model || getGroqModel(),
      error: groq
        ? null
        : rawGroqKey
          ? "Groq API key looks invalid."
          : "Groq not configured (prompts will use Gemini).",
    },
    error: configured ? null : error,
  };
}

module.exports = {
  getGeminiModel,
  getGroqModel,
  getGeminiRuntimeConfig,
  getGroqRuntimeConfig,
  assertGeminiConfigured,
  assertPromptAiConfigured,
  requestChatCompletion,
  requestPromptChatCompletion,
  requestDocumentChatCompletion,
  getAiServiceStatus,
  formatGeminiConfigError,
  formatGroqConfigError,
};
