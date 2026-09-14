import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  normalizeSourcePath,
  resolveRouteFileInfo,
} from "../config/routeFileMap";

const STORAGE_KEY = "examnexus_location_toast";
const TOAST_MS = 4200;

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

function shortFile(path) {
  const normalized = normalizeSourcePath(path) || String(path || "");
  const parts = normalized.split("/");
  return parts.slice(-2).join("/") || normalized || "(unknown)";
}

function getReactFiber(node) {
  if (!node || node.nodeType !== 1) return null;
  const keys = Object.keys(node);
  for (const key of keys) {
    if (
      key.startsWith("__reactFiber$") ||
      key.startsWith("__reactInternalInstance$")
    ) {
      return node[key];
    }
  }
  return null;
}

function fiberComponentName(fiber) {
  if (!fiber) return "";
  const type = fiber.type;
  if (typeof type === "string") return type;
  if (typeof type === "function") {
    return type.displayName || type.name || "";
  }
  if (type && typeof type === "object") {
    return (
      type.displayName ||
      type.render?.displayName ||
      type.render?.name ||
      type.type?.displayName ||
      type.type?.name ||
      ""
    );
  }
  return "";
}

/**
 * Walk React fiber from a DOM node to find the nearest debug source
 * (file + line) available in development builds.
 */
function resolveDomSource(startNode) {
  let el =
    startNode?.nodeType === 3 ? startNode.parentElement : startNode;
  while (el && el !== document.body) {
    const fiber = getReactFiber(el);
    if (fiber) {
      let current = fiber;
      let source = null;
      let component = "";
      while (current) {
        if (!source && current._debugSource) {
          source = current._debugSource;
        }
        if (!component) {
          const name = fiberComponentName(current);
          if (name && name[0] === name[0]?.toUpperCase() && name !== "Anonymous") {
            component = name;
          }
        }
        if (source && component) break;
        current = current.return;
      }
      if (source || component) {
        return {
          file: source?.fileName
            ? normalizeSourcePath(source.fileName)
            : "",
          line: source?.lineNumber || null,
          column: source?.columnNumber || null,
          component,
        };
      }
    }
    el = el.parentElement;
  }
  return null;
}

function readSelectionContext() {
  const selection = window.getSelection?.();
  if (!selection || selection.isCollapsed || !selection.rangeCount) {
    return null;
  }

  const text = String(selection.toString() || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;

  const range = selection.getRangeAt(0);
  const node = range.commonAncestorContainer;
  const source = resolveDomSource(node);

  return {
    text: text.length > 72 ? `${text.slice(0, 72)}…` : text,
    source,
  };
}

/**
 * Ctrl+Q toast: live page file + selection → source location.
 */
export default function DevLocationToast() {
  const location = useLocation();
  const [enabled, setEnabled] = useState(readEnabled);
  const [toast, setToast] = useState(null);
  const hideTimerRef = useRef(0);
  const flashKeyRef = useRef(0);

  const showToast = useCallback((next) => {
    flashKeyRef.current += 1;
    setToast({ ...next, key: flashKeyRef.current });
    window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      setToast((current) =>
        current?.key === flashKeyRef.current ? null : current
      );
    }, TOAST_MS);
  }, []);

  const showPageToast = useCallback(() => {
    const info = resolveRouteFileInfo(location.pathname);
    showToast({
      kind: "page",
      title: info.label || "Page",
      file: info.file,
      detail: location.pathname,
    });
  }, [location.pathname, showToast]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) {
        return;
      }
      if (event.key.toLowerCase() !== "q") return;
      event.preventDefault();
      setEnabled((current) => {
        const next = !current;
        writeEnabled(next);
        if (next) {
          // Show current page immediately when enabled.
          window.setTimeout(() => {
            const info = resolveRouteFileInfo(window.location.pathname);
            showToast({
              kind: "page",
              title: info.label || "Page",
              file: info.file,
              detail: window.location.pathname,
            });
          }, 0);
        } else {
          setToast(null);
          window.clearTimeout(hideTimerRef.current);
        }
        return next;
      });
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showToast]);

  useEffect(() => {
    if (!enabled) return undefined;
    showPageToast();
  }, [enabled, location.pathname, showPageToast]);

  useEffect(() => {
    if (!enabled) return undefined;

    let frame = 0;
    const publishSelection = () => {
      const ctx = readSelectionContext();
      if (!ctx) return;

      const route = resolveRouteFileInfo(location.pathname);
      const src = ctx.source;
      const file =
        src?.file ||
        route.file ||
        "(no mapped page file)";
      const linePart =
        src?.line != null ? `:${src.line}${src.column != null ? `:${src.column}` : ""}` : "";
      const componentPart = src?.component ? ` · <${src.component}>` : "";

      showToast({
        kind: "selection",
        title: "Selection",
        file: `${file}${linePart}`,
        detail: `${ctx.text}${componentPart}`,
      });
    };

    const onSelectionChange = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(publishSelection);
    };

    document.addEventListener("selectionchange", onSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      window.cancelAnimationFrame(frame);
    };
  }, [enabled, location.pathname, showToast]);

  useEffect(
    () => () => {
      window.clearTimeout(hideTimerRef.current);
    },
    []
  );

  if (!enabled || !toast) return null;

  const fileDisplay = shortFile(toast.file);
  const fullFile = toast.file;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[100002] flex justify-center px-3"
      role="status"
      aria-live="polite"
    >
      <div
        key={toast.key}
        className="en-location-toast pointer-events-auto w-[min(92vw,28rem)] rounded-2xl border border-emerald-400/35 bg-[#0c1412]/95 px-3.5 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-300/90">
              {toast.kind === "selection" ? "Text location" : "Open page"}
              <span className="ml-2 font-medium normal-case tracking-normal text-white/45">
                Ctrl+Q
              </span>
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-white">
              {toast.title}
            </p>
            <p
              className="mt-1 break-all font-mono text-[11px] leading-snug text-emerald-300"
              title={fullFile}
            >
              {fileDisplay}
              {fullFile !== fileDisplay ? (
                <span className="block truncate text-[10px] text-emerald-300/70">
                  {fullFile}
                </span>
              ) : null}
            </p>
            {toast.detail ? (
              <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-white/65">
                {toast.detail}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="shrink-0 rounded-md border border-white/10 px-2 py-1 text-[10px] font-semibold text-white/55 hover:bg-white/10 hover:text-white"
            onClick={() => {
              setEnabled(false);
              writeEnabled(false);
              setToast(null);
            }}
            title="Turn off (Ctrl+Q)"
          >
            Off
          </button>
        </div>
      </div>
    </div>
  );
}
