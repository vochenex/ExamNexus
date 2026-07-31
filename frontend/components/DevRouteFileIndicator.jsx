import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  normalizeSourcePath,
  resolvePagesForSourceFile,
  resolveRouteFileInfo,
} from "../config/routeFileMap";

const STORAGE_KEY = "examnexus_show_file_debug";
const MAX_EVENTS = 8;
const GLOBAL_KEY = "__EN_DEV_DEBUG__";

function readEnabled() {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeEnabled(next) {
  try {
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    // ignore
  }
}

function formatTime(value) {
  try {
    return new Date(value).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
}

function ensureGlobalStore() {
  if (typeof window === "undefined") return { events: [], lastError: null };
  if (!window[GLOBAL_KEY]) {
    window[GLOBAL_KEY] = { events: [], lastError: null };
  }
  return window[GLOBAL_KEY];
}

function readText(root, selectors) {
  for (const selector of selectors) {
    const node = root.querySelector(selector);
    const text = node?.textContent?.trim();
    if (text) return text;
  }
  return "";
}

function readViteOverlayError() {
  const overlay = document.querySelector("vite-error-overlay");
  if (!overlay) return null;
  const root = overlay.shadowRoot || overlay;
  const message = readText(root, [".message-body", ".message", "pre.message"]);
  const file = readText(root, [".file"]);
  const frame = readText(root, [".frame", "pre.frame"]);
  if (!message && !file && !frame) return null;
  return {
    file: normalizeSourcePath(file) || "(from Vite overlay)",
    message: [message, frame].filter(Boolean).join("\n").slice(0, 700),
  };
}

function buildErrorRecord({ file, message }) {
  const normalizedFile = normalizeSourcePath(file) || file || "(unknown file)";
  return {
    id: `${Date.now()}-error`,
    at: Date.now(),
    file: normalizedFile,
    message: String(message || "Vite reported a compile error.").slice(0, 700),
    affected: resolvePagesForSourceFile(normalizedFile),
  };
}

/**
 * Hidden-by-default HMR debugger.
 * Toggle: Ctrl+D. Auto-opens on compile/parse errors (above Vite's overlay).
 */
export default function DevRouteFileIndicator() {
  const location = useLocation();
  const store = ensureGlobalStore();
  const [enabled, setEnabled] = useState(readEnabled);
  const [events, setEvents] = useState(() => store.events || []);
  const [lastError, setLastError] = useState(() => store.lastError || null);
  const [copied, setCopied] = useState(false);
  const lastErrorKeyRef = useRef(store.lastError ? `${store.lastError.file}::${store.lastError.message}` : "");

  const info = useMemo(
    () => resolveRouteFileInfo(location.pathname),
    [location.pathname]
  );

  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;

    const onKeyDown = (event) => {
      if (!event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) return;
      if (event.key.toLowerCase() !== "d") return;
      const tag = event.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || event.target?.isContentEditable) {
        return;
      }
      event.preventDefault();
      setEnabled((current) => {
        const next = !current;
        writeEnabled(next);
        return next;
      });
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;

    const persist = (nextEvents, nextError) => {
      const globalStore = ensureGlobalStore();
      globalStore.events = nextEvents;
      globalStore.lastError = nextError;
    };

    const pushEvent = (entry) => {
      setEvents((current) => {
        const next = [entry, ...current].slice(0, MAX_EVENTS);
        persist(next, ensureGlobalStore().lastError);
        return next;
      });
    };

    const publishError = (raw) => {
      if (!raw?.message && !raw?.file) return;
      const nextError = buildErrorRecord(raw);
      const key = `${nextError.file}::${nextError.message}`;
      if (key === lastErrorKeyRef.current) {
        setEnabled(true);
        writeEnabled(true);
        return;
      }
      lastErrorKeyRef.current = key;
      setLastError(nextError);
      setEvents((current) => {
        const next = [
          {
            id: nextError.id,
            type: "error",
            at: nextError.at,
            changedFiles: nextError.file ? [nextError.file] : [],
            affected: nextError.affected,
            message: nextError.message,
          },
          ...current,
        ].slice(0, MAX_EVENTS);
        persist(next, nextError);
        return next;
      });
      setEnabled(true);
      writeEnabled(true);
    };

    const clearError = () => {
      lastErrorKeyRef.current = "";
      setLastError(null);
      const globalStore = ensureGlobalStore();
      globalStore.lastError = null;
    };

    const onUpdatePayload = (payload) => {
      const updates = Array.isArray(payload?.updates) ? payload.updates : [];
      const changedFiles = [
        ...new Set(
          updates
            .flatMap((item) => [item?.path, item?.acceptedPath])
            .filter(Boolean)
            .map((path) => normalizeSourcePath(path))
        ),
      ];
      if (!changedFiles.length) return;

      const affected = changedFiles.flatMap((file) =>
        resolvePagesForSourceFile(file).map((page) => ({
          ...page,
          changedFile: file,
        }))
      );

      pushEvent({
        id: `${Date.now()}-${changedFiles[0]}`,
        type: "update",
        at: Date.now(),
        changedFiles,
        affected,
      });
      clearError();
    };

    const onErrorPayload = (payload) => {
      const err = payload?.err || payload || {};
      publishError({
        file: err.id || err.loc?.file || err.filename || "",
        message:
          [err.message, err.frame].filter(Boolean).join("\n") ||
          err.stack ||
          "Vite reported a compile / HMR error.",
      });
    };

    const syncOverlayError = () => {
      const overlayError = readViteOverlayError();
      if (overlayError) {
        publishError(overlayError);
        return;
      }
      if (!document.querySelector("vite-error-overlay") && lastErrorKeyRef.current) {
        // Keep last error visible in our panel until the next successful update.
      }
    };

    const onWindowError = (event) => {
      const file =
        event?.filename ||
        event?.error?.fileName ||
        event?.error?.sourceURL ||
        "";
      const message = event?.message || event?.error?.message || "";
      if (!message) return;
      // Ignore noisy extension / unrelated noise.
      if (String(message).includes("ResizeObserver loop")) return;
      publishError({ file, message: String(message) });
    };

    if (import.meta.hot) {
      import.meta.hot.on("en:dev-error", onErrorPayload);
      import.meta.hot.on("en:dev-update", onUpdatePayload);
      import.meta.hot.on("vite:beforeUpdate", onUpdatePayload);
      import.meta.hot.on("vite:error", onErrorPayload);
    }

    window.addEventListener("error", onWindowError);

    const onCustomError = (event) => onErrorPayload(event.detail);
    const onCustomUpdate = (event) => onUpdatePayload(event.detail);
    window.addEventListener("en:dev-error", onCustomError);
    window.addEventListener("en:dev-update", onCustomUpdate);

    const observer = new MutationObserver(() => {
      window.setTimeout(syncOverlayError, 20);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    syncOverlayError();
    const pollId = window.setInterval(syncOverlayError, 800);

    return () => {
      if (import.meta.hot) {
        import.meta.hot.off("en:dev-error", onErrorPayload);
        import.meta.hot.off("en:dev-update", onUpdatePayload);
        import.meta.hot.off("vite:beforeUpdate", onUpdatePayload);
        import.meta.hot.off("vite:error", onErrorPayload);
      }
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("en:dev-error", onCustomError);
      window.removeEventListener("en:dev-update", onCustomUpdate);
      observer.disconnect();
      window.clearInterval(pollId);
    };
  }, []);

  if (!import.meta.env.DEV || !enabled) return null;

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
      className="pointer-events-auto fixed bottom-3 left-3 max-h-[min(70vh,32rem)] w-[min(92vw,26rem)] overflow-y-auto rounded-xl border border-amber-400/50 bg-[#0b1114] px-3 py-2.5 text-left shadow-2xl"
      style={{ zIndex: 100001 }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-300/90">
            Dev debugger
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
              writeEnabled(false);
            }}
            className="rounded-md border border-white/10 px-2 py-1 text-[10px] font-semibold text-gray-400 hover:bg-white/10"
            title="Hide (Ctrl+D to show again)"
          >
            Hide
          </button>
        </div>
      </div>

      {lastError ? (
        <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-red-300">
            Error · {formatTime(lastError.at)}
          </p>
          <p className="mt-1 break-all font-mono text-[10px] text-red-200">{lastError.file}</p>
          <p className="mt-1 whitespace-pre-wrap text-[11px] leading-snug text-red-100">
            {lastError.message}
          </p>
          {lastError.affected?.length ? (
            <ul className="mt-2 space-y-1">
              {lastError.affected.map((page) => (
                <li key={`${page.file}-${page.label}`} className="text-[10px] text-red-100/90">
                  Affected: {page.label}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 border-t border-white/10 pt-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          Recent code changes
        </p>
        {events.length === 0 ? (
          <p className="mt-1.5 text-[11px] text-gray-500">
            Save a file with a syntax error — this panel should open on top of Vite’s overlay.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {events.map((event) => (
              <li
                key={event.id}
                className={`rounded-lg border px-2 py-1.5 ${
                  event.type === "error"
                    ? "border-red-500/30 bg-red-500/5"
                    : "border-white/10 bg-white/[0.03]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[10px] font-semibold uppercase ${
                      event.type === "error" ? "text-red-300" : "text-emerald-300"
                    }`}
                  >
                    {event.type === "error" ? "Error" : "Updated"}
                  </span>
                  <span className="text-[9px] text-gray-500">{formatTime(event.at)}</span>
                </div>
                {event.changedFiles?.map((file) => (
                  <p key={file} className="mt-1 break-all font-mono text-[10px] text-gray-300">
                    {file}
                  </p>
                ))}
                {event.message ? (
                  <p className="mt-1 whitespace-pre-wrap text-[10px] text-red-200">{event.message}</p>
                ) : null}
                {event.affected?.length ? (
                  <ul className="mt-1 space-y-0.5">
                    {event.affected.slice(0, 4).map((page) => (
                      <li
                        key={`${event.id}-${page.file}-${page.label}`}
                        className="text-[10px] text-amber-200/90"
                      >
                        → {page.label}
                        {page.relation === "shared" ? " (shared)" : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-2 text-[9px] text-gray-500">
        Toggle: Ctrl+D · restart `npm run dev` once after this update
      </p>
    </div>
  );
}
