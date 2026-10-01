/**
 * Source lookups for the Ctrl+E UI inspector (DEV only).
 * Works off the raw source index plus the data-en-* attributes stamped by
 * frontend/dev/examNexusUiInspectorPlugin.js.
 */

let indexPromise = null;
const linesCache = new Map();

export function loadInspectorIndex() {
  if (!indexPromise) {
    indexPromise = import("./devSourceRawIndex.js").then((mod) => {
      const files = new Map();
      const styles = new Map();
      for (const [key, text] of Object.entries(mod.DEV_SOURCE_RAW || {})) {
        files.set(mod.globKeyToFrontendPath(key), String(text || ""));
      }
      for (const [key, text] of Object.entries(mod.DEV_STYLE_RAW || {})) {
        styles.set(mod.globKeyToFrontendPath(key), String(text || ""));
      }
      return { files, styles };
    });
  }
  return indexPromise;
}

function linesOf(file, text) {
  if (!linesCache.has(file)) linesCache.set(file, String(text || "").split(/\r?\n/));
  return linesCache.get(file);
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function shortPath(file) {
  const parts = String(file || "").split("/");
  return parts.slice(-2).join("/");
}

export function parseLoc(value) {
  const match = String(value || "").match(/^(.*?):(\d+)(?::(\d+))?$/);
  if (!match) return null;
  return {
    file: match[1],
    line: Number.parseInt(match[2], 10),
    col: match[3] ? Number.parseInt(match[3], 10) : 1,
  };
}

/** `className:primaryButtonFull,theme;onClick:go` → [{ attr, names }] */
export function parseFx(value) {
  return String(value || "")
    .split(";")
    .map((part) => {
      const idx = part.indexOf(":");
      if (idx <= 0) return null;
      const names = part
        .slice(idx + 1)
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean);
      return names.length ? { attr: part.slice(0, idx), names } : null;
    })
    .filter(Boolean);
}

function findLine(lines, re) {
  for (let i = 0; i < lines.length; i += 1) {
    if (re.test(lines[i])) return i + 1;
  }
  return 0;
}

function resolveModulePath(index, fromFile, spec) {
  if (!spec.startsWith(".")) return null;
  const parts = fromFile.split("/").slice(0, -1);
  for (const seg of spec.split("/")) {
    if (seg === "." || !seg) continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  const base = parts.join("/");
  const candidates = [base, `${base}.js`, `${base}.jsx`, `${base}/index.js`, `${base}/index.jsx`];
  return candidates.find((candidate) => index.files.has(candidate)) || null;
}

function findImport(text, name) {
  const re = /import\s+([\s\S]*?)\s+from\s+["']([^"']+)["']/g;
  let match;
  while ((match = re.exec(text))) {
    const clause = match[1];
    if (!new RegExp(`\\b${escapeRegExp(name)}\\b`).test(clause)) continue;
    const alias = clause.match(new RegExp(`(\\w+)\\s+as\\s+${escapeRegExp(name)}\\b`));
    const isDefault = new RegExp(`^\\s*${escapeRegExp(name)}\\b`).test(clause);
    return {
      spec: match[2],
      importedName: alias ? alias[1] : name,
      isDefault,
    };
  }
  return null;
}

/**
 * Where an identifier used by an element is declared.
 * Returns { file, line, kind, setter?, state?, from? } or null.
 */
export function findDeclaration(index, file, name, depth = 0) {
  const text = index.files.get(file);
  if (!text || !name) return null;
  const lines = linesOf(file, text);
  const n = escapeRegExp(name);

  const stateLine = findLine(lines, new RegExp(`\\[\\s*${n}\\s*,\\s*(\\w+)\\s*\\]\\s*=\\s*use(State|Reducer)`));
  if (stateLine) {
    const setter = lines[stateLine - 1].match(new RegExp(`\\[\\s*${n}\\s*,\\s*(\\w+)`))?.[1];
    return { file, line: stateLine, kind: "state", setter };
  }
  const setterLine = findLine(lines, new RegExp(`\\[\\s*(\\w+)\\s*,\\s*${n}\\s*\\]\\s*=\\s*useState`));
  if (setterLine) return { file, line: setterLine, kind: "setter", setter: name };

  const checks = [
    [new RegExp(`\\bfunction\\s+${n}\\s*\\(`), "function"],
    [new RegExp(`\\b(?:const|let|var)\\s+${n}\\s*=\\s*useCallback\\(`), "callback"],
    [new RegExp(`\\b(?:const|let|var)\\s+${n}\\s*=\\s*useMemo\\(`), "memo"],
    [new RegExp(`\\b(?:const|let|var)\\s+${n}\\s*=\\s*useRef\\(`), "ref"],
    [new RegExp(`\\b(?:const|let|var)\\s+${n}\\s*=\\s*(?:async\\s*)?(?:\\([^)]*\\)|\\w+)\\s*=>`), "function"],
    [new RegExp(`\\b(?:const|let|var)\\s+${n}\\s*=`), "const"],
    [new RegExp(`\\b(?:const|let)\\s*\\{[^}]*\\b${n}\\b[^}]*\\}\\s*=`), "destructured"],
  ];
  for (const [re, kind] of checks) {
    const line = findLine(lines, re);
    if (line) return { file, line, kind };
  }

  const imp = findImport(text, name);
  if (imp) {
    const target = resolveModulePath(index, file, imp.spec);
    if (!target) return { file, line: findLine(lines, new RegExp(`from\\s+["']${escapeRegExp(imp.spec)}["']`)), kind: "import", from: imp.spec };
    if (depth < 2) {
      if (imp.isDefault) {
        const targetLines = linesOf(target, index.files.get(target));
        const line = findLine(targetLines, /export\s+default\b/);
        if (line) return { file: target, line, kind: "import", from: imp.spec };
      }
      const nested = findDeclaration(index, target, imp.importedName, depth + 1);
      if (nested) return { ...nested, from: imp.spec };
    }
    return { file: target, line: 1, kind: "import", from: imp.spec };
  }

  const propLine = findLine(lines, new RegExp(`function\\s+\\w+\\s*\\(\\s*\\{[^)]*\\b${n}\\b`));
  if (propLine) return { file, line: propLine, kind: "prop" };
  return null;
}

function enclosingFunctionName(lines, lineIndex) {
  const fnRe =
    /(?:function\s+(\w+)|(?:const|let)\s+(\w+)\s*=\s*(?:useCallback\(\s*)?(?:async\s*)?(?:\([^)]*\)|\w+)?\s*=>|\b(use(?:Layout)?Effect)\()/;
  for (let i = lineIndex; i >= Math.max(0, lineIndex - 120); i -= 1) {
    const match = lines[i].match(fnRe);
    if (match) return match[1] || match[2] || match[3] || "";
  }
  return "";
}

/** Lines that call a state setter, with the function that does it. */
export function findSetterCalls(index, file, setter, limit = 6) {
  const text = index.files.get(file);
  if (!text || !setter) return [];
  const lines = linesOf(file, text);
  const re = new RegExp(`\\b${escapeRegExp(setter)}\\(`);
  const out = [];
  for (let i = 0; i < lines.length && out.length < limit; i += 1) {
    if (!re.test(lines[i])) continue;
    out.push({ file, line: i + 1, fn: enclosingFunctionName(lines, i) });
  }
  return out;
}

export function findComponentDefinition(index, name) {
  if (!name) return null;
  const n = escapeRegExp(name);
  const defRe = new RegExp(`\\b(?:function\\s+${n}\\s*\\(|(?:const|let)\\s+${n}\\s*=)`);
  for (const [file, text] of index.files) {
    const base = file.split("/").pop().replace(/\.(jsx?|tsx?)$/, "");
    if (base !== name) continue;
    const line = findLine(linesOf(file, text), defRe) || 1;
    return { file, line };
  }
  for (const [file, text] of index.files) {
    if (!text.includes(name)) continue;
    const line = findLine(linesOf(file, text), defRe);
    if (line) return { file, line };
  }
  return null;
}

/** CSS selector lines that mention `.className`. */
export function findCssRules(index, className, limit = 6) {
  if (!className || /[:[\]/!]/.test(className)) return [];
  const re = new RegExp(`\\.${escapeRegExp(className)}(?![\\w-])`);
  const out = [];
  for (const [file, text] of index.styles) {
    if (!text.includes(className)) continue;
    const lines = linesOf(file, text);
    for (let i = 0; i < lines.length && out.length < limit; i += 1) {
      if (re.test(lines[i])) out.push({ file, line: i + 1, text: lines[i].trim() });
    }
  }
  return out;
}

const TAILWIND_BUILTIN_KEYFRAMES = new Set(["spin", "ping", "pulse", "bounce"]);

export function findKeyframes(index, name, limit = 4) {
  if (!name || name === "none") return { builtin: false, hits: [] };
  const n = escapeRegExp(name);
  const cssRe = new RegExp(`@keyframes\\s+${n}(?![\\w-])`);
  const configRe = new RegExp(`["']${n}["']\\s*:`);
  const hits = [];
  for (const [file, text] of index.styles) {
    if (!text.includes(name)) continue;
    const lines = linesOf(file, text);
    const re = file.endsWith(".css") ? cssRe : configRe;
    for (let i = 0; i < lines.length && hits.length < limit; i += 1) {
      if (re.test(lines[i])) hits.push({ file, line: i + 1, text: lines[i].trim() });
    }
  }
  return { builtin: TAILWIND_BUILTIN_KEYFRAMES.has(name), hits };
}

const COLOR_PREFIX = /^-?(bg|from|via|to|text|border|ring|shadow|fill|stroke|outline|accent|caret|decoration|divide|placeholder)-/;
const NON_COLOR = [
  /^text-(xs|sm|base|lg|\d?xl|left|center|right|justify|start|end|wrap|nowrap|balance|pretty|ellipsis|clip)$/,
  /^text-\[\d/,
  /^border-(0|2|4|8|t|b|l|r|x|y|s|e|solid|dashed|dotted|double|none|collapse|separate)$/,
  /^border-[tblrxyse]-(0|2|4|8)$/,
  /^bg-(cover|contain|center|top|bottom|left|right|no-repeat|repeat|fixed|local|scroll|clip-\w+|origin-\w+|auto)$/,
  /^ring-(0|1|2|4|8|inset)$/,
  /^ring-offset-\d$/,
  /^shadow(-(sm|md|lg|xl|2xl|inner|none))?$/,
  /^outline-(none|0|1|2|4|8|dashed|dotted|double|offset-\d)$/,
  /^stroke-[0-2]$/,
  /^decoration-(solid|double|dotted|dashed|wavy|auto|from-font|0|1|2|4|8)$/,
  /^divide-[xy](-\d)?$/,
];
const MOTION_PREFIX = /^-?(animate-|transition|duration-|ease-|delay-|will-change-|motion-)/;
const INTERACTION_PREFIX = /^-?(translate-|scale-|rotate-|skew-)/;

function baseUtility(cls) {
  const parts = cls.split(":");
  return parts[parts.length - 1].replace(/^!/, "");
}

export function classifyClasses(classList) {
  const colors = [];
  const motion = [];
  for (const cls of classList) {
    const base = baseUtility(cls);
    if (MOTION_PREFIX.test(base) || (cls.includes(":") && INTERACTION_PREFIX.test(base))) {
      motion.push(cls);
      continue;
    }
    if (COLOR_PREFIX.test(base) && !NON_COLOR.some((re) => re.test(base))) {
      colors.push(cls);
    }
  }
  return { colors, motion };
}

export function lucideNameFromSvg(el) {
  if (!el || el.tagName?.toLowerCase() !== "svg") return "";
  const cls = [...(el.classList || [])].find((c) => c.startsWith("lucide-"));
  if (!cls) return "";
  return cls
    .slice("lucide-".length)
    .split("-")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
    .join("");
}

const DECL_LINE =
  /^\s*(export\s+)?(default\s+)?(async\s+)?(function\s+\w|const\s+\w+\s*=|let\s+\w+\s*=|class\s+\w)|@keyframes\s|^\s*[.#@][^{;]*\{\s*$/;

/** Free-text search across components, pages, utils and stylesheets. */
export function searchSource(index, query, limit = 60) {
  const q = String(query || "").trim();
  if (q.length < 2) return [];
  const needle = q.toLowerCase();
  const results = [];
  const scan = (file, text) => {
    const fileHit = file.toLowerCase().includes(needle);
    if (!fileHit && !text.toLowerCase().includes(needle)) return;
    if (fileHit) results.push({ file, line: 1, text: "(file name match)", score: 90 });
    const lines = linesOf(file, text);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const lower = line.toLowerCase();
      if (!lower.includes(needle)) continue;
      let score = 10;
      if (DECL_LINE.test(line)) score += 50;
      if (line.includes(q)) score += 8;
      if (new RegExp(`\\b${escapeRegExp(needle)}\\b`, "i").test(line)) score += 6;
      if (file.includes("/components/")) score += 2;
      results.push({ file, line: i + 1, text: line.trim().slice(0, 140), score });
    }
  };
  for (const [file, text] of index.files) scan(file, text);
  for (const [file, text] of index.styles) scan(file, text);
  results.sort((a, b) => b.score - a.score || a.file.localeCompare(b.file) || a.line - b.line);
  return results.slice(0, limit);
}

export async function openInEditor(loc) {
  if (!loc?.file) return false;
  const params = new URLSearchParams({
    file: loc.file,
    line: String(loc.line || 1),
    col: String(loc.col || 1),
  });
  try {
    const res = await fetch(`/__en-open?${params}`);
    return res.ok;
  } catch {
    return false;
  }
}
