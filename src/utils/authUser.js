import { supabase } from "../supabaseClient";

function decodeAccessTokenPayload(accessToken) {
  try {
    const segment = String(accessToken || "").split(".")[1];
    if (!segment) return null;
    const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(normalized));
  } catch {
    return null;
  }
}

export function isAccessTokenStale(accessToken, bufferSeconds = 60) {
  const payload = decodeAccessTokenPayload(accessToken);
  const exp = Number(payload?.exp);
  if (!Number.isFinite(exp)) return false;
  return Date.now() / 1000 >= exp - bufferSeconds;
}

export function isAuthSessionError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return (
    message.includes("auth session missing") ||
    message.includes("session expired") ||
    message.includes("invalid or expired session") ||
    message.includes("not authenticated") ||
    message.includes("jwt") ||
    message.includes("invalid refresh token") ||
    message.includes("missing authorization token")
  );
}

async function refreshAuthSession() {
  const { data, error } = await supabase.auth.refreshSession();
  if (error) {
    console.warn("refreshSession error:", error);
    return null;
  }
  return data?.session ?? null;
}

export async function getAuthSession({ forceRefresh = false } = {}) {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    console.warn("getSession error:", error);
  }

  const shouldRefresh =
    forceRefresh ||
    !session?.access_token ||
    isAccessTokenStale(session.access_token);

  if (!shouldRefresh) {
    return session;
  }

  const refreshed = await refreshAuthSession();
  if (refreshed?.access_token) {
    return refreshed;
  }

  if (session?.access_token && !isAccessTokenStale(session.access_token, 0)) {
    return session;
  }

  return null;
}

export async function requireAuthUser() {
  const session = await getAuthSession();
  if (!session?.user) {
    throw new Error("Your session expired. Please log out and log in again.");
  }
  return session.user;
}

export async function resolveStudentId() {
  const session = await getAuthSession();
  return session?.user?.id ?? null;
}

export function isStudentRole(role) {
  return String(role || "").toLowerCase() === "student";
}

export function getCachedExamNexusUser() {
  try {
    const raw = localStorage.getItem("examnexus_user");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.id ? parsed : null;
  } catch {
    return null;
  }
}

export function hasLikelyAuthSession() {
  if (getCachedExamNexusUser()) return true;

  // The Supabase session now lives in sessionStorage (per tab).
  try {
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index);
      if (key && (key.includes("auth-token") || key === "examnexus-auth-token")) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}
