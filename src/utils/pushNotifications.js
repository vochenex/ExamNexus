import { Capacitor } from "@capacitor/core";
import { isNativeApp, getPlatform } from "./platform";
import { supabase } from "../supabaseClient";
import { getSavedAccounts } from "./savedAccounts";

const PENDING_REMOVALS_KEY = "examnexus_push_pending_removals";

let initialized = false;
let lastToken = null;

function readPendingRemovals() {
  try {
    const raw = localStorage.getItem(PENDING_REMOVALS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
  } catch {
    return [];
  }
}

function writePendingRemovals(ids) {
  const unique = [...new Set((ids || []).map(String).filter(Boolean))];
  if (!unique.length) {
    localStorage.removeItem(PENDING_REMOVALS_KEY);
    return;
  }
  localStorage.setItem(PENDING_REMOVALS_KEY, JSON.stringify(unique));
}

function queuePendingRemoval(userId) {
  if (!userId) return;
  writePendingRemovals([...readPendingRemovals(), String(userId)]);
}

async function upsertToken(token) {
  if (!token) return;
  lastToken = token;
  try {
    const { error } = await supabase.rpc("upsert_push_device", {
      p_token: token,
      p_platform: getPlatform(),
    });
    if (error && !error.message?.includes("upsert_push_device")) {
      console.warn("Push token upsert failed:", error.message);
    }
  } catch (err) {
    console.warn("Push token upsert skipped:", err?.message || err);
  }
}

async function flushPendingRemovals() {
  if (!lastToken) return;
  const pending = readPendingRemovals();
  if (!pending.length) return;

  const remaining = [];
  for (const userId of pending) {
    try {
      const { error } = await supabase.rpc("remove_push_device_binding", {
        p_token: lastToken,
        p_user_id: userId,
      });
      if (error) remaining.push(userId);
    } catch {
      remaining.push(userId);
    }
  }
  writePendingRemovals(remaining);
}

/**
 * Register for native push notifications (Capacitor iOS/Android only).
 * Saves the FCM/APNs token against the signed-in user so the backend can
 * deliver announcement / notification pushes to their phone — including when
 * the app is in the background or closed (OS system banner).
 */
export async function initPushNotifications() {
  if (!isNativeApp()) return;
  if (initialized) {
    if (lastToken) await upsertToken(lastToken);
    return;
  }

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive !== "granted") {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== "granted") {
      console.warn("Push notification permission not granted");
      return;
    }

    await PushNotifications.register();
    initialized = true;

    PushNotifications.addListener("registration", async (token) => {
      await upsertToken(token?.value);
      await flushPendingRemovals();
    });

    PushNotifications.addListener("registrationError", (err) => {
      console.warn("Push registration error:", err?.error || err);
    });

    PushNotifications.addListener("pushNotificationReceived", () => {
      // Foreground: OS may still show a heads-up depending on channel;
      // in-app bell covers the feed while the app is open.
    });

    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const data = action?.notification?.data || {};
      const path = data.path || data.url || "";
      if (path && typeof path === "string" && path.startsWith("/")) {
        window.location.hash = "";
        window.dispatchEvent(
          new CustomEvent("en:push-navigate", { detail: { path } })
        );
      }
    });
  } catch (err) {
    console.warn("Push notifications init skipped:", err?.message || err);
  }
}

/** Add this device token for the signed-in user (does not remove other accounts). */
export async function syncPushTokenForCurrentUser() {
  if (!isNativeApp()) return;
  if (lastToken) {
    await upsertToken(lastToken);
    await flushPendingRemovals();
    return;
  }
  await initPushNotifications();
}

/**
 * On logout: keep the FCM binding if this account stays in Saved Accounts,
 * so they still get system banners while offline from the app / using other apps.
 * Otherwise remove only this user's binding for the device token.
 */
export async function releasePushTokenOnLogout({ email, userId } = {}) {
  if (!isNativeApp() || !lastToken) return;

  const saved = getSavedAccounts();
  const emailNorm = String(email || "").trim().toLowerCase();
  const stillSaved = saved.some((account) => {
    if (userId && account.user_id && String(account.user_id) === String(userId)) {
      return true;
    }
    return emailNorm && String(account.email || "").toLowerCase() === emailNorm;
  });

  if (stillSaved) return;

  try {
    await supabase.rpc("remove_push_device", { p_token: lastToken });
  } catch {
    // ignore
  }
}

/** When a saved account is removed from this phone, stop pushing to that user on this token. */
export async function removePushBindingForSavedAccount(userId) {
  if (!userId) return;
  if (!isNativeApp()) return;

  if (!lastToken) {
    queuePendingRemoval(userId);
    return;
  }

  try {
    const { error } = await supabase.rpc("remove_push_device_binding", {
      p_token: lastToken,
      p_user_id: userId,
    });
    if (error) queuePendingRemoval(userId);
  } catch {
    queuePendingRemoval(userId);
  }
}

export async function removeCurrentPushToken() {
  if (!isNativeApp() || !lastToken) return;
  try {
    await supabase.rpc("remove_push_device", { p_token: lastToken });
  } catch {
    // ignore
  }
}

export function isPushAvailable() {
  return isNativeApp() && Capacitor.isPluginAvailable("PushNotifications");
}
