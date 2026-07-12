import { isIOS } from "./pwa";

/**
 * iOS Safari zooms into inputs with font-size < 16px and often stays zoomed
 * after blur. Keep form controls at 16px+ and gently reset scale on blur.
 */
export function initIosInputZoomFix() {
  if (typeof document === "undefined") return;
  if (!isIOS()) return;

  document.documentElement.classList.add("en-ios");

  const viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) return;

  const baseContent =
    viewport.getAttribute("content") ||
    "width=device-width, initial-scale=1.0, viewport-fit=cover";

  const resetZoom = () => {
    // Briefly lock scale so Safari undoes focus zoom, then restore pinch-zoom.
    viewport.setAttribute(
      "content",
      `${baseContent.replace(/,?\s*maximum-scale=[^,]+/g, "")}, maximum-scale=1`
    );
    window.requestAnimationFrame(() => {
      viewport.setAttribute("content", baseContent);
    });
  };

  document.addEventListener(
    "focusout",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      window.setTimeout(resetZoom, 50);
    },
    true
  );
}
