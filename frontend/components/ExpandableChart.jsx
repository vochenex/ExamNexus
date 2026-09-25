import { useEffect, useState } from "react";
import { Expand, Minimize2, X } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import ModalPortal from "./ui/ModalPortal";
import { isNativeApp } from "../utils/platform";

/** Must run from a user gesture — browsers reject fullscreen after awaits/effects. */
function requestChartFullscreenSync() {
  if (isNativeApp()) return Promise.resolve(true);
  const root = document.documentElement;
  try {
    if (typeof root.requestFullscreen === "function") {
      return root.requestFullscreen().then(() => true).catch(() => false);
    }
    if (typeof root.webkitRequestFullscreen === "function") {
      root.webkitRequestFullscreen();
      return Promise.resolve(true);
    }
  } catch {
    return Promise.resolve(false);
  }
  return Promise.resolve(false);
}

async function lockLandscapeAfterFullscreen() {
  try {
    if (isNativeApp()) {
      const { ScreenOrientation } = await import("@capacitor/screen-orientation");
      await ScreenOrientation.lock({ orientation: "landscape" });
      return;
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
 * Fits charts inside the card by default. Expand opens a fullscreen overlay
 * (landscape on mobile) with an exaggerated enter animation.
 */
export default function ExpandableChart({
  title = "Chart",
  children,
  className = "",
  previewMaxBars = 5,
}) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!expanded) return undefined;
    const onFsChange = () => {
      // Native never uses browser fullscreen — ignore spurious events.
      if (isNativeApp()) return;
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        setExpanded(false);
        setClosing(false);
      }
    };
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (document.fullscreenElement || document.webkitFullscreenElement) return;
      e.preventDefault();
      setClosing(true);
      window.setTimeout(() => {
        setExpanded(false);
        setClosing(false);
        void unlockOrientation();
      }, 280);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
      document.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

  const handleExpand = () => {
    setClosing(false);
    setExpanded(true);
    // Keep fullscreen in the same turn as the click (gesture-safe).
    void requestChartFullscreenSync().then((ok) => {
      if (ok || isNativeApp()) {
        void lockLandscapeAfterFullscreen();
      }
    });
  };

  const handleClose = () => {
    setClosing(true);
    window.setTimeout(() => {
      setExpanded(false);
      setClosing(false);
      void unlockOrientation();
    }, 280);
  };

  return (
    <>
      <div className={`en-chart-shell relative w-full max-w-full min-w-0 overflow-hidden ${className}`}>
        <div className="en-chart-preview w-full max-w-full min-w-0 overflow-hidden">
          {children}
        </div>
        <button
          type="button"
          onClick={handleExpand}
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
          <div
            className={`en-chart-landscape-modal fixed inset-0 z-[140] flex items-center justify-center bg-black/85 backdrop-blur-sm ${
              closing ? "en-chart-expand-backdrop-out" : "en-chart-expand-backdrop-in"
            }`}
            style={{
              paddingTop: "max(0.5rem, env(safe-area-inset-top, 0px))",
              paddingRight: "max(0.5rem, env(safe-area-inset-right, 0px))",
              paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))",
              paddingLeft: "max(0.5rem, env(safe-area-inset-left, 0px))",
            }}
          >
            <div
              className={`en-chart-expand-panel relative flex w-full max-w-[96vw] min-h-0 flex-col overflow-hidden rounded-2xl border ${
                closing ? "en-chart-expand-panel-out" : "en-chart-expand-panel-in"
              } ${
                theme === "dark"
                  ? "border-emerald-500/25 bg-[#071412]"
                  : "border-emerald-200 bg-white"
              }`}
              style={{
                maxHeight:
                  "calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 1rem)",
              }}
            >
              <div
                className={`flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3 ${
                  theme === "dark" ? "border-white/10" : "border-emerald-100"
                }`}
              >
                <h3
                  className={`min-w-0 flex-1 truncate text-sm font-bold ${
                    theme === "dark" ? "text-emerald-300" : "text-teal-800"
                  }`}
                >
                  {title}
                </h3>
                <button
                  type="button"
                  onClick={handleClose}
                  className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold sm:px-2.5 ${
                    theme === "dark"
                      ? "bg-white/10 text-gray-200"
                      : "bg-emerald-50 text-teal-800"
                  }`}
                  aria-label="Close expanded chart"
                >
                  <Minimize2 size={14} />
                  <span className="hidden sm:inline">Close</span>
                  <X size={14} className="sm:hidden" />
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
