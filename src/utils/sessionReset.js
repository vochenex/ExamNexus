const ACCOUNT_CACHE_KEYS = ["examnexus_user", "examnexus_subjects"];

function storageKeyLooksLikeAuthToken(key) {
  if (!key) return false;
  return key.includes("auth-token") || key === "examnexus-auth-token";
}

function sessionHasAuthToken() {
  try {
    for (let index = 0; index < sessionStorage.length; index += 1) {
      if (storageKeyLooksLikeAuthToken(sessionStorage.key(index))) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

// Older builds persisted the Supabase session in localStorage, which kept users
// logged in across tab/browser closes. Remove any of those leftovers so they
// can't silently restore an account.
function purgeLegacyLocalAuthTokens() {
  try {
    const staleKeys = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (storageKeyLooksLikeAuthToken(key)) {
        staleKeys.push(key);
      }
    }
    staleKeys.forEach((key) => localStorage.removeItem(key));
  } catch {
    /* ignore storage access errors */
  }
}

/**
 * Run once at startup. The Supabase session now lives in sessionStorage (per
 * tab), so a freshly opened tab that has no session means the previous tab was
 * closed — in that case we clear the cached account profile so nobody stays
 * "logged in" after closing the tab. In-tab refreshes keep the session, so they
 * are unaffected.
 */
export function clearStaleAccountCacheOnLoad() {
  purgeLegacyLocalAuthTokens();

  if (sessionHasAuthToken()) return;

  try {
    ACCOUNT_CACHE_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {
    /* ignore storage access errors */
  }
}
