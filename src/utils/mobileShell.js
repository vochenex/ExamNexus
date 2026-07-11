import { isMobileOrTabletDevice, isNativeApp } from "./platform";

const MOBILE_QUERY = "(max-width: 1023px)";

/**
 * Compact UI shell used by the native APK and by phones / tablets / iPads
 * viewing the Vercel website. Mirrors the density, chart, and scroll polish
 * that used to apply only under html.en-native-app.
 */
export function shouldUseMobileShell() {
  if (typeof window === "undefined") return false;
  if (isNativeApp()) return true;
  if (isMobileOrTabletDevice()) return true;
  try {
    return window.matchMedia(MOBILE_QUERY).matches;
  } catch {
    return false;
  }
}

export function syncMobileShellClass() {
  if (typeof document === "undefined") return false;
  const enabled = shouldUseMobileShell();
  document.documentElement.classList.toggle("en-mobile-shell", enabled);
  return enabled;
}

/**
 * Keep en-mobile-shell in sync when rotating iPads / resizing the browser.
 * Safe to call on web and native (no-ops extras on native after first paint).
 */
export function initMobileShell() {
  syncMobileShellClass();

  if (typeof window === "undefined" || isNativeApp()) return;

  const onChange = () => syncMobileShellClass();
  window.addEventListener("resize", onChange);
  window.addEventListener("orientationchange", onChange);

  try {
    const mql = window.matchMedia(MOBILE_QUERY);
    mql.addEventListener("change", onChange);
  } catch {
    /* ignore */
  }
}
