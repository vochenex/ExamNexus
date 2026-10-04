/**
 * Vite serve plugin for the Ctrl+E UI inspector (DevUiInspector.jsx).
 *
 * - Stamps every host JSX element (and lucide-react icons) under frontend/ with
 *   `data-en-src="frontend/path.jsx:line:col"`.
 * - Adds `data-en-fx` listing the helpers / state / handlers each dynamic prop
 *   uses (e.g. `className:secondaryButton,theme;onClick:handleLogoClick`).
 * - Component usages get `data-en-use` / `data-en-usefx` props instead, which the
 *   inspector reads from React fibers (so `<ProgressButton className={...}>`
 *   still points back to the page that styled it).
 * - Exposes `GET /__en-open?file=&line=&col=` to jump to source in Cursor.
 *
 * Never applied to production / APK builds.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { parseAst } from "vite";

const MAX_NAMES_PER_ATTR = 6;
const MAX_FX_LENGTH = 320;
const SKIP_ATTRS = new Set(["key", "children"]);
// React built-ins that reject or ignore unknown props.
const SKIP_COMPONENTS = new Set(["Fragment", "StrictMode", "Suspense", "Profiler", "Activity"]);

function lineStartsOf(code) {
  const starts = [0];
  for (let i = 0; i < code.length; i += 1) {
    if (code.charCodeAt(i) === 10) starts.push(i + 1);
  }
  return starts;
}

function offsetToLineCol(starts, offset) {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, col: offset - starts[lo] + 1 };
}

function walk(node, visit, parent = null) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit, parent);
    return;
  }
  if (typeof node.type !== "string") return;
  if (visit(node, parent) === false) return;
  for (const key of Object.keys(node)) {
    if (key === "parent" || key === "start" || key === "end" || key === "type") continue;
    const value = node[key];
    if (value && typeof value === "object") walk(value, visit, node);
  }
}

/** Callee + referenced identifiers inside a JSX prop expression. */
function collectExpressionNames(expression) {
  const calls = [];
  const refs = [];
  walk(expression, (node, parent) => {
    if (node.type === "JSXElement" || node.type === "JSXFragment") return false;
    if (node.type === "CallExpression" && node.callee?.type === "Identifier") {
      calls.push(node.callee.name);
    }
    if (node.type !== "Identifier") return undefined;
    if (parent?.type === "MemberExpression" && parent.property === node && !parent.computed) {
      return undefined;
    }
    if (parent?.type === "Property" && parent.key === node && !parent.computed && !parent.shorthand) {
      return undefined;
    }
    if (parent?.type === "CallExpression" && parent.callee === node) return undefined;
    if (
      (parent?.type === "ArrowFunctionExpression" || parent?.type === "FunctionExpression") &&
      parent.params?.includes(node)
    ) {
      return undefined;
    }
    if (node.name === "undefined") return undefined;
    refs.push(node.name);
    return undefined;
  });
  return [...new Set([...calls, ...refs])].slice(0, MAX_NAMES_PER_ATTR);
}

function jsxAttrName(attr) {
  const name = attr?.name;
  if (!name) return "";
  if (name.type === "JSXIdentifier") return name.name;
  if (name.type === "JSXNamespacedName") return `${name.namespace.name}:${name.name.name}`;
  return "";
}

function buildFx(openingElement) {
  const parts = [];
  for (const attr of openingElement.attributes || []) {
    if (attr.type === "JSXSpreadAttribute") {
      const names = collectExpressionNames(attr.argument);
      if (names.length) parts.push(`...:${names.join(",")}`);
      continue;
    }
    const attrName = jsxAttrName(attr);
    if (!attrName || SKIP_ATTRS.has(attrName) || attrName.startsWith("data-en-")) continue;
    if (attr.value?.type !== "JSXExpressionContainer") continue;
    const names = collectExpressionNames(attr.value.expression);
    if (names.length) parts.push(`${attrName}:${names.join(",")}`);
  }
  const fx = parts.join(";");
  return fx.length > MAX_FX_LENGTH ? fx.slice(0, MAX_FX_LENGTH) : fx;
}

function hasAttr(openingElement, attrName) {
  return (openingElement.attributes || []).some((attr) => jsxAttrName(attr) === attrName);
}

function lucideLocalNames(ast) {
  const map = new Map();
  for (const node of ast.body || []) {
    if (node.type !== "ImportDeclaration" || node.source?.value !== "lucide-react") continue;
    for (const spec of node.specifiers || []) {
      if (spec.type === "ImportSpecifier") {
        map.set(spec.local.name, spec.imported?.name || spec.local.name);
      }
    }
  }
  return map;
}

/** Identity line mapping — edits only add text inside existing lines. */
function lineIdentityMap(code, source) {
  const lineCount = lineStartsOf(code).length;
  return {
    version: 3,
    sources: [source],
    sourcesContent: [code],
    names: [],
    mappings: ["AAAA", ...Array(Math.max(0, lineCount - 1)).fill("AACA")].join(";"),
  };
}

export function tagJsxSource(code, relPath) {
  let ast;
  try {
    ast = parseAst(code, { lang: "jsx" });
  } catch {
    return null;
  }

  const lucide = lucideLocalNames(ast);
  const starts = lineStartsOf(code);
  const inserts = [];

  walk(ast, (node) => {
    if (node.type !== "JSXOpeningElement") return undefined;
    const nameNode = node.name;
    if (nameNode?.type !== "JSXIdentifier") return undefined;
    const tag = nameNode.name;
    const isHost = /^[a-z]/.test(tag);
    const icon = lucide.get(tag);
    if (!isHost && !icon && SKIP_COMPONENTS.has(tag)) return undefined;
    if (hasAttr(node, "data-en-src") || hasAttr(node, "data-en-use")) return undefined;

    const { line, col } = offsetToLineCol(starts, node.start);
    const loc = `${relPath}:${line}:${col}`;
    const fx = buildFx(node);
    let attrs;
    if (isHost || icon) {
      attrs = ` data-en-src="${loc}"`;
      if (icon) attrs += ` data-en-icon="${icon}"`;
      if (fx) attrs += ` data-en-fx="${fx}"`;
    } else {
      // Component usage site — read back from fiber props by the inspector.
      attrs = ` data-en-use="${loc}"`;
      if (fx) attrs += ` data-en-usefx="${fx}"`;
    }
    inserts.push({ at: nameNode.end, text: attrs });
    return undefined;
  });

  if (!inserts.length) return null;
  inserts.sort((a, b) => b.at - a.at);
  let out = code;
  for (const { at, text } of inserts) {
    out = out.slice(0, at) + text + out.slice(at);
  }
  return { code: out, map: lineIdentityMap(code, relPath) };
}

function editorCandidates() {
  const list = [];
  if (process.env.EN_EDITOR) list.push(process.env.EN_EDITOR);
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    const local = path.join(
      process.env.LOCALAPPDATA,
      "Programs",
      "cursor",
      "resources",
      "app",
      "bin",
      "cursor.cmd"
    );
    if (fs.existsSync(local)) list.push(local);
  }
  list.push("cursor", "code");
  return list;
}

function runEditor(command, target) {
  return new Promise((resolve) => {
    const quoted = /\s/.test(command) ? `"${command}"` : command;
    let child;
    try {
      // `target` is validated by the middleware (repo-relative, no quotes / shell chars).
      child = spawn(`${quoted} -r -g "${target}"`, {
        shell: true,
        windowsHide: true,
        stdio: "ignore",
      });
    } catch {
      resolve(false);
      return;
    }
    const timer = setTimeout(() => resolve(true), 4000);
    child.on("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve(code === 0);
    });
  });
}

async function openInEditor(absFile, line, col) {
  const target = `${absFile}:${line}:${col}`;
  for (const command of editorCandidates()) {
    if (await runEditor(command, target)) return true;
  }
  return false;
}

export function examNexusUiInspectorPlugin() {
  let root = process.cwd();
  const frontendDir = () => path.join(root, "frontend") + path.sep;

  return {
    name: "examnexus-ui-inspector",
    apply: "serve",
    enforce: "pre",
    configResolved(config) {
      root = config.root || root;
    },
    transform(code, id) {
      if (id.includes("?") || id.includes("\0")) return null;
      if (!id.endsWith(".jsx")) return null;
      const file = path.normalize(id);
      if (!file.startsWith(frontendDir()) || file.includes(`${path.sep}node_modules${path.sep}`)) {
        return null;
      }
      const relPath = path.relative(root, file).split(path.sep).join("/");
      return tagJsxSource(code, relPath);
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const [pathname, query = ""] = String(req.url || "").split("?");
        if (req.method !== "GET" || pathname !== "/__en-open") {
          next();
          return;
        }
        const params = new URLSearchParams(query);
        const file = String(params.get("file") || "");
        const line = Math.max(1, Number.parseInt(params.get("line") || "1", 10) || 1);
        const col = Math.max(1, Number.parseInt(params.get("col") || "1", 10) || 1);
        const abs = path.resolve(root, file);
        const valid =
          /^[A-Za-z0-9_\-./]+$/.test(file) &&
          !file.includes("..") &&
          abs.startsWith(path.resolve(root) + path.sep) &&
          fs.existsSync(abs);
        if (!valid) {
          res.statusCode = 400;
          res.end("Invalid file");
          return;
        }
        const ok = await openInEditor(abs, line, col);
        res.statusCode = ok ? 204 : 500;
        res.end(ok ? undefined : "Could not launch editor (set EN_EDITOR to your editor CLI)");
      });
    },
  };
}
