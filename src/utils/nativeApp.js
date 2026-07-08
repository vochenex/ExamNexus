import { isNativeApp, getPlatform } from "./platform";
import { initPushNotifications } from "./pushNotifications";

/**
 * One-time native (Capacitor) setup: status bar styling, Android hardware
 * back-button handling, keyboard behavior, and push notification registration.
 * No-ops on the web build.
 */
export async function initNativeApp() {
  if (!isNativeApp()) return;

  document.documentElement.classList.add("en-native-app", `en-platform-${getPlatform()}`);

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    const isDark = !document.documentElement.classList.contains("light");
    await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
    if (getPlatform() === "android") {
      await StatusBar.setBackgroundColor({ color: "#031d1f" });
    }
  } catch (err) {
    console.warn("StatusBar init skipped:", err);
  }

  try {
    const { App } = await import("@capacitor/app");
    App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });
  } catch (err) {
    console.warn("App back-button init skipped:", err);
  }

  // Register for push after a short delay so auth/session can settle.
  setTimeout(() => {
    initPushNotifications().catch((err) => {
      console.warn("Push init deferred error:", err);
    });
  }, 1500);
}
