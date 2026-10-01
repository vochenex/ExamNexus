/**
 * Per-property source attribution for the Ctrl+E UI inspector (DEV only).
 *
 * Reads the live CSSOM (Vite injects each stylesheet as a <style> tagged with
 * `data-vite-dev-id`), finds the rule that wins for a property, then maps it to:
 * - a CSS file line (custom rules in frontend/**.css), or
 * - the JSX / helper line that contains the Tailwind class (utilities), or
 * - the JSX `style={...}` line (inline styles).
 */

const INHERITED = new Set(["color"]);

const DECL_NAMES = {
  color: ["color"],
  "background-color": ["background-color", "background"],
  "background-image": ["background-image", "background"],
  "border-top-color": ["border-top-color", "border-color", "border-top", "border"],
  "box-shadow": ["box-shadow"],
  "animation-name": ["animation-name", "animation"],
  "animation-duration": ["animation-duration", "animation"],
  "transition-property": ["transition-property", "transition"],
  "transition-duration": ["transition-duration", "transition"],
  "transition-timing-function": ["transition-timing-function", "transition"],
  transform: ["transform", "translate", "scale", "rotate"],
  opacity: ["opacity"],
};

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toRepoPath(devId) {
  const normalized = String(devId || "").replace(/\\/g, "/").split("?")[0];
  const idx = normalized.toLowerCase().lastIndexOf("/frontend/");
  return idx >= 0 ? normalized.slice(idx + 1) : "";
}

function conditionMatches(rule) {
  try {
    if (typeof CSSMediaRule !== "undefined" && rule instanceof CSSMediaRule) {
      return window.matchMedia(rule.media.mediaText).matches;
    }
    if (typeof CSSSupportsRule !== "undefined" && rule instanceof CSSSupportsRule) {
      return CSS.supports(rule.conditionText);
    }
  } catch {
    return true;
  }
  return true;
}

function flattenRules(list, file, out) {
  for (const rule of list) {
    if (rule.selectorText !== undefined && rule.style) {
      out.push({ rule, file, order: out.length });
    } else if (rule.cssRules && conditionMatches(rule)) {
      flattenRules(rule.cssRules, file, out);
    }
  }
}

export function collectStyleRules() {
  const out = [];
  for (const sheet of document.styleSheets) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    const owner = sheet.ownerNode;
    if (owner?.closest?.("[data-en-inspector]")) continue;
    const file = toRepoPath(owner?.getAttribute?.("data-vite-dev-id") || sheet.href || "");
    flattenRules(rules, file, out);
  }
  return out;
}

/** Split a selector list on top-level commas only. */
function splitSelectorList(text) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const ch of String(text || "")) {
    if (ch === "(" || ch === "[") depth += 1;
    if (ch === ")" || ch === "]") depth -= 1;
    if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function specificity(selector) {
  const s = selector
    .replace(/\\./g, "x")
    .replace(/:where\((?:[^()]|\([^()]*\))*\)/g, "")
    .replace(/::[\w-]+/g, "")
    .replace(/:(?:is|not|has)\(/g, " (");
  const ids = (s.match(/#[\w-]+/g) || []).length;
  const classes = (s.match(/\.[\w-]+|\[[^\]]*\]|:[\w-]+/g) || []).length;
  const tags = (s.match(/(?:^|[\s>+~(])([a-zA-Z][\w-]*)/g) || []).length;
  return [ids, classes, tags];
}

function compareSpec(a, b) {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

export function createStyleContext(index, candidateFilesFor, sourceFor, labelFor) {
  const rules = collectStyleRules();
  const matchCache = new Map();

  const matchesFor = (el) => {
    if (matchCache.has(el)) return matchCache.get(el);
    const out = [];
    for (const entry of rules) {
      const selectorText = entry.rule.selectorText;
      try {
        if (!el.matches(selectorText)) continue;
      } catch {
        continue;
      }
      let best = null;
      for (const part of splitSelectorList(selectorText)) {
        try {
          if (!el.matches(part)) continue;
        } catch {
          continue;
        }
        const spec = specificity(part);
        if (!best || compareSpec(spec, best.spec) > 0) best = { part, spec };
      }
      if (best) out.push({ ...entry, selector: best.part, spec: best.spec });
    }
    matchCache.set(el, out);
    return out;
  };

  return { index, rules, matchesFor, candidateFilesFor, sourceFor, labelFor };
}

function winningDeclaration(ctx, el, prop) {
  let best = null;
  for (const match of ctx.matchesFor(el)) {
    const value = match.rule.style.getPropertyValue(prop);
    if (!value) continue;
    if (match.selector.trim() === "*" || /^\*,?\s*::/.test(match.selector)) continue;
    const important = match.rule.style.getPropertyPriority(prop) === "important";
    const candidate = { ...match, value: value.trim(), important };
    if (
      !best ||
      (important && !best.important) ||
      (important === best.important &&
        (compareSpec(candidate.spec, best.spec) > 0 ||
          (compareSpec(candidate.spec, best.spec) === 0 && candidate.order > best.order)))
    ) {
      best = candidate;
    }
  }
  const inlineValue = el.style?.getPropertyValue(prop);
  if (inlineValue && !(best && best.important && el.style.getPropertyPriority(prop) !== "important")) {
    return { inline: true, value: inlineValue.trim() };
  }
  return best;
}

function normalizeSelector(value) {
  return String(value || "")
    .replace(/["']/g, "")
    .replace(/\s*([>+~])\s*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function linesFor(ctx, file) {
  const key = `style:${file}`;
  if (!ctx.linesCache) ctx.linesCache = new Map();
  if (!ctx.linesCache.has(key)) {
    const text = ctx.index.styles.get(file) ?? ctx.index.files.get(file) ?? "";
    ctx.linesCache.set(key, text.split(/\r?\n/));
  }
  return ctx.linesCache.get(key);
}

function normalizeValue(value) {
  return String(value || "")
    .replace(/!important/i, "")
    .replace(/\s+/g, " ")
    .replace(/;$/, "")
    .trim()
    .toLowerCase();
}

/** Declaration line for `prop` inside the block that starts at `startIdx`. */
function declarationInBlock(lines, startIdx, prop, cssomValue) {
  const names = DECL_NAMES[prop] || [prop];
  const declRe = new RegExp(`^\\s*(${names.map(escapeRegExp).join("|")})\\s*:\\s*([^;]*)`);
  let depth = 0;
  let opened = false;
  let fallback = 0;
  for (let i = startIdx; i < lines.length && i < startIdx + 200; i += 1) {
    const line = lines[i];
    if (opened) {
      const match = line.match(declRe);
      if (match && depth === 1) {
        if (normalizeValue(match[2]) === normalizeValue(cssomValue)) return { line: i + 1, exact: true };
        if (!fallback) fallback = i + 1;
      }
      if (!fallback && depth === 1 && /^\s*@apply\b/.test(line)) fallback = i + 1;
    }
    for (const ch of line) {
      if (ch === "{") {
        depth += 1;
        opened = true;
      } else if (ch === "}") {
        depth -= 1;
      }
    }
    if (opened && depth <= 0) break;
  }
  return fallback ? { line: fallback, exact: false } : null;
}

function locateRuleInFile(ctx, file, selector, prop, cssomValue) {
  if (!file || !ctx.index.styles.has(file)) return null;
  const lines = linesFor(ctx, file);
  const target = normalizeSelector(selector);
  const candidates = [];
  for (let i = 0; i < lines.length; i += 1) {
    const head = lines[i].split("{")[0];
    if (!head.includes(target.split(/[\s>+~]/).pop().split(":")[0])) continue;
    const parts = head.split(",").map(normalizeSelector);
    if (parts.includes(target)) candidates.push(i);
  }
  let best = null;
  for (const idx of candidates) {
    const decl = declarationInBlock(lines, idx, prop, cssomValue);
    const score = decl ? (decl.exact ? 2 : 1) : 0;
    if (!best || score > best.score) {
      best = { score, loc: { file, line: decl ? decl.line : idx + 1, selectorLine: idx + 1 } };
    }
  }
  return best ? best.loc : null;
}

function unescapeCss(value) {
  return value.replace(/\\([0-9a-fA-F]{1,6}\s?|.)/g, (_, esc) =>
    /^[0-9a-fA-F]/.test(esc) && esc.trim().length > 1
      ? String.fromCodePoint(Number.parseInt(esc.trim(), 16))
      : esc.trim() || esc
  );
}

/** `.hover\:shadow-lg:hover` → `hover:shadow-lg` when it's a single-class utility selector. */
function utilityClassFromSelector(selector) {
  const match = selector.match(/^\.((?:\\.|[\w-])+)((?::[\w-]+(?:\([^)]*\))?)*)$/);
  return match ? unescapeCss(match[1]) : "";
}

function locateClassToken(ctx, el, token) {
  const re = new RegExp(`(^|[\\s"'\`{}])${escapeRegExp(token)}(?=[\\s"'\`{}]|$)`);
  const classes = [...(el.classList || [])];
  const files = ctx.candidateFilesFor(el);
  let best = null;
  const scan = (file, bias) => {
    const text = ctx.index.files.get(file);
    if (!text || !text.includes(token)) return;
    const lines = linesFor(ctx, file);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (!re.test(line)) continue;
      const together = classes.reduce((sum, cls) => sum + (line.includes(cls) ? 1 : 0), 0);
      const score = bias + together * 4;
      if (!best || score > best.score) best = { score, loc: { file, line: i + 1 } };
    }
  };
  files.forEach((file, idx) => scan(file, 200 - idx * 10));
  if (!best) {
    for (const file of ctx.index.files.keys()) scan(file, 0);
  }
  return best?.loc || null;
}

function camelCase(prop) {
  return prop.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
}

function locateInlineStyle(ctx, el, prop) {
  const src = ctx.sourceFor(el);
  if (!src) return null;
  const lines = linesFor(ctx, src.file);
  const start = src.line - 1;
  const styleIdx = lines.slice(start, start + 25).findIndex((line) => /\bstyle=/.test(line));
  if (styleIdx < 0) return { file: src.file, line: src.line };
  const propRe = new RegExp(`\\b${escapeRegExp(camelCase(prop))}\\s*:`);
  const from = start + styleIdx;
  for (let i = from; i < Math.min(lines.length, from + 15); i += 1) {
    if (propRe.test(lines[i])) return { file: src.file, line: i + 1 };
  }
  return { file: src.file, line: from + 1 };
}

function describeMatch(ctx, el, win, prop) {
  if (win.inline) {
    return {
      kind: "inline",
      loc: locateInlineStyle(ctx, el, prop),
      detail: `inline style ${camelCase(prop)}: ${win.value}`,
    };
  }
  const cssLoc = locateRuleInFile(ctx, win.file, win.selector, prop, win.value);
  if (cssLoc) {
    return { kind: "css", loc: cssLoc, detail: `${win.selector} { ${prop} }` };
  }
  const token = utilityClassFromSelector(win.selector);
  if (token) {
    return {
      kind: "class",
      loc: locateClassToken(ctx, el, token),
      detail: `Tailwind class "${token}"`,
    };
  }
  return {
    kind: "css",
    loc: win.file ? { file: win.file, line: 1 } : null,
    detail: `${win.selector} { ${prop} }`,
  };
}

/**
 * Sources for one computed property: the winning rule plus any CSS variables it
 * reads (so Tailwind gradients point at `from-*` / `via-*` / `to-*` too).
 */
export function attributeProperty(ctx, el, prop, state = { chase: 0, seen: new Set() }, depth = 0) {
  if (!el || depth > 12) return [];
  const win = winningDeclaration(ctx, el, prop);
  if (!win) {
    // Tailwind's --tw-* vars live on the same element; project vars may come from :root.
    const inheritable = INHERITED.has(prop) || (prop.startsWith("--") && !prop.startsWith("--tw-"));
    if (inheritable && el.parentElement) {
      return attributeProperty(ctx, el.parentElement, prop, state, depth + 1).map((source) => ({
        ...source,
        inheritedFrom: source.inheritedFrom || ctx.labelFor(el.parentElement),
      }));
    }
    return [];
  }

  const out = [describeMatch(ctx, el, win, prop)];
  if (state.chase < 8) {
    for (const match of win.value.matchAll(/var\((--[\w-]+)/g)) {
      const name = match[1];
      if (state.seen.has(name)) continue;
      state.seen.add(name);
      state.chase += 1;
      out.push(...attributeProperty(ctx, el, name, state, depth));
    }
  }

  const seenLocs = new Set();
  return out.filter((source) => {
    const key = source.loc ? `${source.loc.file}:${source.loc.line}` : source.detail;
    if (seenLocs.has(key)) return false;
    seenLocs.add(key);
    return true;
  });
}

/** Custom (non-utility) CSS rules that match the element, each with its file line. */
export function appliedCssRules(ctx, el, limit = 12) {
  const out = [];
  const seen = new Set();
  for (const match of ctx.matchesFor(el)) {
    if (!match.file || match.selector.trim() === "*" || match.selector.startsWith("*")) continue;
    const style = match.rule.style;
    const props = Array.from({ length: style.length }, (_, i) => style[i])
      .filter((name) => !name.startsWith("--"))
      .slice(0, 5);
    if (!props.length) continue;
    const found = locateRuleInFile(ctx, match.file, match.selector, props[0], style.getPropertyValue(props[0]));
    if (!found) continue;
    const loc = { file: found.file, line: found.selectorLine };
    const key = `${loc.file}:${loc.line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ selector: match.selector, loc, props });
    if (out.length >= limit) break;
  }
  return out;
}
