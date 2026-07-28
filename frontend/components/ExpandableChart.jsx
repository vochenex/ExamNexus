import { useEffect, useState } from "react";
import { Expand, Minimize2, X } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import ModalPortal from "./ui/ModalPortal";
import { isNativeApp } from "../utils/platform";

async function lockLandscape() {
  try {
    if (isNativeApp()) {
      const { ScreenOrientation } = await import("@capacitor/screen-orientation");
      await ScreenOrientation.lock({ orientation: "landscape" });
      return;
    }
    const root = document.documentElement;
    if (root.requestFullscreen) {
      await root.requestFullscreen().catch(() => {});
    } else if (root.webkitRequestFullscreen) {
      root.webkitRequestFullscreen();
    }
    if (screen?.orientation?.lock) {
      await screen.orientation.lock("landscape");
    }
  } catch {
    /* unsupported */
  }
}

async function unlockOrientation() {
  try {
    if (isNativeApp()) {
      const { ScreenOrientation } = await import("@capacitor/screen-orientation");
      await ScreenOrientation.unlock();
      return;
    }
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      if (document.exitFullscreen) {
        await document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
    if (screen?.orientation?.unlock) {
      screen.orientation.unlock();
    }
  } catch {
    /* ignore */
  }
}

/**
 * Fits charts inside the card by default. Long series open fullscreen
 * (landscape on mobile) so users can pan dates without blowing out the page.
 */
export default function ExpandableChart({
  title = "Chart",
  children,
  className = "",
  previewMaxBars = 5,
}) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return undefined;
    lockLandscape();
    return () => {
      unlockOrientation();
    };
  }, [expanded]);

  return (
    <>
      <div className={`en-chart-shell relative w-full max-w-full min-w-0 overflow-hidden ${className}`}>
        <div className="en-chart-preview w-full max-w-full min-w-0 overflow-hidden">
          {children}
        </div>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className={`en-chart-expand-btn absolute right-1 top-1 z-10 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold ${
            theme === "dark"
              ? "bg-black/55 text-emerald-200 ring-1 ring-emerald-500/30"
              : "bg-white/90 text-teal-800 ring-1 ring-teal-200 shadow-sm"
          }`}
          aria-label={`Expand ${title}`}
        >
          <Expand size={12} />
          Expand
        </button>
      </div>

      {expanded && (
        <ModalPortal>
          <div className="en-chart-landscape-modal fixed inset-0 z-[140] flex items-center justify-center bg-black/85 p-2 backdrop-blur-sm sm:p-4">
            <div
              className={`relative flex max-h-[100dvh] w-full max-w-[96vw] min-h-0 flex-col overflow-hidden rounded-2xl border ${
                theme === "dark"
                  ? "border-emerald-500/25 bg-[#071412]"
                  : "border-emerald-200 bg-white"
              }`}
            >
              <div
                className={`flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3 ${
                  theme === "dark" ? "border-white/10" : "border-emerald-100"
                }`}
              >
                <h3
                  className={`text-sm font-bold ${
                    theme === "dark" ? "text-emerald-300" : "text-teal-800"
                  }`}
                >
                  {title}
                </h3>
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                    theme === "dark"
                      ? "bg-white/10 text-gray-200"
                      : "bg-emerald-50 text-teal-800"
                  }`}
                  aria-label="Close expanded chart"
                >
                  <Minimize2 size={14} />
                  Close
                  <X size={14} />
                </button>
              </div>
              <div className="en-chart-scroll-area en-chart-expanded en-inner-scroll flex min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-x-contain p-3 sm:p-5">
                <div className="inline-block min-w-full py-1">
                  {typeof children === "function"
                    ? children({ expanded: true, previewMaxBars })
                    : children}
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
