import { Capacitor } from "@capacitor/core";
import { isNativeApp, getPlatform } from "./platform";
import { isIOS, isStandalonePWA } from "./pwa";
import { supabase } from "../supabaseClient";
import { getSavedAccounts } from "./savedAccounts";
import { API_BASE } from "./apiBase.js";

const PENDING_REMOVALS_KEY = "examnexus_push_pending_removals";
/** Must match backend/lib/pushSender.js ALERTS_CHANNEL_ID */
export const PUSH_ALERTS_CHANNEL_ID = "examnexus_alerts";

let initialized = false;
let lastToken = null;
let listenersBound = false;

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

function notifyPushEnabled() {
  window.dispatchEvent(new CustomEvent("en:push-enabled"));
}

function notifyPushReceived(detail = {}) {
  window.dispatchEvent(new CustomEvent("en:push-received", { detail }));
}

/** Current signed-in ExamNexus user id (cache only — never mutate from push). */
function getCachedUserId() {
  try {
    const raw = localStorage.getItem("examnexus_user");
    const user = raw ? JSON.parse(raw) : null;
    return user?.id ? String(user.id) : "";
  } catch {
    return "";
  }
}

/**
 * Ignore pushes addressed to a different saved account on this device.
 * Never merge notification payloads into the profile / localStorage.
 */
function isPushForCurrentUser(notification) {
  const data = notification?.data || {};
  const recipient = String(
    data.recipient_user_id || data.recipientUserId || ""
  ).trim();
  if (!recipient) return true;
  const currentId = getCachedUserId();
  if (!currentId) return true;
  return recipient === currentId;
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
      return;
    }
    notifyPushEnabled();
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
 * Whether we should actively request notification permission.
 * Installed shells (APK via Capacitor path, or A2HS / desktop PWA) should prompt.
 */
export function shouldRequestPushPermission() {
  if (isNativeApp()) return true;
  if (!canUseWebPush()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return isStandalonePWA();
}

/**
 * Register Web Push for installed PWA (desktop + iOS/Android Add to Home Screen).
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
    notifyPushEnabled();
    return true;
  } catch (err) {
    console.warn("Web push init skipped:", err?.message || err);
    return false;
  }
}

async function ensureAndroidAlertsChannel(PushNotifications) {
  if (getPlatform() !== "android") return;
  if (typeof PushNotifications.createChannel !== "function") return;

  try {
    await PushNotifications.createChannel({
      id: PUSH_ALERTS_CHANNEL_ID,
      name: "ExamNexus Alerts",
      description: "Announcements, assessments, and account alerts",
      importance: 5,
      visibility: 1,
      sound: "default",
      vibration: true,
      lights: true,
    });
  } catch (err) {
    console.warn("Push channel create skipped:", err?.message || err);
  }
}

function showForegroundBanner(notification) {
  if (!isPushForCurrentUser(notification)) return;

  const title = notification?.title || "ExamNexus";
  const body = notification?.body || "";
  const data = notification?.data || {};

  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      const n = new Notification(title, {
        body,
        tag: data.tag || data.kind || "examnexus",
        data,
      });
      n.onclick = () => {
        const path = data.path || data.url || "";
        if (typeof path === "string" && path.startsWith("/")) {
          window.dispatchEvent(
            new CustomEvent("en:push-navigate", { detail: { path } })
          );
        }
        n.close();
      };
      return;
    }
  } catch {
    // Fall through — in-app bell still refreshes.
  }
}

/**
 * Register for native push notifications (Capacitor iOS/Android only).
 * @returns {Promise<boolean>}
 */
export async function initPushNotifications() {
  if (!isNativeApp()) {
    return initWebPushNotifications({ requestPermission: true });
  }

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive !== "granted") {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== "granted") {
      console.warn("Push notification permission not granted");
      return false;
    }

    await ensureAndroidAlertsChannel(PushNotifications);

    if (!listenersBound) {
      listenersBound = true;

      PushNotifications.addListener("registration", async (token) => {
        await upsertToken(token?.value);
        await flushPendingRemovals();
      });

      PushNotifications.addListener("registrationError", (err) => {
        console.warn("Push registration error:", err?.error || err);
      });

      PushNotifications.addListener("pushNotificationReceived", (notification) => {
        // App is open: refresh in-app bell immediately and show a heads-up when possible.
        // Never write notification fields into examnexus_user / profile.
        if (!isPushForCurrentUser(notification)) return;
        notifyPushReceived(notification);
        showForegroundBanner(notification);
      });

      PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
        const notification = action?.notification;
        if (!isPushForCurrentUser(notification)) return;
        const data = notification?.data || {};
        const path = data.path || data.url || "";
        notifyPushReceived(notification);
        if (path && typeof path === "string" && path.startsWith("/")) {
          window.location.hash = "";
          window.dispatchEvent(
            new CustomEvent("en:push-navigate", { detail: { path } })
          );
        }
      });
    }

    if (initialized) {
      if (lastToken) await upsertToken(lastToken);
      return Boolean(lastToken);
    }

    await PushNotifications.register();
    initialized = true;
    return true;
  } catch (err) {
    console.warn("Push notifications init skipped:", err?.message || err);
    return false;
  }
}

/** Add this device token for the signed-in user (does not remove other accounts). */
export async function syncPushTokenForCurrentUser() {
  if (!isNativeApp()) {
    if (lastToken) {
      await upsertToken(lastToken, "web");
      await flushPendingRemovals();
      return Boolean(lastToken);
    }
    return initWebPushNotifications({
      // Prompt on installed PWA (A2HS / desktop install), not every casual browser tab.
      requestPermission: shouldRequestPushPermission(),
    });
  }
  if (lastToken) {
    await upsertToken(lastToken);
    await flushPendingRemovals();
    return true;
  }
  return initPushNotifications();
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

/** True when this installed shell still needs the user to allow alerts. */
export async function needsPushPermissionPrompt() {
  if (isNativeApp()) {
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      const perm = await PushNotifications.checkPermissions();
      return perm.receive !== "granted";
    } catch {
      return false;
    }
  }

  if (!canUseWebPush() || !isStandalonePWA()) return false;
  return Notification.permission !== "granted";
}
