import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  normalizeSourcePath,
  resolveRouteFileInfo,
} from "../config/routeFileMap";

const STORAGE_KEY = "examnexus_location_toast";
const TOAST_MS = 5200;
const SOURCE_CACHE = new Map();

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
  if (!node) return null;
  const el = node.nodeType === 3 ? node.parentElement : node;
  if (!el || el.nodeType !== 1) return null;
  const keys = Object.keys(el);
  for (const key of keys) {
    if (
      key.startsWith("__reactFiber$") ||
      key.startsWith("__reactInternalInstance$")
    ) {
      return el[key];
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

function isAppSourcePath(filePath) {
  const file = normalizeSourcePath(filePath);
  if (!file) return false;
  if (file.includes("node_modules")) return false;
  if (file.includes("@react-refresh") || file.includes("vite/")) return false;
  return (
    file.startsWith("frontend/") ||
    file.includes("/frontend/") ||
    /\.(jsx?|tsx?)$/.test(file)
  );
}

/**
 * Parse React 19 `_debugStack` / Error stacks into app file frames.
 * Example: at AssessmentAiGenerator (http://localhost:5173/frontend/components/Foo.jsx:690:11)
 */
function parseStackFrames(stackText) {
  const text = String(stackText || "");
  if (!text) return [];
  const frames = [];
  const re =
    /(?:at\s+(?:(.+?)\s+)?\(?|@)((?:https?:\/\/[^)\s]+|\/[^)\s]+|[A-Za-z]:\\[^)\s]+))\)?/g;
  let match;
  while ((match = re.exec(text))) {
    const rawUrl = String(match[2] || "");
    const name = String(match[1] || "").trim();
    const cleaned = rawUrl
      .replace(/^https?:\/\/[^/]+/, "")
      .replace(/^\//, "")
      .split("?")[0];
    const locMatch = cleaned.match(/^(.*):(\d+):(\d+)$/);
    if (!locMatch) continue;
    const file = normalizeSourcePath(locMatch[1]);
    if (!isAppSourcePath(file)) continue;
    if (!file.includes("frontend/") && !file.startsWith("frontend")) {
      // Absolute Windows /@fs paths already normalized; keep frontend-only hits.
      if (!/pages|components|layouts|hooks|utils|contexts/.test(file)) continue;
    }
    frames.push({
      name: name && !name.startsWith("http") ? name : "",
      file: file.startsWith("frontend/")
        ? file
        : normalizeSourcePath(
            file.includes("frontend/")
              ? file.slice(file.indexOf("frontend/"))
              : `frontend/${file.replace(/^frontend\//, "")}`
          ),
      line: Number.parseInt(locMatch[2], 10) || null,
      column: Number.parseInt(locMatch[3], 10) || null,
    });
  }
  return frames;
}

function framesFromFiber(fiber) {
  const out = [];
  let current = fiber;
  let depth = 0;
  while (current && depth < 40) {
    const name = fiberComponentName(current);
    if (current._debugSource?.fileName) {
      out.push({
        name,
        file: normalizeSourcePath(current._debugSource.fileName),
        line: current._debugSource.lineNumber || null,
        column: current._debugSource.columnNumber || null,
        depth,
        via: "debugSource",
      });
    }
    const stack =
      current._debugStack?.stack ||
      (typeof current._debugStack === "string" ? current._debugStack : "");
    for (const frame of parseStackFrames(stack)) {
      out.push({ ...frame, name: frame.name || name, depth, via: "debugStack" });
    }
    current = current._debugOwner || current.return;
    depth += 1;
  }
  return out;
}

function collectFramesFromNode(node) {
  let el = node?.nodeType === 3 ? node.parentElement : node;
  const all = [];
  let hops = 0;
  while (el && el !== document.body && hops < 25) {
    const fiber = getReactFiber(el);
    if (fiber) {
      all.push(...framesFromFiber(fiber));
      break;
    }
    el = el.parentElement;
    hops += 1;
  }
  return all;
}

function scoreFrame(frame, routeFile, indexFromLeaf) {
  const file = frame.file || "";
  let score = 100 - indexFromLeaf;
  // Prefer the nearest leaf component over the route page host.
  if (file.includes("/components/")) score += 48;
  if (file.includes("/pages/")) score += 12;
  if (file.includes("/hooks/") || file.includes("/utils/")) score += 14;
  if (file.includes("/layouts/")) score += 6;
  if (routeFile && file === routeFile) score += 8;
  if (frame.via === "debugSource") score += 12;
  if (frame.name && /^[A-Z]/.test(frame.name)) score += 10;
  // Closer to the selected DOM node wins.
  if (typeof frame.depth === "number") score += Math.max(0, 24 - frame.depth * 2);
  return score;
}

function pickNearestComponentFrame(frames, routeFile) {
  const comps = frames
    .filter(
      (frame) =>
        frame?.file &&
        frame.file.includes("/components/") &&
        frame.file !== routeFile
    )
    .sort((a, b) => {
      const depthA = Number.isFinite(a.depth) ? a.depth : 99;
      const depthB = Number.isFinite(b.depth) ? b.depth : 99;
      if (depthA !== depthB) return depthA - depthB;
      const namedA = a.name && /^[A-Z]/.test(a.name) ? 0 : 1;
      const namedB = b.name && /^[A-Z]/.test(b.name) ? 0 : 1;
      return namedA - namedB;
    });
  return comps[0] || null;
}

/** Static UI labels like "Prompts:" / "Documents:" that survive dynamic JSX. */
function staticUiFragments(selectedText) {
  const text = String(selectedText || "").replace(/\s+/g, " ").trim();
  if (!text) return [];
  const frags = [];
  for (const match of text.matchAll(
    /\b([A-Za-z][A-Za-z0-9]*(?:[ /&-][A-Za-z0-9]+){0,4}:)/g
  )) {
    const label = String(match[1] || "").trim();
    if (label.length >= 3) frags.push(label);
  }
  return [...new Set(frags)];
}

function findStaticLabelRange(source, selectedText) {
  const labels = staticUiFragments(selectedText);
  if (!labels.length || !source) return null;
  const lines = source.split(/\r?\n/);
  const hits = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const matched = labels.filter((label) => line.includes(label));
    if (!matched.length) continue;
    hits.push({ line: i + 1, matched: matched.length });
  }
  if (!hits.length) return null;
  hits.sort((a, b) => b.matched - a.matched || a.line - b.line);
  const best = hits[0];
  const nearby = hits.filter((hit) => Math.abs(hit.line - best.line) <= 6);
  const startLine = Math.min(...nearby.map((hit) => hit.line));
  const endLine = Math.max(...nearby.map((hit) => hit.line));
  return {
    startLine,
    endLine,
    kind: "labels",
    score: 160 + best.matched * 30 + labels.length * 8,
  };
}

function pickBestFrame(frames, routeFile) {
  if (!frames.length) return null;
  let best = null;
  let bestScore = -Infinity;
  frames.forEach((frame, index) => {
    const score = scoreFrame(frame, routeFile, index);
    if (score > bestScore) {
      bestScore = score;
      best = frame;
    }
  });
  return best;
}

async function fetchSourceText(filePath) {
  const file = normalizeSourcePath(filePath);
  if (!file) return "";
  if (SOURCE_CACHE.has(file)) return SOURCE_CACHE.get(file);

  const candidates = [
    `/${file}`,
    `/@fs/${file.replace(/^frontend\//, "")}`,
  ];
  // Vite serves repo-root paths like /frontend/components/...
  for (const url of candidates) {
    try {
      const res = await fetch(url, { cache: "force-cache" });
      if (!res.ok) continue;
      const text = await res.text();
      if (text && !text.trimStart().startsWith("<!")) {
        SOURCE_CACHE.set(file, text);
        return text;
      }
    } catch {
      // try next
    }
  }
  SOURCE_CACHE.set(file, "");
  return "";
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function selectionTokens(selectedText) {
  return String(selectedText || "")
    .split(/[^A-Za-z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4 && !/^\d+$/.test(t))
    .slice(0, 8);
}

/** Whole-word / identifier-boundary match — avoids "Deleted" hitting "onDeleted". */
function lineHasWholeToken(line, token) {
  if (!line || !token) return false;
  const re = new RegExp(
    `(^|[^A-Za-z0-9_$])${escapeRegExp(token)}([^A-Za-z0-9_$]|$)`
  );
  return re.test(line);
}

function sourceHasWholeToken(source, token) {
  if (!source || !token) return false;
  const re = new RegExp(
    `(^|[^A-Za-z0-9_$])${escapeRegExp(token)}([^A-Za-z0-9_$]|$)`,
    "m"
  );
  return re.test(source);
}

/**
 * Locate selected UI text in a source file.
 * Prefer exact phrase matches; token fallback uses whole-word boundaries only.
 */
function findLineRangeInSource(source, selectedText) {
  const needle = String(selectedText || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!source || !needle || needle.length < 3) return null;

  const lines = source.split(/\r?\n/);

  // 1) Exact contiguous phrase on a single line (best — static UI copy).
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].includes(needle)) {
      return {
        startLine: i + 1,
        endLine: i + 1,
        kind: "exact",
        score: 200 + Math.min(needle.length, 80),
      };
    }
  }

  // 2) Compact whitespace-insensitive phrase (multi-line JSX string chunks).
  const compactNeedle = needle.slice(0, Math.min(needle.length, 120));
  if (compactNeedle.length >= 8) {
    const compactSource = source.replace(/\s+/g, " ");
    if (compactSource.includes(compactNeedle)) {
      const probe = compactNeedle.slice(0, Math.min(32, compactNeedle.length));
      const hits = [];
      for (let i = 0; i < lines.length; i += 1) {
        const compactLine = lines[i].replace(/\s+/g, " ");
        if (compactLine.includes(probe) || lines[i].includes(probe)) {
          hits.push(i + 1);
        }
      }
      if (hits.length === 1) {
        return {
          startLine: hits[0],
          endLine: hits[0],
          kind: "phrase",
          score: 140 + Math.min(needle.length, 40),
        };
      }
      if (hits.length > 1 && hits.length <= 4) {
        return {
          startLine: hits[0],
          endLine: hits[hits.length - 1],
          kind: "phrase",
          score: 110 + Math.min(needle.length, 30),
        };
      }
    }
  }

  // 3) Static UI labels ("Prompts:", "Documents:") for dynamic JSX lines.
  const labelHit = findStaticLabelRange(source, needle);
  if (labelHit) return labelHit;

  // 4) Whole-word token match for short labels.
  const tokens = selectionTokens(needle);
  if (!tokens.length) return null;

  const required =
    tokens.length === 1 ? 1 : Math.max(2, Math.ceil(tokens.length * 0.75));

  let best = null;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    let matched = 0;
    for (const token of tokens) {
      if (lineHasWholeToken(line, token)) matched += 1;
    }
    if (matched < required) continue;
    const score =
      matched * 12 +
      (matched === tokens.length ? 25 : 0) -
      Math.abs(line.length - needle.length) * 0.02;
    if (!best || score > best.score) {
      best = { startLine: i + 1, endLine: i + 1, score, matched, kind: "tokens" };
    }
  }

  if (!best || best.matched < required) return null;
  return {
    startLine: best.startLine,
    endLine: best.endLine,
    kind: best.kind,
    score: best.score,
  };
}

function formatLineRange(startLine, endLine, column) {
  if (!startLine && !endLine) return "";
  if (startLine && endLine && startLine !== endLine) {
    return `:${startLine}-${endLine}`;
  }
  const line = startLine || endLine;
  if (column != null && startLine === endLine) return `:${line}:${column}`;
  return `:${line}`;
}

async function searchDevSourceIndex(selectedText, routeFile) {
  if (!import.meta.env.DEV) return null;
  try {
    const mod = await import("../dev/devSourceRawIndex.js");
    const entries = Object.entries(mod.DEV_SOURCE_RAW || {});
    const needle = String(selectedText || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!needle || !entries.length) return null;

    const tokens = selectionTokens(needle);
    let best = null;

    for (const [key, source] of entries) {
      const file = mod.globKeyToFrontendPath(key);
      const sourceText = String(source || "");
      const found = findLineRangeInSource(sourceText, needle);
      if (!found) continue;

      // Reject weak token-only hits unless every significant token is a whole word.
      if (found.kind === "tokens") {
        const allPresent = tokens.every((token) =>
          sourceHasWholeToken(sourceText, token)
        );
        if (!allPresent || tokens.length < 2) continue;
      }

      let score = found.score || 0;
      // Prefer component exact/label hits over the route page for nested UI.
      if (file.includes("/components/") && found.kind === "exact") score += 70;
      if (file.includes("/components/") && found.kind === "labels") score += 90;
      if (file.includes("/components/") && found.kind === "phrase") score += 45;
      if (file.includes("/components/") && found.kind === "tokens") score += 15;
      if (file === routeFile && (found.kind === "exact" || found.kind === "phrase")) {
        score += 35;
      } else if (file === routeFile) {
        score += 8;
      }
      if (found.kind === "exact") score += 40;
      if (found.kind === "phrase") score += 20;
      if (found.kind === "labels") score += 35;
      if (file.includes("/pages/") && !file.includes("/components/")) score += 5;

      if (!best || score > best.score) {
        best = {
          file,
          startLine: found.startLine,
          endLine: found.endLine,
          kind: found.kind,
          score,
        };
      }
    }
    return best;
  } catch {
    return null;
  }
}

async function resolveSelectionLocation(selection, routeFile) {
  const text = String(selection.toString() || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;

  const range = selection.getRangeAt(0);
  const startFrames = collectFramesFromNode(range.startContainer);
  const endFrames = collectFramesFromNode(range.endContainer);
  const ancestorFrames = collectFramesFromNode(range.commonAncestorContainer);
  const frames = [...startFrames, ...endFrames, ...ancestorFrames];

  const bestStart =
    pickBestFrame(startFrames, routeFile) || pickBestFrame(frames, routeFile);
  const bestEnd = pickBestFrame(endFrames, routeFile) || bestStart;
  const best = pickBestFrame(frames, routeFile);

  const pageFrame = frames.find((f) => f.file && f.file === routeFile);
  const componentFrame =
    pickNearestComponentFrame(startFrames, routeFile) ||
    pickNearestComponentFrame(frames, routeFile) ||
    frames.find(
      (f) =>
        f.file?.includes("/components/") &&
        f.name &&
        /^[A-Z]/.test(f.name) &&
        f.file !== routeFile
    ) ||
    frames.find((f) => f.file?.includes("/components/"));

  // Nested component hosting the DOM node beats the route page host.
  let file =
    componentFrame?.file || best?.file || pageFrame?.file || routeFile || "";
  let startLine =
    componentFrame?.line || bestStart?.line || best?.line || pageFrame?.line || null;
  let endLine = bestEnd?.line || startLine;
  let column =
    componentFrame?.column ?? bestStart?.column ?? best?.column ?? pageFrame?.column ?? null;
  let component =
    componentFrame?.name ||
    best?.name ||
    pageFrame?.name ||
    frames.find((f) => f.name && /^[A-Z]/.test(f.name))?.name ||
    "";

  let matchedFile = null;
  let matchedRange = null;
  let matchedScore = -Infinity;

  const candidateFiles = [
    ...new Set(
      [
        componentFrame?.file,
        ...frames.map((f) => f.file),
        file,
        routeFile,
      ].filter(Boolean)
    ),
  ].slice(0, 12);

  // Search nested components before the route page.
  candidateFiles.sort((a, b) => {
    const rank = (path) => {
      if (path === componentFrame?.file) return 0;
      if (path.includes("/components/")) return 1;
      if (path === routeFile) return 3;
      if (path.includes("/pages/")) return 4;
      return 2;
    };
    return rank(a) - rank(b);
  });

  for (const candidate of candidateFiles) {
    const source = await fetchSourceText(candidate);
    const found = findLineRangeInSource(source, text);
    if (!found) continue;
    let score = found.score || 0;
    if (candidate === componentFrame?.file) score += 100;
    if (candidate.includes("/components/")) score += 55;
    if (candidate === routeFile) score += 10;
    if (found.kind === "exact") score += 40;
    if (found.kind === "labels") score += 50;
    if (found.kind === "phrase") score += 25;
    if (score > matchedScore) {
      matchedFile = candidate;
      matchedRange = found;
      matchedScore = score;
    }
    if (
      found.kind === "exact" &&
      candidate === componentFrame?.file &&
      candidate.includes("/components/")
    ) {
      break;
    }
  }

  // Full DEV index search — prefer strong component hits for nested UI copy.
  const indexHit = await searchDevSourceIndex(text, routeFile);
  if (indexHit) {
    const preferIndex =
      !matchedFile ||
      (indexHit.kind === "exact" && matchedRange?.kind !== "exact") ||
      (indexHit.kind === "labels" &&
        matchedRange?.kind !== "exact" &&
        matchedRange?.kind !== "labels") ||
      (indexHit.kind === "phrase" && matchedRange?.kind === "tokens") ||
      indexHit.score > matchedScore + 10;
    const blockWeakOverride =
      matchedFile?.includes("/components/") &&
      (matchedRange?.kind === "exact" ||
        matchedRange?.kind === "labels" ||
        matchedRange?.kind === "phrase") &&
      indexHit.kind === "tokens" &&
      indexHit.file === routeFile;

    if (preferIndex && !blockWeakOverride) {
      matchedFile = indexHit.file;
      matchedRange = {
        startLine: indexHit.startLine,
        endLine: indexHit.endLine,
        kind: indexHit.kind,
      };
      matchedScore = indexHit.score;
    }
  }

  // Fiber fallback: keep nearest component when text search only hit the page.
  if (
    componentFrame?.file &&
    (!matchedFile ||
      (matchedFile === routeFile &&
        matchedRange?.kind !== "exact" &&
        componentFrame.file !== routeFile))
  ) {
    const componentSource = await fetchSourceText(componentFrame.file);
    const componentFound = findLineRangeInSource(componentSource, text);
    if (componentFound) {
      matchedFile = componentFrame.file;
      matchedRange = componentFound;
    } else if (!matchedFile || matchedFile === routeFile) {
      matchedFile = componentFrame.file;
      matchedRange = {
        startLine: componentFrame.line || null,
        endLine: componentFrame.line || null,
        kind: "fiber",
      };
    }
  }

  if (matchedFile) {
    file = matchedFile;
    startLine = matchedRange.startLine;
    endLine = matchedRange.endLine;
  } else if (startLine && endLine && startLine > endLine) {
    [startLine, endLine] = [endLine, startLine];
  }

  if (!file) file = routeFile || "(unknown file)";

  if (matchedFile?.includes("/components/") || file.includes("/components/")) {
    const pathForName = matchedFile || file;
    const base =
      pathForName.split("/").pop()?.replace(/\.(jsx|tsx|js|ts)$/i, "") || "";
    if (base && /^[A-Z]/.test(base)) component = base;
  } else if (!component && file.includes("/")) {
    const base = file.split("/").pop()?.replace(/\.(jsx|tsx|js|ts)$/i, "") || "";
    if (base && /^[A-Z]/.test(base)) component = base;
  }

  return {
    text: text.length > 80 ? `${text.slice(0, 80)}…` : text,
    file,
    startLine,
    endLine,
    column,
    component,
    lineLabel: formatLineRange(startLine, endLine, column),
  };
}

/**
 * Ctrl+Q toast: live page file + selection → component file + line range.
 */
export default function DevLocationToast() {
  const location = useLocation();
  const [enabled, setEnabled] = useState(readEnabled);
  const [toast, setToast] = useState(null);
  const hideTimerRef = useRef(0);
  const flashKeyRef = useRef(0);
  const resolveSeqRef = useRef(0);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

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
      file: info.file,
    });
  }, [location.pathname, showToast]);

  const publishSelection = useCallback(() => {
    const selection = window.getSelection?.();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return false;

    const route = resolveRouteFileInfo(location.pathname);
    const seq = ++resolveSeqRef.current;

    resolveSelectionLocation(selection, route.file).then((resolved) => {
      if (!resolved || seq !== resolveSeqRef.current) return;
      showToast({
        kind: "selection",
        file: `${resolved.file}${resolved.lineLabel || ""}`,
      });
    });
    return true;
  }, [location.pathname, showToast]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) {
        return;
      }
      if (event.key.toLowerCase() !== "q") return;
      event.preventDefault();

      const selection = window.getSelection?.();
      const hasSelection =
        Boolean(selection) &&
        !selection.isCollapsed &&
        selection.rangeCount > 0 &&
        String(selection.toString() || "").trim().length >= 2;

      // With a highlight: always resolve the nested source (faster debugging).
      if (hasSelection) {
        if (!enabledRef.current) {
          writeEnabled(true);
          setEnabled(true);
        }
        window.setTimeout(() => {
          publishSelection();
        }, 0);
        return;
      }

      // No highlight: toggle page-location mode on/off.
      setEnabled((current) => {
        const next = !current;
        writeEnabled(next);
        if (next) {
          window.setTimeout(() => {
            const info = resolveRouteFileInfo(window.location.pathname);
            showToast({
              kind: "page",
              file: info.file,
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
  }, [publishSelection, showToast]);

  useEffect(() => {
    if (!enabled) return undefined;
    showPageToast();
  }, [enabled, location.pathname, showPageToast]);

  useEffect(() => {
    if (!enabled) return undefined;

    let frame = 0;
    const onSelectionChange = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        publishSelection();
      });
    };

    const onMouseUp = () => {
      window.setTimeout(() => {
        publishSelection();
      }, 0);
    };

    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("mouseup", onMouseUp);
      window.cancelAnimationFrame(frame);
    };
  }, [enabled, publishSelection]);

  useEffect(
    () => () => {
      window.clearTimeout(hideTimerRef.current);
    },
    []
  );

  if (!enabled || !toast) return null;

  return (
    <div
      key={toast.key}
      className="en-location-toast pointer-events-auto fixed bottom-3 right-3 z-[100002] max-w-[min(88vw,22rem)]"
      role="status"
      aria-live="polite"
      title={`${toast.file}\nHighlight text + Ctrl+Q for component · Ctrl+Q alone toggles page mode · click to dismiss`}
      onClick={() => {
        setToast(null);
        window.clearTimeout(hideTimerRef.current);
      }}
    >
      <div className="cursor-pointer rounded-md border border-emerald-400/30 bg-[#0c1412]/92 px-2 py-1 shadow-lg backdrop-blur-sm">
        <p className="truncate font-mono text-[10px] leading-none text-emerald-300">
          {shortFile(toast.file)}
        </p>
      </div>
    </div>
  );
}
