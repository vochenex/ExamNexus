import { isIOS, isStandalonePWA } from "./pwa";

/**
 * iOS Safari (and Add to Home Screen) zooms into inputs with font-size < 16px
 * and often stays zoomed after blur — pinch-out then does nothing.
 *
 * Strategy:
 *  1. Mark html.en-ios so CSS forces 16px+ form controls
 *  2. On blur / hide keyboard, force scale back to 1 via the viewport meta
 *  3. In standalone (home-screen) mode, keep maximum-scale=1 so it can't stick
 */
export function initIosInputZoomFix() {
  if (typeof document === "undefined") return;
  if (!isIOS()) return;

  document.documentElement.classList.add("en-ios");

  const viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) return;

  const allowPinch =
    "width=device-width, initial-scale=1.0, viewport-fit=cover";
  const lockScale =
    "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover";

  // Home-screen PWA: permanently lock scale — stuck zoom has no reliable undo there.
  if (isStandalonePWA()) {
    viewport.setAttribute("content", lockScale);
    return;
  }

  viewport.setAttribute("content", allowPinch);

  let resetTimer = 0;
  const resetZoom = () => {
    window.clearTimeout(resetTimer);
    viewport.setAttribute("content", lockScale);
    // Safari needs a beat to apply the lock before we re-allow pinch.
    resetTimer = window.setTimeout(() => {
      viewport.setAttribute("content", allowPinch);
    }, 350);
  };

  const maybeReset = () => {
    const scale = window.visualViewport?.scale;
    if (typeof scale === "number" && scale > 1.01) {
      resetZoom();
      return;
    }
    resetZoom();
  };

  document.addEventListener(
    "focusout",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const tag = target.tagName;
      const isField =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target.isContentEditable;
      if (!isField) return;
      window.setTimeout(maybeReset, 80);
    },
    true
  );

  // Keyboard dismiss / app resume can leave scale stuck without a focusout.
  window.visualViewport?.addEventListener("resize", () => {
    const scale = window.visualViewport?.scale;
    if (typeof scale === "number" && scale > 1.01) {
      const active = document.activeElement;
      const stillEditing =
        active instanceof HTMLElement &&
        (["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName) ||
          active.isContentEditable);
      if (!stillEditing) maybeReset();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") maybeReset();
  });
}
