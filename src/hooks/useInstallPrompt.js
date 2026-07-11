import { useCallback, useEffect, useState } from "react";
import { isNativeApp } from "../utils/platform";
import { ensureServiceWorkerReady, isIOS, isStandalonePWA } from "../utils/pwa";

/**
 * Shared PWA install state. A single module-level listener captures the
 * `beforeinstallprompt` event so multiple UI affordances stay in sync.
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

  if (window.__enInstall) {
    deferredPrompt = window.__enInstall.prompt || null;
    installed = Boolean(window.__enInstall.installed);
  }

  window.addEventListener("en:installprompt", () => {
    deferredPrompt = window.__enInstall?.prompt || deferredPrompt;
    notify();
  });
  window.addEventListener("en:appinstalled", () => {
    deferredPrompt = null;
    installed = true;
    notify();
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    if (window.__enInstall) window.__enInstall.prompt = event;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installed = true;
    if (window.__enInstall) {
      window.__enInstall.prompt = null;
      window.__enInstall.installed = true;
    }
    notify();
  });
}

initInstallListeners();

function waitForDeferredPrompt(timeoutMs = 8000) {
  if (deferredPrompt) return Promise.resolve(deferredPrompt);

  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      if (deferredPrompt) {
        resolve(deferredPrompt);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        resolve(null);
        return;
      }
      window.setTimeout(tick, 250);
    };
    tick();
  });
}

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
  const available = supported;

  /**
   * Prepare the service worker, wait for Chrome's install prompt, then open it.
   * Returns: accepted | dismissed | ios | unavailable
   */
  const promptInstall = useCallback(async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (window.__enInstall) window.__enInstall.prompt = null;
      notify();
      return choice?.outcome || "dismissed";
    }

    if (isIOS()) return "ios";

    await ensureServiceWorkerReady();
    const promptEvent = await waitForDeferredPrompt(8000);
    if (promptEvent) {
      promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      deferredPrompt = null;
      if (window.__enInstall) window.__enInstall.prompt = null;
      notify();
      return choice?.outcome || "dismissed";
    }

    return "unavailable";
  }, []);

  return { available, supported, hasNativePrompt, isIOS: iOS, promptInstall };
}
