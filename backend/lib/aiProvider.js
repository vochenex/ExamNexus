const { Agent, fetch: undiciFetch } = require("undici");

const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";
// Prompt generation uses a separate key; same current Flash generation by default.
const DEFAULT_GEMINI_PROMPT_MODEL = "gemini-3.6-flash";
// llama-3.1-8b-instant / llama-3.3-70b-versatile were retired for free/developer
// tiers on 2026-08-16. gpt-oss ids MUST include the openai/ prefix.
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";
const FALLBACK_GROQ_MODEL = "openai/gpt-oss-120b";
const SECONDARY_FALLBACK_GROQ_MODEL = "qwen/qwen3.6-27b";
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
    status === 503 ||
    message.includes("quota exceeded") ||
    message.includes("rate limit") ||
    message.includes("rate-limit") ||
    message.includes("resource_exhausted") ||
    message.includes("too many requests") ||
    message.includes("high demand") ||
    message.includes("over capacity") ||
    message.includes("capacity") ||
    message.includes("temporarily unavailable") ||
    message.includes("try again later")
  );
}

function isHighDemandError(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("high demand") ||
    message.includes("over capacity") ||
    message.includes("capacity") ||
    message.includes("temporarily unavailable")
  );
}

function isModelUnavailableError(error) {
  const status = Number(error?.statusCode);
  const message = String(error?.message || "").toLowerCase();
  const code = String(error?.code || error?.errorCode || "").toLowerCase();
  return (
    status === 404 ||
    code === "model_not_found" ||
    message.includes("model_not_found") ||
    message.includes("no longer available") ||
    message.includes("does not exist") ||
    message.includes("do not have access") ||
    message.includes("you do not have access") ||
    (message.includes("model") && message.includes("not found"))
  );
}

function normalizeGroqModelId(value) {
  const raw = String(value || "").trim();
  if (!raw) return DEFAULT_GROQ_MODEL;
  // Common misconfig: omitting the openai/ org prefix.
  if (raw === "gpt-oss-20b" || raw === "gpt-oss-120b") {
    return `openai/${raw}`;
  }
  if (raw === "gpt-oss-20B" || raw === "gpt-oss-120B") {
    return `openai/${raw.toLowerCase()}`;
  }
  return raw;
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
  return (
    String(
      process.env.GEMINI_DOCUMENT_MODEL ||
        process.env.GEMINI_MODEL ||
        process.env.GEMINI_ASSESSMENT_MODEL ||
        DEFAULT_GEMINI_MODEL
    ).trim() || DEFAULT_GEMINI_MODEL
  );
}

/** Flash model used for teacher topic/prompt generation (separate from documents). */
function getGeminiPromptModel() {
  return (
    String(process.env.GEMINI_PROMPT_MODEL || DEFAULT_GEMINI_PROMPT_MODEL).trim() ||
    DEFAULT_GEMINI_PROMPT_MODEL
  );
}

function preferGroqForPrompts() {
  return String(process.env.AI_PROMPT_PROVIDER || "").trim().toLowerCase() === "groq";
}

/** Document uploads — dedicated key (legacy GEMINI_API_KEY still accepted). */
function getGeminiDocumentApiKey() {
  return String(
    process.env.GEMINI_DOCUMENT_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_GEMINI_API_KEY ||
      ""
  ).trim();
}

/** Topic/prompt generation — must be a different key from documents. */
function getGeminiPromptApiKey() {
  return String(process.env.GEMINI_PROMPT_API_KEY || "").trim();
}

function getGeminiDocumentRuntimeConfig() {
  const apiKey = getGeminiDocumentApiKey();
  if (!validateGeminiApiKey(apiKey)) {
    return null;
  }

  return {
    provider: "gemini",
    purpose: "document",
    model: getGeminiModel(),
    apiKey,
  };
}

function getGeminiPromptRuntimeConfig() {
  const apiKey = getGeminiPromptApiKey();
  if (!validateGeminiApiKey(apiKey)) {
    return null;
  }

  return {
    provider: "gemini",
    purpose: "prompt",
    model: getGeminiPromptModel(),
    apiKey,
  };
}

/** @deprecated Prefer getGeminiDocumentRuntimeConfig — kept for older imports. */
function getGeminiRuntimeConfig() {
  return getGeminiDocumentRuntimeConfig();
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

function formatGeminiDocumentConfigError() {
  return "Document AI is not configured. Add GEMINI_DOCUMENT_API_KEY (or GEMINI_API_KEY) to backend/.env, then restart the backend.";
}

function formatGeminiPromptConfigError() {
  return "Prompt AI is not configured. Add GEMINI_PROMPT_API_KEY to backend/.env (a separate Google AI Studio key from documents), then restart the backend.";
}

function formatGeminiSharedKeyError() {
  return "Prompt and document AI must use different API keys. Create a second key at https://aistudio.google.com/apikey and set GEMINI_PROMPT_API_KEY separately from GEMINI_DOCUMENT_API_KEY / GEMINI_API_KEY.";
}

function formatGeminiConfigError() {
  return formatGeminiDocumentConfigError();
}

function geminiKeysAreDistinct(promptKey, documentKey) {
  const prompt = String(promptKey || "").trim();
  const document = String(documentKey || "").trim();
  if (!prompt || !document) return true;
  return prompt !== document;
}

function formatGroqConfigError() {
  return "Groq is not configured. Add GROQ_API_KEY to backend/.env (get a free key at https://console.groq.com), then restart the backend.";
}

function formatGroqQuotaError(retryMs, error) {
  const seconds = Math.max(1, Math.ceil(retryMs / 1000));
  if (isHighDemandError(error)) {
    return `Groq is temporarily busy (high demand). Wait about ${seconds} seconds and try again, or generate fewer questions at once.`;
  }
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
  return normalizeGroqModelId(
    process.env.GROQ_MODEL || process.env.GROQ_ASSESSMENT_MODEL || DEFAULT_GROQ_MODEL
  );
}

function getGroqApiKey() {
  return String(process.env.GROQ_API_KEY || "").trim();
}

function validateGroqApiKey(apiKey) {
  const key = String(apiKey || "").trim();
  if (!key) return false;
  return key.length >= 20;
}

function getGroqFallbackModel() {
  return normalizeGroqModelId(
    process.env.GROQ_FALLBACK_MODEL || FALLBACK_GROQ_MODEL
  );
}

function getGroqSecondaryFallbackModel() {
  return normalizeGroqModelId(
    process.env.GROQ_SECONDARY_FALLBACK_MODEL || SECONDARY_FALLBACK_GROQ_MODEL
  );
}

function getGroqFallbackCandidates(primaryModel) {
  const primary = normalizeGroqModelId(primaryModel);
  const candidates = [
    getGroqFallbackModel(),
    getGroqSecondaryFallbackModel(),
    DEFAULT_GROQ_MODEL,
    "openai/gpt-oss-120b",
    "qwen/qwen3.6-27b",
    "qwen/qwen3.8-27b",
  ];
  return [...new Set(candidates.map(normalizeGroqModelId))].filter(
    (model) => model && model !== primary
  );
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

function assertGeminiDocumentConfigured() {
  const config = getGeminiDocumentRuntimeConfig();
  if (!config) {
    const error = new Error(formatGeminiDocumentConfigError());
    error.statusCode = 503;
    throw error;
  }
  return config;
}

function assertGeminiConfigured() {
  return assertGeminiDocumentConfigured();
}

function assertGeminiPromptKeyConfigured() {
  const config = getGeminiPromptRuntimeConfig();
  if (!config) {
    const error = new Error(formatGeminiPromptConfigError());
    error.statusCode = 503;
    throw error;
  }
  if (!geminiKeysAreDistinct(config.apiKey, getGeminiDocumentApiKey())) {
    const error = new Error(formatGeminiSharedKeyError());
    error.statusCode = 503;
    throw error;
  }
  return config;
}

function assertPromptAiConfigured() {
  if (preferGroqForPrompts()) {
    const groq = getGroqRuntimeConfig();
    if (groq) return groq;
  }

  const gemini = getGeminiPromptRuntimeConfig();
  if (gemini) {
    if (!geminiKeysAreDistinct(gemini.apiKey, getGeminiDocumentApiKey())) {
      const error = new Error(formatGeminiSharedKeyError());
      error.statusCode = 503;
      throw error;
    }
    return gemini;
  }

  const groq = getGroqRuntimeConfig();
  if (groq) return groq;

  const error = new Error(formatGeminiPromptConfigError());
  error.statusCode = 503;
  throw error;
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

    return JSON.parse(raw);
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

function geminiModelSupportsThinkingConfig(model) {
  return /^gemini-3/i.test(String(model || "").trim());
}

function extractGeminiResponseText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts) || !parts.length) {
    return "";
  }

  // Gemini 3.x may return thought parts — only keep final answer text.
  const answerParts = parts.filter(
    (part) => part && part.thought !== true && String(part.text || "").trim()
  );
  if (answerParts.length) {
    return answerParts.map((part) => String(part.text || "")).join("");
  }

  return parts
    .filter((part) => part && part.thought !== true)
    .map((part) => String(part?.text || ""))
    .join("");
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
      maxOutputTokens: Number.parseInt(process.env.GEMINI_MAX_OUTPUT_TOKENS, 10) || 8192,
      ...(geminiModelSupportsThinkingConfig(config.model)
        ? { thinkingConfig: { thinkingLevel: "minimal" } }
        : {}),
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
  let omitThinkingConfig = false;

  for (let attempt = 0; attempt < GEMINI_QUOTA_MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 0 && !isQuotaError(lastError)) {
      const delayMs =
        GEMINI_RETRY_DELAYS_MS[Math.min(attempt, GEMINI_RETRY_DELAYS_MS.length - 1)] || 0;
      if (delayMs > 0) {
        await sleep(delayMs);
      }
    }

    if (omitThinkingConfig && body.generationConfig?.thinkingConfig) {
      delete body.generationConfig.thinkingConfig;
    }

    try {
      const data = await postJsonWithTimeout(url, body, effectiveTimeout);
      const text = extractGeminiResponseText(data);

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

      const message = String(error?.message || "").toLowerCase();
      if (
        !omitThinkingConfig &&
        body.generationConfig?.thinkingConfig &&
        (message.includes("thinking") ||
          message.includes("thinkingconfig") ||
          message.includes("thinking_level") ||
          message.includes("thinkinglevel"))
      ) {
        omitThinkingConfig = true;
        continue;
      }

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
        if (isModelUnavailableError(error)) {
          const wrapped = new Error(
            `Gemini model "${config.model}" is no longer available. Set GEMINI_MODEL / GEMINI_PROMPT_MODEL to gemini-3.6-flash in backend/.env and on Vercel, then restart/redeploy.`
          );
          wrapped.statusCode = 400;
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
  const maxTokens = Number.parseInt(process.env.GROQ_MAX_TOKENS, 10);
  const body = {
    model: config.model,
    messages,
    temperature,
    // Without this, Groq often cuts mid-JSON and only a few questions parse.
    max_tokens: Number.isFinite(maxTokens) && maxTokens > 0 ? maxTokens : 8192,
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
        const wrapped = new Error(formatGroqQuotaError(waitMs, error));
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
  model = null,
  purpose = null,
}) {
  const resolvedPurpose =
    purpose || (isDocument ? "document" : "document");
  const config =
    resolvedPurpose === "prompt"
      ? assertGeminiPromptKeyConfigured()
      : assertGeminiDocumentConfigured();
  const resolvedModel = String(model || config.model).trim() || config.model;
  const content = await requestGeminiChatCompletion(
    { ...config, model: resolvedModel },
    {
      messages,
      temperature,
      jsonMode,
      timeoutMs,
      isDocument: resolvedPurpose === "document" || isDocument,
    }
  );

  return {
    content,
    provider: config.provider,
    model: resolvedModel,
  };
}

async function requestPromptViaGroq(options) {
  const groq = getGroqRuntimeConfig();
  if (!groq) {
    throw new Error(formatGroqConfigError());
  }

  let lastError = null;
  const modelsToTry = [groq.model, ...getGroqFallbackCandidates(groq.model)];

  for (const model of modelsToTry) {
    try {
      if (model !== groq.model) {
        console.warn(
          `[assessment-ai] Trying Groq model ${model} (after ${groq.model}).`
        );
      }
      const content = await requestGroqChatCompletion(
        { ...groq, model },
        options
      );
      return {
        content,
        provider: groq.provider,
        model,
      };
    } catch (error) {
      lastError = error;
      if (!isHighDemandError(error) && !isModelUnavailableError(error)) {
        break;
      }
    }
  }

  throw lastError || new Error(formatGroqConfigError());
}

async function requestPromptChatCompletion(options) {
  const gemini = getGeminiPromptRuntimeConfig();
  const geminiUsable =
    Boolean(gemini) &&
    geminiKeysAreDistinct(gemini.apiKey, getGeminiDocumentApiKey());
  const groq = getGroqRuntimeConfig();
  const forceGroq = preferGroqForPrompts();

  // Default: dedicated Gemini prompt key + Flash model. Groq only if forced or fallback.
  if (geminiUsable && !forceGroq) {
    try {
      return await requestChatCompletion({
        ...options,
        purpose: "prompt",
        model: getGeminiPromptModel(),
      });
    } catch (error) {
      if (groq) {
        console.warn(
          "[assessment-ai] Gemini prompt failed; falling back to Groq."
        );
        try {
          return await requestPromptViaGroq(options);
        } catch {
          throw error;
        }
      }
      throw error;
    }
  }

  if (forceGroq && groq) {
    try {
      return await requestPromptViaGroq(options);
    } catch (error) {
      if (geminiUsable) {
        console.warn(
          "[assessment-ai] Groq prompt failed; falling back to Gemini Flash."
        );
        return requestChatCompletion({
          ...options,
          purpose: "prompt",
          model: getGeminiPromptModel(),
        });
      }
      throw error;
    }
  }

  if (gemini && !geminiUsable) {
    const error = new Error(formatGeminiSharedKeyError());
    error.statusCode = 503;
    throw error;
  }

  return requestChatCompletion({
    ...options,
    purpose: "prompt",
    model: getGeminiPromptModel(),
  });
}

async function requestDocumentChatCompletion(options = {}) {
  return requestChatCompletion({
    ...options,
    purpose: "document",
    timeoutMs: options.timeoutMs || getDocumentTimeoutMs(),
    isDocument: true,
  });
}

async function getAiServiceStatus() {
  const rawDocumentKey = getGeminiDocumentApiKey();
  const rawPromptKey = getGeminiPromptApiKey();
  const rawGroqKey = getGroqApiKey();
  const documentGemini = getGeminiDocumentRuntimeConfig();
  const promptGemini = getGeminiPromptRuntimeConfig();
  const groq = getGroqRuntimeConfig();
  const keysDistinct = geminiKeysAreDistinct(rawPromptKey, rawDocumentKey);
  const documentConfigured = Boolean(documentGemini);
  const promptGeminiConfigured = Boolean(promptGemini) && keysDistinct;
  const promptConfigured =
    promptGeminiConfigured || (preferGroqForPrompts() && Boolean(groq));
  const configured = documentConfigured && promptConfigured;

  const useGroqPrompt = preferGroqForPrompts() && Boolean(groq);
  const promptProvider = useGroqPrompt ? "groq" : "gemini";
  const promptModel = useGroqPrompt
    ? groq?.model || getGroqModel()
    : getGeminiPromptModel();
  const documentModel = documentGemini?.model || getGeminiModel();

  let error = null;
  if (!configured) {
    if (!documentConfigured) {
      if (!rawDocumentKey) {
        error =
          "Document Gemini key is missing. Add GEMINI_DOCUMENT_API_KEY (or GEMINI_API_KEY) to backend/.env, then restart the backend.";
      } else if (
        !rawDocumentKey.startsWith("AIza") &&
        rawDocumentKey.length < 20
      ) {
        error =
          'Document Gemini API key format looks unusual. Create a key at https://aistudio.google.com/apikey — it should start with "AIza".';
      } else {
        error = formatGeminiDocumentConfigError();
      }
    } else if (rawPromptKey && !keysDistinct) {
      error = formatGeminiSharedKeyError();
    } else if (!promptConfigured) {
      error = formatGeminiPromptConfigError();
    }
  }

  return {
    ok: configured,
    configured,
    provider: promptProvider,
    model: promptModel,
    promptProvider,
    documentProvider: "gemini",
    promptModel,
    documentModel,
    gemini: {
      configured: documentConfigured,
      model: documentModel,
      error: documentConfigured ? null : formatGeminiDocumentConfigError(),
    },
    promptGemini: {
      configured: promptGeminiConfigured,
      model: getGeminiPromptModel(),
      error: promptGeminiConfigured
        ? null
        : rawPromptKey && !keysDistinct
          ? formatGeminiSharedKeyError()
          : formatGeminiPromptConfigError(),
    },
    groq: {
      configured: Boolean(groq),
      model: groq?.model || getGroqModel(),
      error: groq
        ? null
        : rawGroqKey
          ? "Groq API key looks invalid."
          : "Groq not configured (optional fallback for prompts).",
    },
    error: configured ? null : error,
  };
}

module.exports = {
  getGeminiModel,
  getGeminiPromptModel,
  getGroqModel,
  getGeminiRuntimeConfig,
  getGeminiDocumentRuntimeConfig,
  getGeminiPromptRuntimeConfig,
  getGroqRuntimeConfig,
  assertGeminiConfigured,
  assertGeminiDocumentConfigured,
  assertPromptAiConfigured,
  requestChatCompletion,
  requestPromptChatCompletion,
  requestDocumentChatCompletion,
  getAiServiceStatus,
  formatGeminiConfigError,
  formatGeminiDocumentConfigError,
  formatGeminiPromptConfigError,
  formatGroqConfigError,
};
