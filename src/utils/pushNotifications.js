import { Capacitor } from "@capacitor/core";
import { isNativeApp, getPlatform } from "./platform";
import { supabase } from "../supabaseClient";

let initialized = false;
let lastToken = null;

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

/**
 * Register for native push notifications (Capacitor iOS/Android only).
 * Saves the FCM/APNs token against the signed-in user so the backend can
 * deliver announcement / notification pushes to their phone.
 */
export async function initPushNotifications() {
  if (!isNativeApp() || initialized) return;
  initialized = true;

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

    PushNotifications.addListener("registration", (token) => {
      upsertToken(token?.value);
    });

    PushNotifications.addListener("registrationError", (err) => {
      console.warn("Push registration error:", err?.error || err);
    });

    PushNotifications.addListener("pushNotificationReceived", () => {
      // Foreground delivery is handled by the OS / in-app notification bell.
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

/** Re-bind the current device token to the signed-in user (call after login). */
export async function syncPushTokenForCurrentUser() {
  if (!isNativeApp()) return;
  if (lastToken) {
    await upsertToken(lastToken);
    return;
  }
  await initPushNotifications();
}

export async function removeCurrentPushToken() {
  if (!isNativeApp() || !lastToken) return;
  try {
    await supabase.rpc("remove_push_device", { p_token: lastToken });
  } catch {
    // ignore
  }
  lastToken = null;
}

export function isPushAvailable() {
  return isNativeApp() && Capacitor.isPluginAvailable("PushNotifications");
}
