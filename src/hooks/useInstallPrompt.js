import { useCallback, useEffect, useState } from "react";
import { isNativeApp } from "../utils/platform";
import { isIOS, isStandalonePWA } from "../utils/pwa";

/**
 * Shared PWA install state. A single module-level listener captures the
 * `beforeinstallprompt` event so multiple UI affordances (header icon +
 * floating pill) stay in sync and never fight over the deferred prompt.
 */
let deferredPrompt = null;
let installed = false;
let initialized = false;
const listeners = new Set();

function notify() {
  listeners.forEach((cb) => cb());
}

function initInstallListeners() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  // Seed from the early capture in index.html (the browser may have fired
  // beforeinstallprompt before this bundle loaded).
  if (window.__enInstall) {
    deferredPrompt = window.__enInstall.prompt || null;
    installed = Boolean(window.__enInstall.installed);
  }

  // Custom events relayed from the early-capture script in index.html.
  window.addEventListener("en:installprompt", () => {
    deferredPrompt = window.__enInstall?.prompt || deferredPrompt;
    notify();
  });
  window.addEventListener("en:appinstalled", () => {
    deferredPrompt = null;
    installed = true;
    notify();
  });

  // Direct listeners as a fallback (in case the inline script didn't run).
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installed = true;
    notify();
  });
}

// Register as early as this module is imported so we don't miss the event.
initInstallListeners();

export function useInstallPrompt() {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const cb = () => forceRender((n) => n + 1);
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, []);

  const supported = !isNativeApp() && !isStandalonePWA() && !installed;
  const hasNativePrompt = !!deferredPrompt;
  const iOS = isIOS();

  // Whether to surface any install affordance at all.
  const available = supported && (hasNativePrompt || iOS);

  /**
   * Trigger the install flow. Returns:
   *  - "accepted" / "dismissed" for the native Chrome/Edge prompt
   *  - "ios" when there is no native prompt (caller should show iOS steps)
   */
  const promptInstall = useCallback(async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      notify();
      return choice?.outcome || "dismissed";
    }
    return "ios";
  }, []);

  return { available, supported, hasNativePrompt, isIOS: iOS, promptInstall };
}
