const ACCOUNT_CACHE_KEYS = ["examnexus_user", "examnexus_subjects"];
const AUTH_STORAGE_KEY = "examnexus-auth-token";

function storageKeyLooksLikeAuthToken(key) {
  if (!key) return false;
  return key.includes("auth-token") || key === AUTH_STORAGE_KEY;
}

function readAuthFrom(storage) {
  try {
    return storage.getItem(AUTH_STORAGE_KEY);
  } catch {
    return null;
  }
}

function clearAuthKeysFrom(storage) {
  try {
    const staleKeys = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (storageKeyLooksLikeAuthToken(key)) {
        staleKeys.push(key);
      }
    }
    staleKeys.forEach((key) => storage.removeItem(key));
  } catch {
    /* ignore storage access errors */
  }
}

/**
 * Older builds kept auth in sessionStorage (per tab). That broke multi-tab use
 * because refresh-token rotation in one tab invalidated the other. Move any
 * leftover sessionStorage token into localStorage once, then clear it.
 */
function migrateSessionAuthToLocalStorage() {
  try {
    const fromSession = readAuthFrom(sessionStorage);
    const fromLocal = readAuthFrom(localStorage);

    if (fromSession && !fromLocal) {
      localStorage.setItem(AUTH_STORAGE_KEY, fromSession);
    }

    // Always drop per-tab auth leftovers so tabs don't diverge.
    clearAuthKeysFrom(sessionStorage);
  } catch {
    /* ignore storage access errors */
  }
}

function localHasAuthToken() {
  return Boolean(readAuthFrom(localStorage));
}

/**
 * Run once at startup. Auth lives in localStorage (shared across tabs).
 * If there is no auth token, clear cached profile leftovers so the UI does not
 * look signed-in without a real session.
 */
export function clearStaleAccountCacheOnLoad() {
  migrateSessionAuthToLocalStorage();

  if (localHasAuthToken()) return;

  try {
    ACCOUNT_CACHE_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {
    /* ignore storage access errors */
  }
}
