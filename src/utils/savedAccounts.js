const ACCOUNTS_KEY = "examnexus_saved_accounts";
const REMEMBER_KEY = "examnexus_remembered_passwords";

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

export function getSavedAccounts() {
  const list = readJson(ACCOUNTS_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function upsertSavedAccount({ email, role, first_name, last_name, avatar_url }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return getSavedAccounts();

  const next = getSavedAccounts().filter(
    (account) => String(account.email || "").toLowerCase() !== normalizedEmail
  );
  next.unshift({
    email: normalizedEmail,
    role: role || "",
    first_name: first_name || "",
    last_name: last_name || "",
    avatar_url: avatar_url || "",
    lastUsedAt: new Date().toISOString(),
  });
  writeJson(ACCOUNTS_KEY, next.slice(0, 8));
  return next.slice(0, 8);
}

export function removeSavedAccount(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const next = getSavedAccounts().filter(
    (account) => String(account.email || "").toLowerCase() !== normalizedEmail
  );
  writeJson(ACCOUNTS_KEY, next);
  return next;
}

export function getRememberedPassword(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const map = readJson(REMEMBER_KEY, {});
  return map[normalizedEmail] || "";
}

export function setRememberedPassword(email, password, remember) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return;
  const map = readJson(REMEMBER_KEY, {});
  if (remember && password) {
    map[normalizedEmail] = password;
  } else {
    delete map[normalizedEmail];
  }
  writeJson(REMEMBER_KEY, map);
}
