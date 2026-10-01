const GENERIC_MESSAGE = "Something went wrong. Please try again.";

export const FRIENDLY_MESSAGES = {
  network: "Can't connect to the server. Check your internet connection and try again.",
  timeout: "The server took too long to respond. Please try again.",
  session: "Your session has expired. Please sign in again.",
  permission: "You don't have permission to do this.",
  duplicateSchoolId: "This School ID is already registered.",
  duplicateEmail: "This email is already registered.",
  duplicate: "This already exists. Try a different name or value.",
  inUse: "This can't be changed because other records still use it.",
  notFound: "The requested item could not be found. It may have been removed.",
  invalidInput: "Some of the information entered is missing or invalid. Please check and try again.",
  notSetUp: "This feature isn't set up yet. Please contact the system administrator.",
  busy: "The service is busy right now. Please wait a minute and try again.",
  tooLarge: "The file is too large. Please upload a smaller file.",
  server: "Something went wrong on the server. Please try again in a moment.",
};

/** Wording that only shows up in raw library, database, HTTP or config errors. */
const TECHNICAL_PATTERN = new RegExp(
  [
    "failed to fetch",
    "networkerror",
    "network request failed",
    "load failed",
    "fetch failed",
    "\\berr_[a-z_]+",
    "\\becon\\w+",
    "\\benotfound\\b",
    "\\betimedout\\b",
    "und_err",
    "socket hang up",
    "aborterror",
    "signal is aborted",
    "\\b(type|reference|syntax|range)error\\b",
    "cannot read propert",
    "is not a function",
    "is not defined",
    "unexpected token",
    "unexpected end of json",
    "json\\.parse",
    "\\[object object\\]",
    "violates",
    "constraint",
    "duplicate key",
    'relation "',
    'column "',
    "does not exist",
    "schema cache",
    "could not find the function",
    "permission denied",
    "row-level security",
    "\\bpgrst\\d*",
    "postgres",
    "sqlstate",
    "invalid input syntax",
    "multiple \\(or no\\) rows",
    "json object requested",
    "foreign key",
    "null value in column",
    "\\.sql\\b",
    "sql editor",
    "supabase",
    "\\brpc\\b",
    "\\bjwt\\b",
    "invalid claim",
    "refresh token",
    "auth session missing",
    "authretryablefetcherror",
    "\\.env\\b",
    "_api_key",
    "service_role",
    "service role",
    "environment variable",
    "\\bnpm\\b",
    "vercel",
    "restart the (backend|server)",
    "localhost",
    "127\\.0\\.0\\.1",
    "https?://",
    "api_base",
    "\\bgemini_\\w+",
    "\\bgroq_\\w+",
    "resource_exhausted",
    "too many requests",
    "internal server error",
    "bad gateway",
    "service unavailable",
    "gateway timeout",
    "payload too large",
    "entity too large",
    "limit_file_size",
    "status code",
    "\\b(status|code|http|error)\\s*:?\\s*[45]\\d\\d\\b",
  ].join("|"),
  "i"
);

const CATEGORIES = [
  {
    key: "network",
    test: /failed to fetch|networkerror|network request failed|load failed|fetch failed|err_(connection|internet|name_not_resolved|network)|econnrefused|econnreset|enotfound|socket hang up|authretryablefetcherror|cannot reach (the )?(backend|server|supabase|api)/i,
  },
  {
    key: "timeout",
    test: /timed out|timeout|etimedout|aborterror|signal is aborted/i,
  },
  {
    key: "session",
    test: /\bjwt\b|invalid claim|refresh token|auth session missing|token (is )?expired|expired token|invalid token/i,
  },
  {
    key: "permission",
    test: /permission denied|row-level security|\b42501\b|forbidden|admin access required/i,
  },
  {
    key: "duplicate",
    test: /duplicate key|unique constraint|\b23505\b/i,
  },
  {
    key: "inUse",
    test: /foreign key|\b23503\b/i,
  },
  {
    key: "notFound",
    test: /multiple \(or no\) rows|json object requested|pgrst116|contains 0 rows/i,
  },
  {
    key: "invalidInput",
    test: /invalid input syntax|null value in column|not-null|check constraint|value too long|out of range|\b22p02\b|\b23502\b|\b23514\b/i,
  },
  {
    key: "busy",
    test: /quota|rate limit|resource_exhausted|too many requests|\b429\b/i,
  },
  {
    key: "notSetUp",
    test: /does not exist|could not find the function|schema cache|pgrst202|\b42883\b|\b42p01\b|\b42703\b|\.sql\b|sql editor|\.env\b|_api_key|service_role|service role|environment variable|not configured|\bnpm\b|vercel|restart the (backend|server)|api_base|\bgemini_\w+|\bgroq_\w+|missing in/i,
  },
  {
    key: "tooLarge",
    test: /payload too large|entity too large|limit_file_size|file too large|\b413\b/i,
  },
  {
    key: "server",
    test: /internal server error|bad gateway|service unavailable|gateway timeout|\b5\d\d\b/i,
  },
];

const SQLSTATE_PATTERN = /^(?!P0001$)[0-9A-Z]{5}$/;

function readMessage(input) {
  if (!input) return "";
  if (typeof input === "string") return input;
  const parts = [input.message, input.error_description, input.details, input.hint]
    .filter((part) => typeof part === "string" && part.trim());
  if (parts.length) return parts.join(" ");
  if (typeof input.error === "string") return input.error;
  return "";
}

function stripErrorPrefix(text) {
  return String(text || "")
    .trim()
    .replace(/^(uncaught\s+)?(error|exception)\s*:\s*/i, "")
    .trim();
}

function isTechnical(input, text) {
  if (typeof input === "object" && input) {
    const code = String(input.code || "");
    if (/^PGRST\d+$/i.test(code) || SQLSTATE_PATTERN.test(code)) return true;
    if (input.name === "TypeError" || input.name === "AuthRetryableFetchError") return true;
  }
  return TECHNICAL_PATTERN.test(text);
}

function categorize(input, text) {
  const code = typeof input === "object" && input ? String(input.code || "") : "";
  const haystack = `${text} ${code}`;

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return FRIENDLY_MESSAGES.network;
  }

  for (const { key, test } of CATEGORIES) {
    if (!test.test(haystack)) continue;
    if (key === "duplicate") {
      if (/school_id/i.test(haystack)) return FRIENDLY_MESSAGES.duplicateSchoolId;
      if (/email/i.test(haystack)) return FRIENDLY_MESSAGES.duplicateEmail;
    }
    return FRIENDLY_MESSAGES[key];
  }
  return "";
}

/**
 * Turn any thrown error, Supabase error, backend payload or string into a short
 * message an end user can act on. Messages that are already plain English pass
 * through unchanged; raw library / database / config text is replaced with the
 * simplified cause, or `fallback` when the cause is unknown.
 */
export function friendlyError(input, fallback = GENERIC_MESSAGE) {
  const safeFallback = fallback && !TECHNICAL_PATTERN.test(fallback) ? fallback : GENERIC_MESSAGE;
  const text = stripErrorPrefix(readMessage(input));

  if (!text) {
    return categorize(input, "") || safeFallback;
  }
  if (!isTechnical(input, text)) {
    return text;
  }

  if (import.meta.env?.DEV) {
    console.warn("[friendlyError] hid technical message:", input);
  }
  return categorize(input, text) || safeFallback;
}

export default friendlyError;
