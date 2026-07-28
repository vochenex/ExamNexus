import { isNativeApp } from "./platform";

const UPDATE_EVENT = "en:sw-update-ready";
const UPDATE_CHECK_INTERVAL_MS = 60 * 1000;

let waitingWorker = null;
let registrationPromise = null;
let applyingUpdate = false;

function emitUpdateReady(worker) {
  waitingWorker = worker || null;
  window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
  // Auto-apply quickly — no multi-second wait.
  try {
    window.setTimeout(() => {
      if (waitingWorker) applyServiceWorkerUpdate();
    }, 250);
  } catch {
    // ignore
  }
}

/** True once a newer service worker is installed and waiting to activate. */
export function hasWaitingUpdate() {
  return Boolean(waitingWorker);
}

export function subscribeServiceWorkerUpdate(callback) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(UPDATE_EVENT, callback);
  if (waitingWorker) callback();
  return () => window.removeEventListener(UPDATE_EVENT, callback);
}

/**
 * Activate the waiting worker (if any) and hard-reload immediately.
 * Previously we only posted SKIP_WAITING and waited for controllerchange,
 * which could hang while the SW finished precache / cache cleanup.
 */
export function applyServiceWorkerUpdate() {
  if (applyingUpdate) return;
  applyingUpdate = true;

  try {
    if (waitingWorker) {
      waitingWorker.postMessage("SKIP_WAITING");
      waitingWorker.postMessage("CLAIM_CLIENTS");
    }
  } catch {
    // ignore
  }

  // Force a fresh document load right away so the UI never sits on "Updating…".
  const url = new URL(window.location.href);
  url.searchParams.set("en_updated", String(Date.now()));
  window.setTimeout(() => {
    window.location.replace(url.toString());
  }, 50);
}

/**
 * Ensure the service worker is registered (and preferably controlling) so the
 * site meets Chrome's installability criteria.
 */
export async function ensureServiceWorkerReady() {
  if (typeof window === "undefined") return null;
  if (isNativeApp()) return null;
  if (!("serviceWorker" in navigator)) return null;
  if (!import.meta.env.PROD) return null;

  registerServiceWorker();
  if (!registrationPromise) return null;

  try {
    const registration = await registrationPromise;
    if (navigator.serviceWorker.controller) return registration;

    // Wait briefly for the first worker to claim the page.
    await Promise.race([
      new Promise((resolve) => {
        const onChange = () => {
          navigator.serviceWorker.removeEventListener("controllerchange", onChange);
          resolve();
        };
        navigator.serviceWorker.addEventListener("controllerchange", onChange);
      }),
      new Promise((resolve) => setTimeout(resolve, 4000)),
    ]);
    return registration;
  } catch {
    return null;
  }
}

/**
 * Register the service worker so ExamNexus becomes an installable PWA.
 * Skipped in the native Capacitor app and in Vite dev (HMR conflict).
 */
export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (isNativeApp()) return;
  if (!("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD) return;
  if (registrationPromise) return;

  registrationPromise = navigator.serviceWorker
    .register("/sw.js", { scope: "/" })
    .then((registration) => {
      if (registration.waiting && navigator.serviceWorker.controller) {
        emitUpdateReady(registration.waiting);
      }

      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (
            newWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            emitUpdateReady(registration.waiting || newWorker);
          }
        });
      });

      const checkForUpdate = () => registration.update().catch(() => {});
      setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") checkForUpdate();
      });

      return registration;
    })
    .catch((err) => {
      console.warn("Service worker registration failed:", err);
      registrationPromise = null;
      return null;
    });
}

/** True when the app is running as an installed/standalone PWA. */
export function isStandalonePWA() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

/** Rough iOS detection for showing manual "Add to Home Screen" instructions. */
export function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iOSDevice = /iPad|iPhone|iPod/.test(ua);
  const iPadOS = ua.includes("Macintosh") && "ontouchend" in document;
  return iOSDevice || iPadOS;
}

/** True in Chrome / Edge / Firefox on iOS (Add to Home Screen is Safari-only). */
export function isIOSNonSafari() {
  return isIOS() && !isIOSSafari();
}

/**
 * Safari on iOS (the only browser that reliably shows Share → Add to Home Screen).
 * Chrome for iOS does not expose that menu item.
 */
export function isIOSSafari() {
  if (!isIOS() || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  // Chrome/Firefox/Edge on iOS still include "Safari" in the UA — exclude them.
  if (/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)) return false;
  if (/Chrome|Firefox|Edg\//.test(ua) && !/Safari\//.test(ua)) return false;
  return /Safari\//.test(ua);
}
