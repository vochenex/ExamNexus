const ACCOUNTS_KEY = "examnexus_saved_accounts";
const REMEMBER_KEY = "examnexus_remembered_passwords";
const PINS_KEY = "examnexus_account_pins";
const SCHEMA_KEY = "examnexus_saved_accounts_schema";
/** Bump to force-clear legacy saved accounts that were not PIN-protected. */
const SCHEMA_VERSION = 4;

export const DEVICE_PIN_LENGTH = 4;

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

/**
 * One-time wipe: older "remember me" entries had no device PIN.
 * Users must opt in again and set a PIN.
 */
function migrateSavedAccountsSchema() {
  try {
    const current = Number(localStorage.getItem(SCHEMA_KEY) || "0");
    if (current >= SCHEMA_VERSION) return;

    localStorage.removeItem(ACCOUNTS_KEY);
    localStorage.removeItem(REMEMBER_KEY);
    localStorage.removeItem(PINS_KEY);
    localStorage.setItem(SCHEMA_KEY, String(SCHEMA_VERSION));
  } catch {
    // ignore storage errors
  }
}

migrateSavedAccountsSchema();

export function clearAllSavedAccounts() {
  localStorage.removeItem(ACCOUNTS_KEY);
  localStorage.removeItem(REMEMBER_KEY);
  localStorage.removeItem(PINS_KEY);
  localStorage.setItem(SCHEMA_KEY, String(SCHEMA_VERSION));
}

export function getSavedAccounts() {
  const list = readJson(ACCOUNTS_KEY, []);
  if (!Array.isArray(list)) return [];

  // Never expose remembered accounts that have no device PIN — those could
  // unlock with a password fill and skip the PIN gate.
  const pins = readPins();
  const secured = [];
  const droppedEmails = [];

  for (const account of list) {
    const email = normalizeEmail(account?.email);
    if (!email) continue;
    if (pins[email]?.hash && pins[email]?.salt) {
      secured.push(account);
    } else {
      droppedEmails.push(email);
    }
  }

  if (droppedEmails.length) {
    writeJson(ACCOUNTS_KEY, secured);
    const passwords = readJson(REMEMBER_KEY, {});
    for (const email of droppedEmails) {
      delete passwords[email];
      delete pins[email];
    }
    writeJson(REMEMBER_KEY, passwords);
    writePins(pins);
  }

  return secured;
}

export function findSavedAccount(emailOrId) {
  const needle = String(emailOrId || "").trim().toLowerCase();
  if (!needle) return null;
  return (
    getSavedAccounts().find((account) => {
      if (account.user_id && String(account.user_id).toLowerCase() === needle) {
        return true;
      }
      return String(account.email || "").toLowerCase() === needle;
    }) || null
  );
}

export function upsertSavedAccount({
  email,
  role,
  first_name,
  last_name,
  avatar_url,
  user_id,
}) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return getSavedAccounts();

  const existing = getSavedAccounts().find(
    (account) => String(account.email || "").toLowerCase() === normalizedEmail
  );

  const next = getSavedAccounts().filter(
    (account) => String(account.email || "").toLowerCase() !== normalizedEmail
  );
  next.unshift({
    email: normalizedEmail,
    role: role || existing?.role || "",
    first_name: first_name || existing?.first_name || "",
    last_name: last_name || existing?.last_name || "",
    avatar_url: avatar_url || existing?.avatar_url || "",
    user_id: user_id || existing?.user_id || "",
    lastUsedAt: new Date().toISOString(),
  });
  writeJson(ACCOUNTS_KEY, next.slice(0, 8));
  return next.slice(0, 8);
}

function readPins() {
  const map = readJson(PINS_KEY, {});
  return map && typeof map === "object" ? map : {};
}

function writePins(map) {
  writeJson(PINS_KEY, map);
}

function randomSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashPin(pin, salt) {
  const payload = new TextEncoder().encode(`${salt}:${String(pin)}`);
  const digest = await crypto.subtle.digest("SHA-256", payload);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

export function hasAccountPin(email) {
  const entry = readPins()[normalizeEmail(email)];
  return Boolean(entry?.hash && entry?.salt);
}

export async function setAccountPin(email, pin) {
  const normalizedEmail = normalizeEmail(email);
  const digits = String(pin || "").replace(/\D/g, "");
  if (!normalizedEmail || digits.length !== DEVICE_PIN_LENGTH) {
    throw new Error(`PIN must be ${DEVICE_PIN_LENGTH} digits.`);
  }

  const salt = randomSalt();
  const hash = await hashPin(digits, salt);
  const map = readPins();
  map[normalizedEmail] = {
    salt,
    hash,
    length: DEVICE_PIN_LENGTH,
    updatedAt: new Date().toISOString(),
  };
  writePins(map);
}

export async function verifyAccountPin(email, pin) {
  const normalizedEmail = normalizeEmail(email);
  const entry = readPins()[normalizedEmail];
  if (!entry?.hash || !entry?.salt) return false;

  const digits = String(pin || "").replace(/\D/g, "");
  if (digits.length !== (entry.length || DEVICE_PIN_LENGTH)) return false;

  const hash = await hashPin(digits, entry.salt);
  return hash === entry.hash;
}

export function clearAccountPin(email) {
  const normalizedEmail = normalizeEmail(email);
  const map = readPins();
  if (!map[normalizedEmail]) return;
  delete map[normalizedEmail];
  writePins(map);
}

export function removeSavedAccount(email) {
  const normalizedEmail = normalizeEmail(email);
  const removed = getSavedAccounts().find(
    (account) => String(account.email || "").toLowerCase() === normalizedEmail
  );
  const next = getSavedAccounts().filter(
    (account) => String(account.email || "").toLowerCase() !== normalizedEmail
  );
  writeJson(ACCOUNTS_KEY, next);
  clearAccountPin(normalizedEmail);
  return { accounts: next, removed };
}

export function getRememberedPassword(email) {
  const normalizedEmail = normalizeEmail(email);
  const map = readJson(REMEMBER_KEY, {});
  return map[normalizedEmail] || "";
}

export function setRememberedPassword(email, password, remember) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return;
  const map = readJson(REMEMBER_KEY, {});
  if (remember && password) {
    map[normalizedEmail] = password;
  } else {
    delete map[normalizedEmail];
  }
  writeJson(REMEMBER_KEY, map);
}
