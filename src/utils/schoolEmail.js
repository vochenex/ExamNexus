export const CRMCC_EMAIL_DOMAIN = "crmc.en.com";

export const CRMCC_EMAIL_REGEX =
  /^[a-z][a-z0-9]*\.[a-z][a-z0-9]*@crmc\.en\.com$/i;

export const CRMCC_EMAIL_HINT = "lastname.firstname@crmc.en.com";

export const CRMCC_EMAIL_PLACEHOLDER = "lastname.firstname@crmc.en.com";

function sanitizeNamePart(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function buildCrmcEmail(lastName, firstName) {
  const last = sanitizeNamePart(lastName);
  const first = sanitizeNamePart(firstName);
  if (!last || !first) return "";
  return `${last}.${first}@${CRMCC_EMAIL_DOMAIN}`;
}

export function isValidCrmcEmail(email) {
  return CRMCC_EMAIL_REGEX.test(String(email || "").trim());
}

export function crmcEmailError(email) {
  if (!String(email || "").trim()) {
    return "Email is required";
  }
  if (!isValidCrmcEmail(email)) {
    return `Use your school email: ${CRMCC_EMAIL_HINT}`;
  }
  return "";
}

/** Login accepts any email; signup/forgot require school format. */
export function authEmailError(email, { schoolFormatRequired = false } = {}) {
  const trimmed = String(email || "").trim();
  if (!trimmed) {
    return "Email is required";
  }
  if (schoolFormatRequired) {
    return crmcEmailError(trimmed);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return "Enter a valid email address";
  }
  return "";
}

export function requiresCrmcEmail(role) {
  const normalized = String(role || "").toLowerCase();
  return normalized === "student" || normalized === "faculty";
}
