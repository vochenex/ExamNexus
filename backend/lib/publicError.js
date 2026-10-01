/**
 * Server-side counterpart of frontend/utils/friendlyError.js: keeps raw library,
 * database and config text (env var names, SQL, stack-ish messages) out of API
 * responses. The raw error is logged so it is still visible in server logs.
 */

const GENERIC_MESSAGE = "Something went wrong. Please try again.";

const MESSAGES = {
  network: "The server couldn't reach one of its services. Please try again in a moment.",
  timeout: "The server took too long to respond. Please try again.",
  session: "Your session has expired. Please sign in again.",
  permission: "You don't have permission to do this.",
  duplicateSchoolId: "This School ID is already registered.",
  duplicateEmail: "This email is already registered.",
  duplicate: "This already exists. Try a different name or value.",
  inUse: "This can't be changed because other records still use it.",
  notFound: "The requested item could not be found. It may have been removed.",
  invalidInput: "Some of the information entered is missing or invalid. Please check and try again.",
  busy: "The service is busy right now. Please wait a minute and try again.",
  notSetUp: "This feature isn't set up yet. Please contact the system administrator.",
  tooLarge: "The file is too large. Please upload a smaller file.",
  unreadableFile: "This file couldn't be read. Make sure it isn't corrupted or password-protected, then try again.",
  server: "Something went wrong on the server. Please try again in a moment.",
};

const TECHNICAL_PATTERN =
  /fetch failed|failed to fetch|networkerror|\berr_[a-z_]+|\becon\w+|\benotfound\b|\betimedout\b|und_err|socket hang up|aborterror|\b(type|reference|syntax|range)error\b|cannot read propert|is not a function|is not defined|unexpected token|unexpected end of json|violates|constraint|duplicate key|relation "|column "|does not exist|schema cache|could not find the function|permission denied|row-level security|\bpgrst\d*|postgres|invalid input syntax|multiple \(or no\) rows|json object requested|foreign key|null value in column|\.sql\b|sql editor|supabase|\bjwt\b|invalid claim|refresh token|\.env\b|_api_key|service_role|environment variable|\bnpm\b|vercel|restart the (backend|server)|localhost|127\.0\.0\.1|https?:\/\/|\bgemini_\w+|\bgroq_\w+|resource_exhausted|too many requests|internal server error|payload too large|entity too large|limit_file_size|unexpected field|\bmulter\b|end of central directory|invalid pdf|zip|\bfcm\b|status code/i;

const CATEGORIES = [
  ["network", /fetch failed|failed to fetch|networkerror|econnrefused|econnreset|enotfound|socket hang up|err_(connection|internet|name_not_resolved|network)/i],
  ["timeout", /timed out|timeout|etimedout|aborterror/i],
  ["session", /\bjwt\b|invalid claim|refresh token|token (is )?expired|invalid token/i],
  ["permission", /permission denied|row-level security|\b42501\b/i],
  ["duplicate", /duplicate key|unique constraint|\b23505\b/i],
  ["inUse", /foreign key|\b23503\b/i],
  ["notFound", /multiple \(or no\) rows|json object requested|pgrst116|contains 0 rows/i],
  ["invalidInput", /invalid input syntax|null value in column|not-null|check constraint|value too long|out of range|\b22p02\b|\b23502\b|\b23514\b/i],
  ["busy", /quota|rate limit|resource_exhausted|too many requests|\b429\b/i],
  ["notSetUp", /does not exist|could not find the function|schema cache|pgrst202|\b42883\b|\b42p01\b|\b42703\b|\.sql\b|sql editor|\.env\b|_api_key|service_role|environment variable|not configured|\bnpm\b|vercel|restart the (backend|server)|\bgemini_\w+|\bgroq_\w+|missing in/i],
  ["tooLarge", /payload too large|entity too large|limit_file_size|file too large|\b413\b/i],
  ["unreadableFile", /end of central directory|invalid pdf|corrupt|zip|unexpected field|\bmulter\b/i],
  ["server", /internal server error|bad gateway|service unavailable|gateway timeout/i],
];

function readMessage(input) {
  if (!input) return "";
  if (typeof input === "string") return input;
  const parts = [input.message, input.details, input.hint].filter(
    (part) => typeof part === "string" && part.trim()
  );
  return parts.join(" ");
}

function isTechnical(input, text) {
  if (input && typeof input === "object") {
    const code = String(input.code || "");
    if (/^PGRST\d+$/i.test(code) || /^(?!P0001$)[0-9A-Z]{5}$/.test(code)) return true;
  }
  return TECHNICAL_PATTERN.test(text);
}

function categorize(input, text) {
  const code = input && typeof input === "object" ? String(input.code || input.cause?.code || "") : "";
  const haystack = `${text} ${code}`;
  for (const [key, test] of CATEGORIES) {
    if (!test.test(haystack)) continue;
    if (key === "duplicate") {
      if (/school_id/i.test(haystack)) return MESSAGES.duplicateSchoolId;
      if (/email/i.test(haystack)) return MESSAGES.duplicateEmail;
    }
    return MESSAGES[key];
  }
  return "";
}

/**
 * @param {unknown} input Error, Supabase error or string.
 * @param {string} [fallback] Plain-English message used when the cause is unknown.
 * @returns {string}
 */
function publicErrorMessage(input, fallback = GENERIC_MESSAGE) {
  const safeFallback = fallback && !TECHNICAL_PATTERN.test(fallback) ? fallback : GENERIC_MESSAGE;
  const text = readMessage(input).trim().replace(/^(error|exception)\s*:\s*/i, "");
  if (!text) return safeFallback;
  if (!isTechnical(input, text)) return text;

  console.warn("[publicError] hid technical message from client:", text);
  return categorize(input, text) || safeFallback;
}

module.exports = { publicErrorMessage, PUBLIC_ERROR_MESSAGES: MESSAGES };
