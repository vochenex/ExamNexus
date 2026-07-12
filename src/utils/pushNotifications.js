import { Capacitor } from "@capacitor/core";
import { isNativeApp, getPlatform } from "./platform";
import { isIOS, isStandalonePWA } from "./pwa";
import { supabase } from "../supabaseClient";
import { getSavedAccounts } from "./savedAccounts";
import { API_BASE } from "./apiBase.js";

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

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

async function upsertToken(token, platform = getPlatform()) {
  if (!token) return;
  lastToken = token;
  try {
    const { error } = await supabase.rpc("upsert_push_device", {
      p_token: token,
      p_platform: platform,
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

async function fetchVapidPublicKey() {
  const res = await fetch(`${API_BASE}/push/vapid-public-key`);
  if (!res.ok) return "";
  const json = await res.json().catch(() => ({}));
  return String(json.publicKey || "").trim();
}

/** True when this browser can use Web Push (iOS requires Add to Home Screen). */
export function canUseWebPush() {
  if (typeof window === "undefined") return false;
  if (isNativeApp()) return false;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  if (!("Notification" in window)) return false;
  // iOS Safari only delivers Web Push from a home-screen / standalone PWA.
  if (isIOS() && !isStandalonePWA()) return false;
  return true;
}

/**
 * Register Web Push for installed PWA (desktop + iOS Add to Home Screen).
 */
export async function initWebPushNotifications({ requestPermission = true } = {}) {
  if (!canUseWebPush()) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    let permission = Notification.permission;
    if (permission === "default" && requestPermission) {
      permission = await Notification.requestPermission();
    }
    if (permission !== "granted") {
      console.warn("Web push permission not granted");
      return false;
    }

    const vapidKey = await fetchVapidPublicKey();
    if (!vapidKey) {
      console.warn("Web push VAPID public key unavailable");
      return false;
    }

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }

    const token = JSON.stringify(subscription.toJSON());
    await upsertToken(token, "web");
    await flushPendingRemovals();
    initialized = true;
    return true;
  } catch (err) {
    console.warn("Web push init skipped:", err?.message || err);
    return false;
  }
}

/**
 * Register for native push notifications (Capacitor iOS/Android only).
 */
export async function initPushNotifications() {
  if (!isNativeApp()) {
    return initWebPushNotifications({ requestPermission: true });
  }
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
  if (!isNativeApp()) {
    if (lastToken) {
      await upsertToken(lastToken, "web");
      await flushPendingRemovals();
      return;
    }
    await initWebPushNotifications({
      // Don't spam permission on every page load for desktop browsers;
      // iOS standalone + already-granted re-sync is fine.
      requestPermission:
        Notification.permission === "granted" ||
        (isIOS() && isStandalonePWA()),
    });
    return;
  }
  if (lastToken) {
    await upsertToken(lastToken);
    await flushPendingRemovals();
    return;
  }
  await initPushNotifications();
}

/**
 * On logout: keep the binding if this account stays in Saved Accounts.
 */
export async function releasePushTokenOnLogout({ email, userId } = {}) {
  if (!lastToken) return;

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
  if (!lastToken) return;
  try {
    await supabase.rpc("remove_push_device", { p_token: lastToken });
  } catch {
    // ignore
  }
}

export function isPushAvailable() {
  if (isNativeApp()) {
    return Capacitor.isPluginAvailable("PushNotifications");
  }
  return canUseWebPush();
}
