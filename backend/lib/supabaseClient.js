const { createClient } = require("@supabase/supabase-js");
const { Agent, fetch: undiciFetch } = require("undici");

const DEFAULT_FETCH_TIMEOUT_MS =
  Number(process.env.SUPABASE_FETCH_TIMEOUT_MS) || 60000;

const supabaseAgent = new Agent({
  connectTimeout: DEFAULT_FETCH_TIMEOUT_MS,
  headersTimeout: DEFAULT_FETCH_TIMEOUT_MS,
  bodyTimeout: DEFAULT_FETCH_TIMEOUT_MS,
});

function createResilientFetch(timeoutMs) {
  return async function resilientFetch(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const onAbort = () => controller.abort();
    if (options.signal) {
      if (options.signal.aborted) {
        clearTimeout(timer);
        throw new DOMException("The operation was aborted.", "AbortError");
      }
      options.signal.addEventListener("abort", onAbort, { once: true });
    }

    try {
      return await undiciFetch(url, {
        ...options,
        signal: controller.signal,
        dispatcher: supabaseAgent,
      });
    } catch (error) {
      if (error?.name === "AbortError" && !options.signal?.aborted) {
        const timeoutError = new Error(
          `Supabase request timed out after ${timeoutMs}ms`
        );
        timeoutError.code = "SUPABASE_FETCH_TIMEOUT";
        throw timeoutError;
      }
      throw error;
    } finally {
      clearTimeout(timer);
      if (options.signal) {
        options.signal.removeEventListener("abort", onAbort);
      }
    }
  };
}

const BASE_SERVER_OPTIONS = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
  global: {
    fetch: createResilientFetch(DEFAULT_FETCH_TIMEOUT_MS),
  },
};

function mergeOptions(base, extra = {}) {
  return {
    ...base,
    ...extra,
    auth: { ...base.auth, ...extra.auth },
    global: {
      ...base.global,
      ...extra.global,
      headers: {
        ...base.global?.headers,
        ...extra.global?.headers,
      },
    },
  };
}

function createAnonClient(extraOptions = {}) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_ANON_KEY must be set (Vercel Environment Variables or backend/.env)"
    );
  }
  return createClient(url, key, mergeOptions(BASE_SERVER_OPTIONS, extraOptions));
}

function createUserClient(accessToken, extraOptions = {}) {
  const token = String(accessToken || "").trim();
  return createAnonClient(
    mergeOptions(
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      },
      extraOptions
    )
  );
}

function createServiceClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, BASE_SERVER_OPTIONS);
}

module.exports = {
  createAnonClient,
  createUserClient,
  createServiceClient,
};
