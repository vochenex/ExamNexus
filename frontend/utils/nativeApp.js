import { isNativeApp, getPlatform } from "./platform";
import { initPushNotifications } from "./pushNotifications";
import { dispatchAndroidBack } from "./nativeBack";

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
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
    if (getPlatform() === "android") {
      await StatusBar.setBackgroundColor({
        color: isDark ? "#031d1f" : "#f8fafc",
      });
    }
  } catch (err) {
    console.warn("StatusBar init skipped:", err);
  }

  try {
    const { App } = await import("@capacitor/app");
    // Do NOT call history.back() here — that walks into previous accounts.
    // React NativeBackBridge decides a safe in-role destination or exit confirm.
    App.addListener("backButton", () => {
      dispatchAndroidBack();
    });
  } catch (err) {
    console.warn("App back-button init skipped:", err);
  }

  try {
    const { Keyboard, KeyboardResize } = await import("@capacitor/keyboard");
    await Keyboard.setResizeMode({ mode: KeyboardResize.Body });
    await Keyboard.setScroll({ isDisabled: false });
  } catch (err) {
    console.warn("Keyboard init skipped:", err);
  }

  setTimeout(() => {
    initPushNotifications().catch((err) => {
      console.warn("Push init deferred error:", err);
    });
  }, 1500);
}
