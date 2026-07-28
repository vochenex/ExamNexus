import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { resolveRouteFileInfo } from "../config/routeFileMap";

const STORAGE_KEY = "examnexus_show_file_debug";

function readEnabled() {
  if (typeof window === "undefined") return false;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "1") return true;
    if (stored === "0") return false;
  } catch {
    // ignore
  }
  return Boolean(import.meta.env.DEV);
}

/**
 * Floating badge that shows which page source file owns the current route.
 * Visible in local `npm run dev` by default.
 * Toggle: localStorage examnexus_show_file_debug = "1" | "0"
 * Or press Ctrl+Shift+D
 */
export default function DevRouteFileIndicator() {
  const location = useLocation();
  const [enabled, setEnabled] = useState(readEnabled);
  const [copied, setCopied] = useState(false);

  const info = useMemo(
    () => resolveRouteFileInfo(location.pathname),
    [location.pathname]
  );

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "d") {
        event.preventDefault();
        setEnabled((current) => {
          const next = !current;
          try {
            localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
          } catch {
            // ignore
          }
          return next;
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!enabled) return null;

  const copyPath = async () => {
    try {
      await navigator.clipboard.writeText(info.file);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="pointer-events-auto fixed bottom-3 left-3 z-[9999] max-w-[min(92vw,28rem)] rounded-xl border border-amber-400/40 bg-[#0b1114]/95 px-3 py-2 text-left shadow-2xl backdrop-blur-md"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-300/90">
            Debug · page file
          </p>
          <p className="mt-0.5 text-xs font-semibold text-white">{info.label}</p>
          <p className="mt-1 break-all font-mono text-[11px] leading-snug text-emerald-300">
            {info.file}
          </p>
          <p className="mt-1 break-all font-mono text-[10px] text-gray-400">
            route: {location.pathname}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <button
            type="button"
            onClick={copyPath}
            className="rounded-md border border-white/10 px-2 py-1 text-[10px] font-semibold text-gray-200 hover:bg-white/10"
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={() => {
              setEnabled(false);
              try {
                localStorage.setItem(STORAGE_KEY, "0");
              } catch {
                // ignore
              }
            }}
            className="rounded-md border border-white/10 px-2 py-1 text-[10px] font-semibold text-gray-400 hover:bg-white/10"
            title="Hide (Ctrl+Shift+D to show again)"
          >
            Hide
          </button>
        </div>
      </div>
      <p className="mt-1.5 text-[9px] text-gray-500">Toggle: Ctrl+Shift+D</p>
    </div>
  );
}
