import { isNativeApp } from "./platform";

const UPDATE_EVENT = "en:sw-update-ready";
// How often an open app re-checks the server for a newer service worker.
const UPDATE_CHECK_INTERVAL_MS = 60 * 1000;

let waitingWorker = null;
let reloadOnControllerChange = false;

function emitUpdateReady(worker) {
  waitingWorker = worker || null;
  window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
}

/** True once a newer service worker is installed and waiting to activate. */
export function hasWaitingUpdate() {
  return Boolean(waitingWorker);
}

/**
 * Subscribe to "a new version is ready" notifications. Returns an unsubscribe
 * function. The callback also fires immediately if an update is already ready.
 */
export function subscribeServiceWorkerUpdate(callback) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(UPDATE_EVENT, callback);
  if (waitingWorker) callback();
  return () => window.removeEventListener(UPDATE_EVENT, callback);
}

/**
 * Activate the waiting worker and reload onto the new version. Triggered when
 * the user accepts the update prompt.
 */
export function applyServiceWorkerUpdate() {
  reloadOnControllerChange = true;
  if (waitingWorker) {
    waitingWorker.postMessage("SKIP_WAITING");
  } else {
    // No waiting worker tracked — a hard reload still pulls the latest build.
    window.location.reload();
  }
}

/**
 * Register the service worker so ExamNexus becomes an installable PWA, and
 * detect new deployments so we can prompt the user to update.
 * Skipped in the native Capacitor app (it has its own shell) and in dev,
 * where a caching SW would fight Vite's HMR.
 */
export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (isNativeApp()) return;
  if (!("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD) return;

  // When the fresh worker takes control (after the user accepts), reload once
  // so the app runs the new code. Guard against the first-install claim, which
  // also fires controllerchange but must not reload the page.
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!reloadOnControllerChange) return;
    reloadOnControllerChange = false;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // An update may already be waiting (installed while the app was closed).
        if (registration.waiting && navigator.serviceWorker.controller) {
          emitUpdateReady(registration.waiting);
        }

        // A new worker started installing → watch it become "installed".
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            // "installed" with an existing controller means this is an update,
            // not the very first install.
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              emitUpdateReady(registration.waiting || newWorker);
            }
          });
        });

        // Proactively check for a newer build while the app stays open and
        // whenever it regains focus, so the prompt appears without a manual
        // refresh after you ship changes.
        const checkForUpdate = () => registration.update().catch(() => {});
        setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") checkForUpdate();
        });
      })
      .catch((err) => {
        console.warn("Service worker registration failed:", err);
      });
  });
}

/** True when the app is running as an installed/standalone PWA. */
export function isStandalonePWA() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    window.navigator.standalone === true
  );
}

/** Rough iOS detection for showing manual "Add to Home Screen" instructions. */
export function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iOSDevice = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ reports as Mac; detect touch to disambiguate.
  const iPadOS = ua.includes("Macintosh") && "ontouchend" in document;
  return iOSDevice || iPadOS;
}
