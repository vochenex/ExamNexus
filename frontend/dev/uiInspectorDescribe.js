import {
  findComponentDefinition,
  findDeclaration,
  findKeyframes,
  findSetterCalls,
  lucideNameFromSvg,
  parseFx,
  parseLoc,
} from "./uiInspectorLookup";
import { appliedCssRules, attributeProperty, createStyleContext } from "./uiInspectorStyles";

const INSPECTOR_SELECTOR = "[data-en-inspector]";

export function isInspectorNode(node) {
  return Boolean(node && node.nodeType === 1 && node.closest(INSPECTOR_SELECTOR));
}

function reactFiberOf(el) {
  if (!el) return null;
  for (const key of Object.keys(el)) {
    if (key.startsWith("__reactFiber$")) return el[key];
  }
  return null;
}

function fiberName(fiber) {
  const type = fiber?.type;
  if (typeof type === "function") return type.displayName || type.name || "";
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

export function elementLabel(el) {
  if (!el?.tagName) return "";
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const classes = [...(el.classList || [])]
    .filter((cls) => !/[:[\]/]/.test(cls))
    .slice(0, 2)
    .map((cls) => `.${cls}`)
    .join("");
  return `${tag}${id}${classes}`;
}

export function elementSource(el) {
  const tagged = el?.closest?.("[data-en-src]");
  if (!tagged) return null;
  const loc = parseLoc(tagged.getAttribute("data-en-src"));
  return loc ? { ...loc, self: tagged === el } : null;
}

function resolveNames(index, file, fx) {
  return parseFx(fx)
    .map(({ attr, names }) => {
      const items = names
        .map((name) => {
          const decl = findDeclaration(index, file, name);
          if (!decl) return null;
          let setterCalls = [];
          if (decl.kind === "state" && decl.setter) {
            setterCalls = findSetterCalls(index, decl.file, decl.setter);
          } else if (decl.kind === "setter") {
            setterCalls = findSetterCalls(index, decl.file, name);
          }
          return { name, decl, setterCalls };
        })
        .filter(Boolean);
      return items.length ? { attr, items } : null;
    })
    .filter(Boolean);
}

function componentChain(index, el, limit = 8) {
  const out = [];
  let fiber = reactFiberOf(el)?.return || null;
  let hops = 0;
  let lastName = "";
  while (fiber && hops < 250 && out.length < limit) {
    const type = fiber.type;
    const isComponent =
      typeof type === "function" || (type && typeof type === "object" && (type.render || type.type));
    if (isComponent) {
      const name = fiberName(fiber);
      const props = fiber.memoizedProps || {};
      const useLoc = parseLoc(props["data-en-use"]);
      if (name && name !== lastName) {
        const def = findComponentDefinition(index, name);
        if (def || useLoc) {
          out.push({
            name,
            def,
            use: useLoc,
            logic: useLoc ? resolveNames(index, useLoc.file, props["data-en-usefx"]) : [],
          });
        }
        lastName = name;
      }
    }
    fiber = fiber.return;
    hops += 1;
  }
  return out;
}

/** Everything under the click point, including pointer-events:none overlays. */
export function layersAtPoint(el, point, limit = 10) {
  if (!el || !point) return [];
  let root = el;
  for (let i = 0; i < 3 && root.parentElement && root.parentElement !== document.body; i += 1) {
    root = root.parentElement;
  }
  const nodes = [root, ...root.querySelectorAll("*")].slice(0, 800);
  const hits = [];
  for (const node of nodes) {
    if (isInspectorNode(node)) continue;
    const rect = node.getBoundingClientRect();
    const area = rect.width * rect.height;
    if (!area) continue;
    if (
      point.x < rect.left ||
      point.x > rect.right ||
      point.y < rect.top ||
      point.y > rect.bottom
    ) {
      continue;
    }
    hits.push({ el: node, area });
  }
  hits.sort((a, b) => a.area - b.area);
  return hits.slice(0, limit).map(({ el: node }) => ({
    el: node,
    label: elementLabel(node),
    src: elementSource(node),
  }));
}

function pseudoInfo(el) {
  const out = [];
  for (const which of ["::before", "::after"]) {
    const cs = window.getComputedStyle(el, which);
    if (!cs.content || cs.content === "none" || cs.content === "normal") continue;
    out.push({
      which,
      content: cs.content.slice(0, 40),
      background: cs.backgroundColor,
      backgroundImage: cs.backgroundImage !== "none" ? cs.backgroundImage : "",
      animation: cs.animationName !== "none" ? cs.animationName : "",
      transition: cs.transitionDuration !== "0s" ? `${cs.transitionProperty} ${cs.transitionDuration}` : "",
    });
  }
  return out;
}

function isVisibleColor(value) {
  return value && value !== "rgba(0, 0, 0, 0)" && value !== "transparent";
}

function uniqueSources(list) {
  const seen = new Set();
  return list.filter((source) => {
    const key = source.loc ? `${source.loc.file}:${source.loc.line}` : source.detail;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Files most likely to hold this element's class strings, nearest first. */
function makeCandidateFiles(index) {
  const cache = new Map();
  return (el) => {
    if (cache.has(el)) return cache.get(el);
    const files = [];
    const src = elementSource(el);
    if (src) {
      files.push(src.file);
      for (const group of resolveNames(index, src.file, el.getAttribute("data-en-fx"))) {
        for (const item of group.items) files.push(item.decl.file);
      }
    }
    for (const comp of componentChain(index, el, 4)) {
      if (comp.use) files.push(comp.use.file);
      for (const group of comp.logic) {
        for (const item of group.items) files.push(item.decl.file);
      }
      if (comp.def) files.push(comp.def.file);
    }
    const unique = [...new Set(files)];
    cache.set(el, unique);
    return unique;
  };
}

function visibleText(el) {
  const own = [...el.childNodes]
    .filter((node) => node.nodeType === 3)
    .map((node) => node.textContent)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (own) return own;
  const all = (el.textContent || "").replace(/\s+/g, " ").trim();
  return all.length <= 80 ? all : "";
}

function locateText(index, text, files) {
  const needles = [text.slice(0, 60)];
  const words = text.split(" ").slice(0, 3).join(" ");
  if (words.length >= 4 && words !== needles[0]) needles.push(words);
  for (const needle of needles) {
    for (const file of files) {
      const lines = String(index.files.get(file) || "").split(/\r?\n/);
      const idx = lines.findIndex((line) => line.includes(needle));
      if (idx >= 0) return { file, line: idx + 1 };
    }
  }
  return null;
}

function textInfo(index, el, candidateFiles) {
  const text = visibleText(el);
  if (!text) return null;
  const loc = locateText(index, text, candidateFiles(el));
  if (loc) return { text, sources: [{ kind: "text", loc, detail: "text literal" }] };
  const src = elementSource(el);
  return {
    text,
    sources: src ? [{ kind: "text", loc: src, detail: "dynamic text — rendered by this JSX" }] : [],
  };
}

/** Where an image URL lives on disk (public/ or an imported asset), or that it is remote. */
function assetFromUrl(url) {
  if (!url) return null;
  if (url.startsWith("data:")) return { label: "inline data URL" };
  let parsed;
  try {
    parsed = new URL(url, window.location.href);
  } catch {
    return { label: url };
  }
  if (parsed.origin !== window.location.origin) {
    const isSupabase = parsed.hostname.includes("supabase");
    return {
      label: isSupabase ? "Supabase Storage (uploaded at runtime)" : `remote: ${parsed.hostname}`,
      remote: true,
    };
  }
  const pathname = decodeURIComponent(parsed.pathname);
  const frontendIdx = pathname.toLowerCase().indexOf("/frontend/");
  if (pathname.startsWith("/@fs/") && frontendIdx >= 0) {
    const file = pathname.slice(frontendIdx + 1);
    return { file, label: file };
  }
  if (/^\/(frontend|src|node_modules)\//.test(pathname)) {
    const file = pathname.slice(1);
    return { file, label: file };
  }
  const file = `public${pathname}`;
  return { file, label: file };
}

function findLineAfter(index, loc, re, span = 20) {
  if (!loc) return null;
  const lines = String(index.files.get(loc.file) || "").split(/\r?\n/);
  for (let i = loc.line - 1; i < Math.min(lines.length, loc.line - 1 + span); i += 1) {
    if (re.test(lines[i])) return { file: loc.file, line: i + 1 };
  }
  return null;
}

/** Line that contains a literal like "/team/dirk-lepon.png", preferring nearby files. */
function findLiteral(index, literal, preferFiles) {
  if (!literal || literal.startsWith("data:") || /^https?:/.test(literal)) return null;
  const needles = [`"${literal}"`, `'${literal}'`, `\`${literal}\``];
  const files = [...new Set([...preferFiles, ...index.files.keys()])];
  for (const file of files) {
    const text = index.files.get(file);
    if (!text || !text.includes(literal)) continue;
    const lines = text.split(/\r?\n/);
    const idx = lines.findIndex((line) => needles.some((needle) => line.includes(needle)));
    if (idx >= 0) return { file, line: idx + 1 };
  }
  return null;
}

function outermostSvg(node) {
  let svg = node?.closest?.("svg") || null;
  while (svg?.parentElement?.closest("svg")) svg = svg.parentElement.closest("svg");
  return svg;
}

function isLucide(svg) {
  return Boolean(svg?.classList?.contains("lucide") || svg?.getAttribute("data-en-icon"));
}

function componentFor(index, node) {
  const [comp] = componentChain(index, node, 1);
  return comp ? { name: comp.name, def: comp.def, use: comp.use } : null;
}

function renderedSize(node) {
  const rect = node.getBoundingClientRect();
  return `${Math.round(rect.width)}×${Math.round(rect.height)}`;
}

/** Images inside or under the selection: <img>, inline <svg> art, and CSS url() backgrounds. */
function imagesFor(index, ctx, el) {
  const out = [];
  const seen = new Set();
  const add = (node, entry) => {
    if (seen.has(node) || out.length >= 6) return;
    seen.add(node);
    out.push(entry);
  };

  const imgNodes = [];
  const svgNodes = [];
  const rootSvg = outermostSvg(el);
  if (rootSvg && !isLucide(rootSvg)) svgNodes.push(rootSvg);
  if (el.tagName?.toLowerCase() === "img") imgNodes.push(el);
  for (const node of el.querySelectorAll?.("img") || []) imgNodes.push(node);
  for (const node of el.querySelectorAll?.("svg") || []) {
    if (!isLucide(node) && !node.parentElement?.closest("svg")) svgNodes.push(node);
  }

  for (const node of imgNodes) {
    const src = elementSource(node);
    const literal = node.getAttribute("src") || "";
    const url = node.currentSrc || node.src || literal;
    const component = componentFor(index, node);
    const preferFiles = [src?.file, component?.use?.file].filter(Boolean);
    add(node, {
      kind: "img",
      label: node.alt ? `<img> “${node.alt}”` : "<img>",
      preview: url,
      size: `${node.naturalWidth || "?"}×${node.naturalHeight || "?"} file · ${renderedSize(node)} shown`,
      asset: assetFromUrl(url),
      srcLine: findLineAfter(index, src, /\bsrc=/) || src,
      valueLoc: findLiteral(index, literal, preferFiles),
      component,
    });
  }

  for (const node of svgNodes) {
    add(node, {
      kind: "svg",
      label: "inline <svg> (drawn in code)",
      size: `${renderedSize(node)} shown`,
      srcLine: elementSource(node),
      component: componentFor(index, node),
    });
  }

  const bgNodes = [el, ...(el.querySelectorAll?.("*") || [])].slice(0, 300);
  for (const node of bgNodes) {
    if (out.length >= 6) break;
    const bg = window.getComputedStyle(node).backgroundImage;
    const match = bg && bg !== "none" ? bg.match(/url\(["']?([^"')]+)["']?\)/) : null;
    if (!match) continue;
    add(node, {
      kind: "background",
      label: `CSS background on ${elementLabel(node)}`,
      preview: match[1],
      size: `${renderedSize(node)} shown`,
      asset: assetFromUrl(match[1]),
      sources: attributeProperty(ctx, node, "background-image"),
    });
  }

  return out;
}

export function describeElement(index, el, point) {
  const src = elementSource(el);
  const cs = window.getComputedStyle(el);
  const candidateFiles = makeCandidateFiles(index);
  const ctx = createStyleContext(index, candidateFiles, elementSource, elementLabel);
  const attr = (prop, target = el) => attributeProperty(ctx, target, prop);

  const svg = el.tagName?.toLowerCase() === "svg" ? el : el.closest?.("svg");
  const iconName = svg?.getAttribute("data-en-icon") || lucideNameFromSvg(svg);
  const icon = iconName
    ? {
        name: iconName,
        src: svg ? elementSource(svg) : null,
        classes: svg ? [...svg.classList].filter((cls) => !cls.startsWith("lucide")) : [],
      }
    : null;

  const colors = [{ label: "text color", value: cs.color, sources: attr("color") }];
  if (isVisibleColor(cs.backgroundColor)) {
    colors.push({ label: "background", value: cs.backgroundColor, sources: attr("background-color") });
  }
  if (cs.backgroundImage !== "none") {
    colors.push({ label: "gradient", value: cs.backgroundImage, sources: attr("background-image") });
  }
  if (cs.borderTopWidth !== "0px" && isVisibleColor(cs.borderTopColor)) {
    colors.push({ label: "border", value: cs.borderTopColor, sources: attr("border-top-color") });
  }
  if (cs.boxShadow !== "none") {
    colors.push({ label: "shadow", value: cs.boxShadow, swatch: false, sources: attr("box-shadow") });
  }
  if (svg && svg !== el) {
    const svgColor = window.getComputedStyle(svg).color;
    colors.push({ label: "icon color", value: svgColor, sources: attr("color", svg) });
  }
  if (Number.parseFloat(cs.opacity) < 1) {
    colors.push({ label: "opacity", value: cs.opacity, swatch: false, sources: attr("opacity") });
  }

  const animationNames = cs.animationName
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name && name !== "none");
  const motion = [];
  if (animationNames.length) {
    motion.push({
      label: "animation",
      value: `${cs.animationName} · ${cs.animationDuration} · ${cs.animationTimingFunction}`,
      sources: uniqueSources([...attr("animation-name"), ...attr("animation-duration")]),
      keyframes: animationNames.map((name) => ({ name, ...findKeyframes(index, name) })),
    });
  }
  if (cs.transitionDuration && cs.transitionDuration.split(",").some((d) => d.trim() !== "0s")) {
    motion.push({
      label: "transition",
      value: `${cs.transitionProperty} · ${cs.transitionDuration} · ${cs.transitionTimingFunction}`,
      sources: uniqueSources([
        ...attr("transition-property"),
        ...attr("transition-duration"),
        ...attr("transition-timing-function"),
      ]),
    });
  }
  if (cs.transform !== "none") {
    motion.push({ label: "transform", value: cs.transform, sources: attr("transform") });
  }

  return {
    label: elementLabel(el),
    src,
    text: textInfo(index, el, candidateFiles),
    logic: src && el.getAttribute("data-en-fx") ? resolveNames(index, src.file, el.getAttribute("data-en-fx")) : [],
    images: imagesFor(index, ctx, el),
    icon,
    colors,
    motion,
    cssRules: appliedCssRules(ctx, el),
    pseudo: pseudoInfo(el),
    inlineStyle: el.getAttribute("style") || "",
    layers: layersAtPoint(el, point),
    hasParent: Boolean(el.parentElement && el.parentElement !== document.documentElement),
  };
}
