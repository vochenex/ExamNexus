import { supabase } from "../supabaseClient";
import { isNativeApp } from "./platform";

/**
 * Single active session per account (see database/single_active_session.sql).
 * The device id is per browser profile: tabs in one browser share it, while an
 * incognito window, another browser or another device gets its own.
 */
const DEVICE_ID_KEY = "examnexus_device_id";

export const ACTIVE_SESSION_HEARTBEAT_MS = 30_000;
export const SESSION_CONFLICT_NOTICE = "session-conflict";

function randomId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

/** Human label shown to the person who gets refused, e.g. "Chrome on Windows". */
export function describeThisDevice() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  const os = /Android/i.test(ua)
    ? "Android"
    : /iPhone|iPad|iPod/i.test(ua)
      ? "iOS"
      : /Windows/i.test(ua)
        ? "Windows"
        : /Mac OS X|Macintosh/i.test(ua)
          ? "macOS"
          : /CrOS/i.test(ua)
            ? "ChromeOS"
            : /Linux/i.test(ua)
              ? "Linux"
              : "an unknown system";
  if (isNativeApp()) return `ExamNexus app on ${os}`;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /SamsungBrowser/.test(ua)
        ? "Samsung Internet"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Chrome\//.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : "A browser";
  return `${browser} on ${os}`;
}

function isMissingRpc(error) {
  const code = String(error?.code || "");
  return (
    code === "PGRST202" ||
    code === "42883" ||
    /could not find the function|does not exist/i.test(error?.message || "")
  );
}

/**
 * Claim (or refresh) this browser's session as the account's active one.
 * Resolves `{ ok: false, deviceLabel, secondsAgo }` when the account is active elsewhere.
 * Fails open (`ok: true, skipped: true`) when the SQL is not installed or the call errors,
 * so a database hiccup never locks everyone out.
 */
export async function claimActiveSession() {
  try {
    const { data, error } = await supabase.rpc("claim_active_session", {
      p_device_id: getDeviceId(),
      p_device_label: describeThisDevice(),
    });
    if (error) {
      if (!isMissingRpc(error)) {
        console.warn("[ExamNexus] claim_active_session failed:", error.message || error);
      }
      return { ok: true, skipped: true };
    }
    if (data && data.ok === false) {
      return {
        ok: false,
        deviceLabel: data.device_label || "another device",
        secondsAgo: Math.max(0, Number(data.seconds_ago) || 0),
      };
    }
    return { ok: true };
  } catch {
    return { ok: true, skipped: true };
  }
}

/** Free the account right away on logout (otherwise it frees itself after ~2 minutes). */
export async function releaseActiveSession() {
  try {
    await supabase.rpc("release_active_session");
  } catch {
    // ignore — the claim expires on its own
  }
}

/** Drop only this browser's new session; the session on the other device keeps working. */
export async function discardThisSession() {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // ignore network errors; local tokens are still cleared by supabase-js
  }
  localStorage.removeItem("examnexus_user");
}

export function formatLastActive(secondsAgo) {
  const seconds = Math.max(0, Math.round(Number(secondsAgo) || 0));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.round(seconds / 60);
  return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
}
