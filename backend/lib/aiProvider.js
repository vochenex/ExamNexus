const { OpenAI } = require("openai");

const DEFAULT_OLLAMA_BASE = "http://localhost:11434";
const DEFAULT_OLLAMA_MODEL = "llama3";
const DEFAULT_CHAT_TIMEOUT_MS = 300000;
const DEFAULT_OLLAMA_CHAT_TIMEOUT_MS = 600000;

function getChatTimeoutMs(provider) {
  const configured = Number(process.env.AI_CHAT_TIMEOUT_MS);
  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }

  return provider === "ollama"
    ? DEFAULT_OLLAMA_CHAT_TIMEOUT_MS
    : DEFAULT_CHAT_TIMEOUT_MS;
}

function getAiProviderName() {
  return String(process.env.AI_PROVIDER || "ollama").trim().toLowerCase();
}

function getOllamaRootUrl() {
  const configured =
    process.env.OLLAMA_BASE_URL ||
    process.env.OLLAMA_HOST ||
    DEFAULT_OLLAMA_BASE;

  return String(configured)
    .trim()
    .replace(/\/v1\/?$/i, "")
    .replace(/\/$/, "");
}

function getOllamaOpenAiBaseUrl() {
  return `${getOllamaRootUrl()}/v1`;
}

function getConfiguredModel() {
  const provider = getAiProviderName();

  if (provider === "openai") {
    return String(process.env.OPENAI_ASSESSMENT_MODEL || "gpt-4o-mini").trim();
  }

  return String(process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL).trim();
}

function getAiRuntimeConfig() {
  const provider = getAiProviderName();

  if (provider === "openai") {
    const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
    if (!apiKey) {
      return null;
    }

    return {
      provider,
      model: getConfiguredModel(),
      client: new OpenAI({
        apiKey,
        timeout: getChatTimeoutMs(provider),
      }),
      supportsJsonMode: true,
    };
  }

  if (provider !== "ollama") {
    return null;
  }

  return {
    provider: "ollama",
    model: getConfiguredModel(),
    client: new OpenAI({
      baseURL: getOllamaOpenAiBaseUrl(),
      apiKey: String(process.env.OLLAMA_API_KEY || "ollama").trim() || "ollama",
      timeout: getChatTimeoutMs("ollama"),
    }),
    supportsJsonMode: String(process.env.OLLAMA_JSON_MODE || "true").toLowerCase() !== "false",
  };
}

function isConnectionError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  const code = String(error?.code || "").toLowerCase();

  return (
    code === "econnrefused" ||
    code === "enotfound" ||
    code === "fetch failed" ||
    message.includes("econnrefused") ||
    message.includes("connect") ||
    message.includes("fetch failed") ||
    message.includes("network")
  );
}

function formatAiConfigError() {
  const provider = getAiProviderName();

  if (provider === "openai") {
    return "AI generation is not configured. Add OPENAI_API_KEY to backend/.env and restart the backend.";
  }

  return `Ollama is not reachable. Start Ollama, pull a model (e.g. ollama pull ${DEFAULT_OLLAMA_MODEL}), and ensure it is running at ${getOllamaRootUrl()}.`;
}

function assertAiConfigured() {
  const config = getAiRuntimeConfig();
  if (!config) {
    const error = new Error(formatAiConfigError());
    error.statusCode = 503;
    throw error;
  }
  return config;
}

async function fetchOllamaTags() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(`${getOllamaRootUrl()}/api/tags`, {
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Ollama responded with status ${res.status}`);
    }

    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

function modelIsInstalled(tagsPayload, modelName) {
  const models = Array.isArray(tagsPayload?.models) ? tagsPayload.models : [];
  const target = String(modelName || "").trim().toLowerCase();
  if (!target) return false;

  return models.some((item) => {
    const name = String(item?.name || "").toLowerCase();
    return name === target || name.startsWith(`${target}:`);
  });
}

async function getAiServiceStatus() {
  const provider = getAiProviderName();
  const model = getConfiguredModel();
  const config = getAiRuntimeConfig();

  if (!config) {
    return {
      ok: false,
      configured: false,
      provider,
      model,
      error: formatAiConfigError(),
    };
  }

  if (provider === "openai") {
    return {
      ok: true,
      configured: true,
      provider,
      model,
      error: null,
    };
  }

  try {
    const tags = await fetchOllamaTags();
    const installedModels = (tags.models || []).map((item) => item.name);
    const modelReady = modelIsInstalled(tags, model);

    if (!modelReady) {
      return {
        ok: false,
        configured: false,
        provider,
        model,
        installedModels,
        error: `Model "${model}" is not installed in Ollama. Run: ollama pull ${model}`,
      };
    }

    return {
      ok: true,
      configured: true,
      provider,
      model,
      installedModels,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      configured: false,
      provider,
      model,
      error: isConnectionError(error)
        ? `Cannot connect to Ollama at ${getOllamaRootUrl()}. Make sure the Ollama app is running.`
        : error.message || "Failed to reach Ollama.",
    };
  }
}

async function requestOllamaNativeChat(config, { messages, temperature, jsonMode }) {
  const controller = new AbortController();
  const timeoutMs = getChatTimeoutMs("ollama");
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const body = {
      model: config.model,
      messages,
      stream: false,
      options: {
        temperature,
        num_predict: Number(process.env.OLLAMA_NUM_PREDICT || 1024),
      },
    };

    if (jsonMode) {
      body.format = "json";
    }

    const res = await fetch(`${getOllamaRootUrl()}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(
        detail || `Ollama chat request failed with status ${res.status}`
      );
    }

    const data = await res.json();
    return String(data?.message?.content || "");
  } catch (error) {
    if (error?.name === "AbortError") {
      const wrapped = new Error(
        "Ollama took too long to respond. Try fewer questions or a smaller model."
      );
      wrapped.statusCode = 504;
      throw wrapped;
    }

    if (isConnectionError(error)) {
      const wrapped = new Error(formatAiConfigError());
      wrapped.statusCode = 503;
      wrapped.cause = error;
      throw wrapped;
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function createOpenAiChatCompletion(config, { messages, temperature, jsonMode }) {
  const request = {
    model: config.model,
    messages,
    temperature,
  };

  if (jsonMode && config.supportsJsonMode) {
    request.response_format = { type: "json_object" };
  }

  try {
    return await config.client.chat.completions.create(request);
  } catch (error) {
    if (isConnectionError(error)) {
      const wrapped = new Error(formatAiConfigError());
      wrapped.statusCode = 503;
      wrapped.cause = error;
      throw wrapped;
    }

    throw error;
  }
}

async function createChatCompletion(config, { messages, temperature, jsonMode }) {
  if (config.provider === "ollama") {
    const content = await requestOllamaNativeChat(config, {
      messages,
      temperature,
      jsonMode,
    });
    return { choices: [{ message: { content } }] };
  }

  return createOpenAiChatCompletion(config, { messages, temperature, jsonMode });
}

async function requestChatCompletion({ messages, temperature = 0.4, jsonMode = true }) {
  const config = assertAiConfigured();
  const response = await createChatCompletion(config, {
    messages,
    temperature,
    jsonMode,
  });

  return {
    content: response.choices?.[0]?.message?.content || "",
    provider: config.provider,
    model: config.model,
  };
}

module.exports = {
  getAiProviderName,
  getConfiguredModel,
  getAiRuntimeConfig,
  assertAiConfigured,
  getAiServiceStatus,
  requestChatCompletion,
  formatAiConfigError,
};
