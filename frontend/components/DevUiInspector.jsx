import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import {
  FEATURE_DISABLED,
  FEATURE_REMOVED,
  activeFeatureKeys,
  activeStyleOverrides,
  PAGE_BACKGROUND_KEY,
  backgroundOverridesFor,
  clearBackground,
  clearPageBackground,
  pageBackgroundFor,
  setPageBackground,
  featureKeyFor,
  featureModeFor,
  findDisabledFeature,
  isPageRemoved,
  resolveFeatureTarget,
  resolveStyleTarget,
  restoreAllOverrides,
  restoreFeature,
  restorePage,
  restoreStyle,
  setBackground,
  routeFor,
  setInspectorPicking,
  toggleFeature,
  togglePage,
  useDevOverrides,
} from "../dev/devOverrides";
import {
  describeElement,
  elementLabel,
  elementSource,
  isInspectorNode,
} from "../dev/uiInspectorDescribe";
import {
  loadInspectorIndex,
  openInEditor,
  searchSource,
  shortPath,
} from "../dev/uiInspectorLookup";

const BLOCKED_EVENTS = ["pointerdown", "pointerup", "mousedown", "mouseup", "dblclick"];
const KIND_LABEL = {
  state: "state",
  setter: "state setter",
  function: "function",
  callback: "useCallback",
  memo: "useMemo",
  ref: "ref",
  const: "value",
  destructured: "value",
  import: "import",
  prop: "prop",
};

const MINIMIZED_KEY = "examnexus_ui_inspector_min";
const DISABLED_MARK = "data-en-dev-disabled";
const REMOVED_STYLE_ID = "en-dev-removed-features";
const BACKGROUND_STYLE_ID = "en-dev-background-overrides";
const PAGE_BG_MARK = "data-en-dev-page-bg";

/**
 * Adds (2,0,0) specificity without needing real ids, so overrides beat the app's own
 * `!important` theme rules (e.g. `html:not(.light) .en-home-shell.min-h-screen…` in index.css).
 */
const BOOST = ":not(#en-dev-boost):not(#en-dev-boost)";

function featureSelector(keys) {
  return keys
    .map((key) => `[data-en-use="${CSS.escape(key)}"]${BOOST}, [data-en-src="${CSS.escape(key)}"]${BOOST}`)
    .join(", ");
}

function syncStyleTag(id, css) {
  let style = document.getElementById(id);
  if (!css) {
    style?.remove();
    return;
  }
  if (!style) {
    style = document.createElement("style");
    style.id = id;
    document.head.appendChild(style);
  }
  style.textContent = css;
}

let colorCanvas = null;

/** Any CSS color (rgb, hex, oklch from Tailwind v4, color-mix…) → { r, g, b, a }. */
function parseRgba(value) {
  const text = String(value || "").trim();
  if (!text || text === "transparent") return null;
  const match = text.match(/^rgba?\(([^)]+)\)$/);
  if (match) {
    const [r, g, b, a = "1"] = match[1].split(/[\s,/]+/).filter(Boolean);
    const alpha = a.endsWith("%") ? parseFloat(a) / 100 : Number(a);
    return { r: Number(r), g: Number(g), b: Number(b), a: alpha };
  }
  if (!colorCanvas) {
    colorCanvas = document.createElement("canvas");
    colorCanvas.width = 1;
    colorCanvas.height = 1;
  }
  const ctx = colorCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = "rgba(0, 0, 0, 0)";
  ctx.fillStyle = text;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  return { r, g, b, a: a / 255 };
}

function toHex({ r, g, b }) {
  return `#${[r, g, b].map((n) => Math.round(n).toString(16).padStart(2, "0")).join("")}`;
}

function effectiveOpacity(el) {
  let opacity = 1;
  for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
    opacity *= Number(getComputedStyle(node).opacity) || 0;
  }
  return opacity;
}

/** Ignore see-through tints (bg-white/5, blurred glows, 3% grid lines) — they are not "the" color. */
function solidBackground(el) {
  const color = parseRgba(getComputedStyle(el).backgroundColor);
  return color && color.a >= 0.5 && effectiveOpacity(el) >= 0.5 ? color : null;
}

/**
 * The background the user actually sees on `el`: its own solid color, otherwise the first
 * solid layer painted underneath it (page shell, fixed backdrop, ancestor…).
 */
function visibleBackground(el) {
  if (!el?.isConnected) return { hex: "#ffffff", painter: null };
  const own = solidBackground(el);
  if (own) return { hex: toHex(own), painter: el };

  const rect = el.getBoundingClientRect();
  const x = (Math.max(rect.left, 0) + Math.min(rect.right, window.innerWidth)) / 2;
  const y = (Math.max(rect.top, 0) + Math.min(rect.bottom, window.innerHeight)) / 2;
  const stack = document.elementsFromPoint(x, y).filter((node) => !isInspectorNode(node));
  const index = stack.indexOf(el);
  const ancestors = [];
  for (let node = el.parentElement; node; node = node.parentElement) ancestors.push(node);
  const candidates = index >= 0 ? [...stack.slice(index + 1), ...ancestors] : ancestors;

  for (const node of candidates) {
    const color = solidBackground(node);
    if (color) return { hex: toHex(color), painter: node };
  }
  return { hex: "#ffffff", painter: null };
}

/** A wrapper paints the page when it is opaque and has a solid color or a gradient of its own. */
function paintsPage(el) {
  const style = getComputedStyle(el);
  if (style.position === "fixed" || effectiveOpacity(el) < 0.5) return false;
  const color = parseRgba(style.backgroundColor);
  return Boolean((color && color.a >= 0.85) || style.backgroundImage.includes("gradient("));
}

/**
 * Full-page background layers on the current screen: wrappers at least ~viewport-sized
 * (page shells, layout <main>, auth backdrop) that paint a background. Cards, headers,
 * sidebars, modals and see-through overlays are skipped.
 */
function findPageBackgroundLayers() {
  const root = document.getElementById("root") || document.body;
  const minWidth = window.innerWidth * 0.7;
  const minHeight = window.innerHeight * 0.7;
  const layers = [];
  const walk = (el, depth) => {
    if (depth > 8) return;
    for (const child of el.children) {
      if (isInspectorNode(child)) continue;
      if (getComputedStyle(child).display === "contents") {
        walk(child, depth + 1);
        continue;
      }
      const rect = child.getBoundingClientRect();
      if (rect.width < minWidth || rect.height < minHeight) continue;
      if (paintsPage(child)) layers.push(child);
      walk(child, depth + 1);
    }
  };
  walk(root, 0);
  return layers;
}

function pageBackgroundHex() {
  for (const layer of findPageBackgroundLayers()) {
    const color = parseRgba(getComputedStyle(layer).backgroundColor);
    if (color && color.a >= 0.5) return toHex(color);
  }
  const body = parseRgba(getComputedStyle(document.body).backgroundColor);
  return body && body.a > 0 ? toHex(body) : "#ffffff";
}

function readMinimized() {
  try {
    return localStorage.getItem(MINIMIZED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeMinimized(value) {
  try {
    localStorage.setItem(MINIMIZED_KEY, value ? "1" : "0");
  } catch {
    // ignore
  }
}

function HeaderButton({ onClick, title, active = false, danger = false, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex h-5 min-w-5 items-center justify-center rounded px-1 text-[10px] leading-none ${
        active
          ? "bg-emerald-500/80 text-black"
          : danger
            ? "text-slate-400 hover:bg-red-500/40 hover:text-white"
            : "text-slate-400 hover:bg-white/15 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function placeBox(box, el) {
  if (!box) return;
  if (!el || !el.isConnected) {
    box.style.display = "none";
    return;
  }
  const rect = el.getBoundingClientRect();
  box.style.display = "block";
  box.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
  box.style.width = `${Math.max(rect.width, 2)}px`;
  box.style.height = `${Math.max(rect.height, 2)}px`;
}

function hoverText(el) {
  const src = elementSource(el);
  const where = src ? `${shortPath(src.file)}:${src.line}` : "no source tag";
  return `${elementLabel(el)}  ·  ${where}`;
}

function Section({ title, children }) {
  return (
    <section className="border-t border-white/5 px-2 py-1.5">
      <h4 className="mb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-emerald-300/60">
        {title}
      </h4>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function Loc({ loc, label, title, onOpen, onCopy }) {
  if (!loc?.file) return null;
  const text = `${shortPath(loc.file)}:${loc.line || 1}`;
  return (
    <span className="inline-flex max-w-full items-center gap-1 align-middle">
      <button
        type="button"
        onClick={() => onOpen(loc)}
        title={`${title ? `${title}\n` : ""}${loc.file}:${loc.line || 1} — open in Cursor`}
        className="truncate rounded bg-emerald-400/10 px-1.5 py-0.5 font-mono text-[11px] text-emerald-200 hover:bg-emerald-400/25"
      >
        {label ? `${label} · ` : ""}
        {text}
      </button>
      <button
        type="button"
        onClick={() => onCopy(`${loc.file}:${loc.line || 1}`)}
        title="Copy path"
        className="shrink-0 rounded px-1 text-[10px] text-slate-400 hover:bg-white/10 hover:text-white"
      >
        copy
      </button>
    </span>
  );
}

const SOURCE_KIND = {
  css: "CSS",
  class: "class",
  inline: "inline",
  text: "text",
};

function Sources({ sources, onOpen, onCopy }) {
  if (!sources?.length) {
    return <span className="text-[10px] italic text-slate-500">no rule found</span>;
  }
  return (
    <span className="flex flex-wrap justify-end gap-1">
      {sources.map((source, idx) =>
        source.loc ? (
          <Loc
            key={`${source.loc.file}:${source.loc.line}:${idx}`}
            loc={source.loc}
            label={`${source.inheritedFrom ? "↑ " : ""}${SOURCE_KIND[source.kind] || source.kind}`}
            title={`${source.detail}${source.inheritedFrom ? `\ninherited from ${source.inheritedFrom}` : ""}`}
            onOpen={onOpen}
            onCopy={onCopy}
          />
        ) : (
          <span key={idx} className="text-[10px] italic text-slate-500" title={source.detail}>
            {source.detail}
          </span>
        )
      )}
    </span>
  );
}

const IMAGE_HINT = {
  img: "Replace the file (keep the same name), or change the path where it is set.",
  remote: "Uploaded by a user at runtime — change it in the app (e.g. Profile), not in code.",
  svg: "Drawn with shapes in JSX. Edit the shapes, or swap the <svg> for <img src=\"/your-image.png\" /> and put the file in public/.",
  background: "Change the url() in the CSS rule, or replace the file.",
};

function ImageRow({ label, children }) {
  return (
    <div className="flex items-start gap-2 text-[11px]">
      <span className="w-16 shrink-0 text-slate-400">{label}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1">{children}</div>
    </div>
  );
}

function ImageCard({ image, onOpen, onCopy }) {
  const hint = image.asset?.remote ? IMAGE_HINT.remote : IMAGE_HINT[image.kind];
  return (
    <div className="space-y-1 rounded-md bg-white/[0.03] p-1.5">
      <div className="flex items-center gap-2">
        {image.preview ? (
          <img
            src={image.preview}
            alt=""
            className="h-10 w-10 shrink-0 rounded border border-white/15 bg-black/40 object-contain"
          />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-white/15 bg-black/40 font-mono text-[9px] text-slate-400">
            SVG
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-[11px] text-amber-200">{image.label}</p>
          <p className="truncate text-[10px] text-slate-500">{image.size}</p>
        </div>
      </div>

      {image.asset ? (
        <ImageRow label="file">
          {image.asset.file ? (
            <Loc loc={{ file: image.asset.file, line: 1 }} title="Open the image file" onOpen={onOpen} onCopy={onCopy} />
          ) : (
            <span className="text-[10px] italic text-slate-400">{image.asset.label}</span>
          )}
        </ImageRow>
      ) : null}
      {image.valueLoc ? (
        <ImageRow label="path set">
          <Loc loc={image.valueLoc} title="Line with the image path" onOpen={onOpen} onCopy={onCopy} />
        </ImageRow>
      ) : null}
      {image.srcLine ? (
        <ImageRow label={image.kind === "svg" ? "drawn at" : "src="}>
          <Loc loc={image.srcLine} onOpen={onOpen} onCopy={onCopy} />
        </ImageRow>
      ) : null}
      {image.sources?.length ? (
        <ImageRow label="CSS url()">
          <Sources sources={image.sources} onOpen={onOpen} onCopy={onCopy} />
        </ImageRow>
      ) : null}
      {image.component ? (
        <ImageRow label="component">
          <span className="font-mono text-[10.5px] text-white">{image.component.name}</span>
          {image.component.use ? (
            <Loc loc={image.component.use} label="used" onOpen={onOpen} onCopy={onCopy} />
          ) : null}
        </ImageRow>
      ) : null}
      {hint ? <p className="text-[10px] leading-snug text-slate-500">{hint}</p> : null}
    </div>
  );
}

/** One property: swatch · label · value, with its source files beside it. */
function PropRow({ row, onOpen, onCopy, children }) {
  return (
    <div className="flex items-start gap-2 text-[11px]">
      {row.swatch === false ? (
        <span className="h-4 w-4 shrink-0" />
      ) : (
        <span
          className="mt-0.5 h-4 w-4 shrink-0 rounded border border-white/20"
          style={{ background: row.value }}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-slate-400">{row.label}</div>
        <div className="truncate font-mono text-[10.5px] text-slate-200" title={row.value}>
          {row.value}
        </div>
        {children}
      </div>
      <div className="max-w-[58%] shrink-0">
        <Sources sources={row.sources} onOpen={onOpen} onCopy={onCopy} />
      </div>
    </div>
  );
}

function Chips({ items, tone = "slate" }) {
  if (!items?.length) return null;
  const color =
    tone === "amber"
      ? "bg-amber-400/10 text-amber-200"
      : tone === "sky"
        ? "bg-sky-400/10 text-sky-200"
        : "bg-white/5 text-slate-200";
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <span key={item} className={`rounded px-1.5 py-0.5 font-mono text-[10.5px] ${color}`}>
          {item}
        </span>
      ))}
    </div>
  );
}

function SmallButton({ onClick, title, tone = "default", children }) {
  const color =
    tone === "danger"
      ? "bg-red-500/20 text-red-200 hover:bg-red-500/35"
      : tone === "good"
        ? "bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/35"
        : "bg-white/10 text-slate-200 hover:bg-white/20";
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`shrink-0 rounded px-2 py-0.5 text-[11px] ${color}`}
    >
      {children}
    </button>
  );
}

function DisabledFeatures({ overrides }) {
  const total = overrides.pages.length + overrides.features.length + overrides.styles.length;
  if (!total) return null;
  return (
    <Section title={`Dev changes (${total})`}>
      {overrides.pages.map((page) => (
        <div key={`page:${page.match}`} className="flex items-center gap-1 text-[11px]">
          <span className="shrink-0 rounded bg-red-500/15 px-1 text-[9.5px] uppercase text-red-200">page</span>
          <span className="min-w-0 flex-1 truncate text-slate-200" title={page.match}>
            {page.label}
          </span>
          <SmallButton tone="good" onClick={() => restorePage(page.match)}>
            Restore
          </SmallButton>
        </div>
      ))}
      {overrides.features.map((feature) => (
        <div key={`feat:${feature.key}:${feature.route}`} className="flex items-center gap-1 text-[11px]">
          <span
            className={`shrink-0 rounded px-1 font-mono text-[9.5px] ${
              feature.mode === FEATURE_REMOVED ? "bg-red-500/15 text-red-200" : "bg-amber-500/15 text-amber-200"
            }`}
            title={feature.mode === FEATURE_REMOVED ? "Removed (hidden and not working)" : "Disabled (visible, not working)"}
          >
            {feature.mode === FEATURE_REMOVED ? "removed" : "off"} · {feature.tag || "feature"}
          </span>
          <span className="min-w-0 flex-1 truncate text-slate-200" title={`${feature.key}\non ${feature.routeLabel}`}>
            “{feature.label}” <span className="text-slate-500">· {feature.routeLabel}</span>
          </span>
          <SmallButton tone="good" onClick={() => restoreFeature(feature.key, feature.route)}>
            Restore
          </SmallButton>
        </div>
      ))}
      {overrides.styles.map((style) => (
        <div key={`style:${style.key}:${style.route}`} className="flex items-center gap-1 text-[11px]">
          <span className="shrink-0 rounded bg-sky-500/15 px-1 font-mono text-[9.5px] text-sky-200">
            bg · {style.tag || "element"}
          </span>
          <span
            className="h-3 w-3 shrink-0 rounded-sm border border-white/30"
            style={{ background: style.value }}
            title={style.value}
          />
          <span className="min-w-0 flex-1 truncate text-slate-200" title={`${style.key}\n${style.value} on ${style.routeLabel}`}>
            “{style.label}” <span className="text-slate-500">· {style.routeLabel}</span>
          </span>
          <SmallButton tone="good" onClick={() => restoreStyle(style.key, style.route)}>
            Restore
          </SmallButton>
        </div>
      ))}
      <SmallButton
        tone="danger"
        onClick={restoreAllOverrides}
        title="Bring back every removed page, disabled/removed feature and original background"
      >
        Restore all
      </SmallButton>
    </Section>
  );
}

function LogicList({ logic, onOpen, onCopy }) {
  if (!logic?.length) return null;
  return logic.map(({ attr, items }) => (
    <div key={attr} className="text-[11px]">
      <span className="font-mono text-sky-300">{attr}</span>
      <div className="mt-0.5 space-y-1 pl-2">
        {items.map(({ name, decl, setterCalls }) => (
          <div key={name}>
            <div className="flex flex-wrap items-center gap-1">
              <span className="font-mono text-white">{name}</span>
              <span className="text-[10px] text-slate-500">{KIND_LABEL[decl.kind] || decl.kind}</span>
              <Loc loc={decl} onOpen={onOpen} onCopy={onCopy} />
            </div>
            {setterCalls.length ? (
              <div className="mt-0.5 flex flex-wrap items-center gap-1 pl-2 text-[10px] text-slate-400">
                changed in
                {setterCalls.map((call) => (
                  <Loc
                    key={call.line}
                    loc={call}
                    label={call.fn || "line"}
                    onOpen={onOpen}
                    onCopy={onCopy}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  ));
}

/**
 * Ctrl+E UI inspector (DEV only): hover/click any element to see which file,
 * line, helper, state, CSS rule, keyframes and component render it.
 */
export default function DevUiInspector() {
  const [open, setOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [selected, setSelected] = useState(null);
  const [point, setPoint] = useState(null);
  const [details, setDetails] = useState(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ q: "", items: [] });
  const [side, setSide] = useState("right");
  const [notice, setNotice] = useState("");
  const [minimized, setMinimized] = useState(readMinimized);
  const [bgDraft, setBgDraft] = useState({ el: null, value: "" });
  const [pageBgDraft, setPageBgDraft] = useState({ route: "", value: "" });
  const { pathname } = useLocation();
  const overrides = useDevOverrides();
  const disabledCount = overrides.pages.length + overrides.features.length + overrides.styles.length;

  const toggleMinimized = useCallback(() => {
    setMinimized((value) => {
      const next = !value;
      writeMinimized(next);
      return next;
    });
  }, []);

  const hoverElRef = useRef(null);
  const hoverBoxRef = useRef(null);
  const hoverLabelRef = useRef(null);
  const selectedBoxRef = useRef(null);
  const selectedRef = useRef(null);
  const openRef = useRef(false);
  const pausedRef = useRef(false);
  const noticeTimerRef = useRef(0);

  useEffect(() => {
    selectedRef.current = selected;
    openRef.current = open;
    pausedRef.current = paused;
  }, [selected, open, paused]);

  const flash = useCallback((message) => {
    setNotice(message);
    window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(""), 2200);
  }, []);

  const copy = useCallback(
    async (text) => {
      try {
        await navigator.clipboard.writeText(text);
        flash(`Copied ${text}`);
      } catch {
        flash(text);
      }
    },
    [flash]
  );

  const openLoc = useCallback(
    async (loc) => {
      const ok = await openInEditor(loc);
      if (ok) {
        flash(`Opened ${shortPath(loc.file)}:${loc.line || 1}`);
      } else {
        await copy(`${loc.file}:${loc.line || 1}`);
      }
    },
    [copy, flash]
  );

  const selectElement = useCallback((el, at) => {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setSelected(el);
    setPoint(at || { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      const isToggle =
        event.ctrlKey &&
        !event.shiftKey &&
        !event.altKey &&
        !event.metaKey &&
        event.key.toLowerCase() === "e";
      if (isToggle) {
        event.preventDefault();
        event.stopPropagation();
        const next = !openRef.current;
        setOpen(next);
        setPaused(false);
        if (!next) {
          setSelected(null);
          hoverElRef.current = null;
        }
        return;
      }
      if (event.key === "Escape" && openRef.current) {
        event.preventDefault();
        if (selectedRef.current) setSelected(null);
        else setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  useEffect(() => {
    setInspectorPicking(open && !paused);
    return () => setInspectorPicking(false);
  }, [open, paused]);

  useEffect(() => {
    if (!open || !overrides.features.length) return undefined;
    const mark = () => {
      const selector = featureSelector(activeFeatureKeys(window.location.pathname, FEATURE_DISABLED));
      const matches = new Set(
        selector
          ? [...document.querySelectorAll(selector)].filter((el) => !isInspectorNode(el))
          : []
      );
      document.querySelectorAll(`[${DISABLED_MARK}]`).forEach((el) => {
        if (!matches.has(el)) el.removeAttribute(DISABLED_MARK);
      });
      matches.forEach((el) => {
        if (!el.hasAttribute(DISABLED_MARK)) el.setAttribute(DISABLED_MARK, "");
      });
    };
    mark();
    const timer = window.setInterval(mark, 600);
    return () => {
      window.clearInterval(timer);
      document.querySelectorAll(`[${DISABLED_MARK}]`).forEach((el) => el.removeAttribute(DISABLED_MARK));
    };
  }, [open, overrides, pathname]);

  useEffect(() => {
    const selector = featureSelector(activeFeatureKeys(pathname, FEATURE_REMOVED));
    syncStyleTag(REMOVED_STYLE_ID, selector ? `${selector} { display: none !important; }` : "");
  }, [overrides, pathname]);

  const pageBackgroundActive = activeStyleOverrides(pathname).some(
    (style) => style.key === PAGE_BACKGROUND_KEY
  );

  useEffect(() => {
    const backgrounds = activeStyleOverrides(pathname).filter(
      (style) => style.prop === "background" && CSS.supports("color", style.value)
    );
    const rule = (selector, value) =>
      `${selector} { background-color: ${value} !important; background-image: none !important; }`;
    const css = [
      ...backgrounds
        .filter((style) => style.key === PAGE_BACKGROUND_KEY)
        .map((style) => rule(`html${BOOST}, body${BOOST}, [${PAGE_BG_MARK}]${BOOST}`, style.value)),
      ...backgrounds
        .filter((style) => style.key !== PAGE_BACKGROUND_KEY)
        .map((style) => rule(featureSelector([style.key]), style.value)),
    ].join("\n");
    syncStyleTag(BACKGROUND_STYLE_ID, css);
  }, [overrides, pathname]);

  useEffect(() => {
    if (!pageBackgroundActive) return undefined;
    const mark = () => {
      const minWidth = window.innerWidth * 0.7;
      const minHeight = window.innerHeight * 0.7;
      const keep = new Set(findPageBackgroundLayers());
      document.querySelectorAll(`[${PAGE_BG_MARK}]`).forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width >= minWidth && rect.height >= minHeight) keep.add(el);
        else el.removeAttribute(PAGE_BG_MARK);
      });
      keep.forEach((el) => {
        if (!el.hasAttribute(PAGE_BG_MARK)) el.setAttribute(PAGE_BG_MARK, "");
      });
    };
    mark();
    const timer = window.setInterval(mark, 700);
    return () => {
      window.clearInterval(timer);
      document.querySelectorAll(`[${PAGE_BG_MARK}]`).forEach((el) => el.removeAttribute(PAGE_BG_MARK));
    };
  }, [pageBackgroundActive, pathname]);

  useEffect(
    () => () => {
      document.getElementById(REMOVED_STYLE_ID)?.remove();
      document.getElementById(BACKGROUND_STYLE_ID)?.remove();
    },
    []
  );

  useEffect(() => {
    if (!open) return undefined;
    const root = document.documentElement;
    if (!paused) root.classList.add("en-ui-inspecting");
    else root.classList.remove("en-ui-inspecting");
    return () => root.classList.remove("en-ui-inspecting");
  }, [open, paused]);

  useEffect(() => {
    if (!open) return undefined;
    let frame = 0;
    const tick = () => {
      const hoverEl = pausedRef.current ? null : hoverElRef.current;
      placeBox(hoverBoxRef.current, hoverEl);
      placeBox(selectedBoxRef.current, selectedRef.current);
      const label = hoverLabelRef.current;
      if (label) {
        if (hoverEl?.isConnected) {
          const rect = hoverEl.getBoundingClientRect();
          const top = rect.top > 24 ? rect.top - 22 : rect.bottom + 4;
          label.style.display = "block";
          label.style.transform = `translate(${Math.max(4, rect.left)}px, ${top}px)`;
        } else {
          label.style.display = "none";
        }
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open || paused) return undefined;

    const shouldIgnore = (event) => isInspectorNode(event.target) || event.shiftKey;

    const onMove = (event) => {
      const target = document.elementFromPoint(event.clientX, event.clientY);
      if (!target || isInspectorNode(target)) {
        hoverElRef.current = null;
        return;
      }
      if (hoverElRef.current !== target) {
        hoverElRef.current = target;
        if (hoverLabelRef.current) hoverLabelRef.current.textContent = hoverText(target);
      }
    };

    const block = (event) => {
      if (shouldIgnore(event)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    const onClick = (event) => {
      if (shouldIgnore(event)) return;
      block(event);
      const target = document.elementFromPoint(event.clientX, event.clientY);
      if (!target || isInspectorNode(target)) return;
      selectElement(target, { x: event.clientX, y: event.clientY });
      if (event.altKey) {
        const src = elementSource(target);
        if (src) openLoc(src);
      }
    };

    window.addEventListener("mousemove", onMove, true);
    window.addEventListener("click", onClick, true);
    BLOCKED_EVENTS.forEach((type) => window.addEventListener(type, block, true));
    return () => {
      window.removeEventListener("mousemove", onMove, true);
      window.removeEventListener("click", onClick, true);
      BLOCKED_EVENTS.forEach((type) => window.removeEventListener(type, block, true));
    };
  }, [open, paused, openLoc, selectElement]);

  useEffect(() => {
    if (!selected) return undefined;
    let cancelled = false;
    loadInspectorIndex().then((index) => {
      if (cancelled || !selected.isConnected) return;
      setDetails({ el: selected, ...describeElement(index, selected, point) });
    });
    return () => {
      cancelled = true;
    };
  }, [selected, point]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return undefined;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      loadInspectorIndex().then((index) => {
        if (!cancelled) setResults({ q, items: searchSource(index, q) });
      });
    }, 160);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => () => window.clearTimeout(noticeTimerRef.current), []);

  if (!open) {
    if (!disabledCount) return null;
    return createPortal(
      <button
        type="button"
        data-en-inspector=""
        onClick={() => {
          setOpen(true);
          setPaused(true);
        }}
        title="Dev-only overrides are active — click to open the inspector and restore them"
        className="fixed bottom-2 left-2 z-[2147483003] rounded-full bg-red-600/80 px-2.5 py-0.5 font-mono text-[10px] text-white opacity-60 shadow transition-opacity hover:opacity-100"
      >
        {disabledCount} dev change{disabledCount === 1 ? "" : "s"} active
      </button>,
      document.body
    );
  }

  const info = details?.el === selected ? details : null;
  const trimmedQuery = query.trim();
  const searchItems = trimmedQuery.length >= 2 && results.q === trimmedQuery ? results.items : null;
  const currentRoute = routeFor(pathname);
  const pageRemoved = isPageRemoved(pathname);
  const pageBgSaved = pageBackgroundFor(pathname);
  const pageBgValue =
    pageBgDraft.route === currentRoute.match && pageBgDraft.value
      ? pageBgDraft.value
      : pageBgSaved.page?.value || pageBgSaved.all?.value || pageBackgroundHex();
  const pageBgValid = typeof CSS !== "undefined" && CSS.supports("color", pageBgValue);
  const applyPageBackground = (scope) => {
    if (!pageBgValid) return;
    setPageBackground(pathname, pageBgValue, scope);
    flash(
      scope === "all"
        ? `Page background ${pageBgValue} on every page (dev only)`
        : `Page background ${pageBgValue} on ${currentRoute.label} only (dev only)`
    );
  };
  const featureTarget =
    selected?.isConnected && !isInspectorNode(selected) ? resolveFeatureTarget(selected) : null;
  const featureKey = featureTarget ? featureKeyFor(featureTarget) : "";
  const featureMode = featureKey ? featureModeFor(featureTarget, pathname) : null;
  const featureDisabled = featureMode === FEATURE_DISABLED;
  const featureRemoved = featureMode === FEATURE_REMOVED;
  const disabledAncestor =
    featureKey && !featureMode ? findDisabledFeature(featureTarget.parentElement, pathname) : null;
  const ancestorRemoved = disabledAncestor ? featureModeFor(disabledAncestor, pathname) === FEATURE_REMOVED : false;
  const styleTarget = selected?.isConnected && !isInspectorNode(selected) ? resolveStyleTarget(selected) : null;
  const backgroundSaved = styleTarget ? backgroundOverridesFor(styleTarget, pathname) : {};
  const backgroundSeen = styleTarget ? visibleBackground(styleTarget) : { hex: "#ffffff", painter: null };
  const backgroundPainter =
    backgroundSeen.painter && backgroundSeen.painter !== styleTarget ? backgroundSeen.painter : null;
  const backgroundValue =
    bgDraft.el === styleTarget && bgDraft.value
      ? bgDraft.value
      : backgroundSaved.page?.value ||
        backgroundSaved.all?.value ||
        (backgroundPainter ? pageBgSaved.page?.value || pageBgSaved.all?.value : "") ||
        backgroundSeen.hex;
  const backgroundValid = typeof CSS !== "undefined" && CSS.supports("color", backgroundValue);
  const hasAnyBackground = Boolean(
    backgroundSaved.page || backgroundSaved.all || pageBgSaved.page || pageBgSaved.all
  );
  /** "element" = only the selected element on this page; "page" / "all" = the whole page background. */
  const applyBackground = (scope) => {
    if (!styleTarget || !backgroundValid) return;
    if (scope === "element") {
      setBackground(styleTarget, pathname, backgroundValue, "page");
      flash(`This element is now ${backgroundValue} on ${currentRoute.label} (dev only)`);
      return;
    }
    // The selected element's own color would sit on top of the new page color.
    if (backgroundSaved.page || backgroundSaved.all) clearBackground(styleTarget, pathname);
    setPageBackground(pathname, backgroundValue, scope);
    setPageBgDraft({ route: "", value: "" });
    flash(
      scope === "all"
        ? `Whole background is now ${backgroundValue} on every page (dev only)`
        : `Whole background of ${currentRoute.label} is now ${backgroundValue} (dev only)`
    );
  };
  const resetBackgrounds = () => {
    if (styleTarget) clearBackground(styleTarget, pathname);
    clearPageBackground(pathname);
    setBgDraft({ el: null, value: "" });
    setPageBgDraft({ route: "", value: "" });
    flash("Background colors reset to original");
  };

  return createPortal(
    <div data-en-inspector="">
      <style>{`
        html.en-ui-inspecting, html.en-ui-inspecting *:not([data-en-inspector] *) { cursor: crosshair !important; }
        [${DISABLED_MARK}] { outline: 2px dashed rgba(248, 113, 113, 0.9) !important; outline-offset: 2px !important; }
      `}</style>

      <div
        ref={hoverBoxRef}
        className="pointer-events-none fixed left-0 top-0 z-[2147483000] rounded-sm border border-dashed border-sky-400/70"
        style={{ display: "none" }}
      />
      <div
        ref={hoverLabelRef}
        className="pointer-events-none fixed left-0 top-0 z-[2147483002] max-w-[60vw] truncate rounded-sm bg-black/70 px-1 py-px font-mono text-[9.5px] text-sky-200"
        style={{ display: "none" }}
      />
      <div
        ref={selectedBoxRef}
        className="pointer-events-none fixed left-0 top-0 z-[2147483001] rounded-sm border border-amber-400/80"
        style={{ display: "none" }}
      />

      {minimized ? (
        <button
          type="button"
          onClick={toggleMinimized}
          title={`Inspector (minimized) — click to expand · Ctrl+E closes${
            info?.src ? `\n${info.src.file}:${info.src.line}` : ""
          }`}
          className={`fixed bottom-2 z-[2147483003] max-w-[45vw] truncate rounded-full bg-black/60 px-2 py-0.5 font-mono text-[9.5px] text-emerald-300/80 opacity-40 transition-opacity hover:opacity-100 ${
            side === "right" ? "right-2" : "left-2"
          }`}
        >
          {paused ? "⏸ " : "⌖ "}
          {info?.src ? `${shortPath(info.src.file)}:${info.src.line}` : "inspect"}
        </button>
      ) : (
      <aside
        className={`fixed top-2 z-[2147483003] flex max-h-[min(65vh,560px)] w-[min(300px,calc(100vw-1rem))] flex-col overflow-hidden rounded-lg border border-white/10 bg-[#0b1311]/90 text-slate-100 opacity-60 shadow-lg backdrop-blur-sm transition-opacity duration-200 hover:opacity-100 focus-within:opacity-100 ${
          side === "right" ? "right-2" : "left-2"
        }`}
      >
        <header className="flex items-center gap-1 px-2 py-1">
          <p
            className="min-w-0 flex-1 truncate text-[10.5px] font-medium text-emerald-300/90"
            title="Click an element · Shift+click = normal click · Alt+click = open source · Esc clears · Ctrl+E closes"
          >
            Inspector{paused ? " · paused" : ""}
          </p>
          <HeaderButton
            onClick={() => setPaused((value) => !value)}
            active={paused}
            title={paused ? "Resume picking" : "Pause picking so the page is clickable"}
          >
            {paused ? "▶" : "⏸"}
          </HeaderButton>
          <HeaderButton
            onClick={() => setSide((value) => (value === "right" ? "left" : "right"))}
            title="Move to the other side"
          >
            ⇆
          </HeaderButton>
          <HeaderButton onClick={toggleMinimized} title="Minimize to a small corner pill">
            –
          </HeaderButton>
          <HeaderButton
            onClick={() => {
              setOpen(false);
              setSelected(null);
            }}
            danger
            title="Close (Ctrl+E)"
          >
            ✕
          </HeaderButton>
        </header>

        <div className="px-2 pb-1.5">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find in code…"
            className="w-full rounded border border-white/10 bg-black/40 px-1.5 py-1 text-[11px] text-white placeholder:text-slate-500 focus:border-emerald-400/50 focus:outline-none"
          />
          <div className="mt-1 flex items-center gap-1 text-[11px]">
            <span className="min-w-0 flex-1 truncate text-slate-400" title={currentRoute.match}>
              Page: <span className={pageRemoved ? "text-red-300" : "text-slate-200"}>{currentRoute.label}</span>
            </span>
            <SmallButton
              tone={pageRemoved ? "good" : "danger"}
              onClick={() => {
                const removed = togglePage(pathname);
                flash(removed ? `Removed ${currentRoute.label} (dev only)` : `Restored ${currentRoute.label}`);
              }}
              title={
                pageRemoved
                  ? "Show this page again"
                  : "Render a blank slate on this route (local dev only, stored in this browser)"
              }
            >
              {pageRemoved ? "Restore page" : "Remove page"}
            </SmallButton>
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px]">
            <span className="shrink-0 text-slate-400">Page bg</span>
            <input
              type="color"
              value={/^#[0-9a-f]{6}$/i.test(pageBgValue) ? pageBgValue : "#ffffff"}
              onChange={(event) => setPageBgDraft({ route: currentRoute.match, value: event.target.value })}
              className="h-5 w-6 shrink-0 cursor-pointer rounded border border-white/20 bg-transparent p-0"
              title="Pick the page background color"
            />
            <input
              value={pageBgValue}
              onChange={(event) => setPageBgDraft({ route: currentRoute.match, value: event.target.value.trim() })}
              className={`w-[4.75rem] min-w-0 rounded border bg-black/40 px-1 py-px font-mono text-[10.5px] text-white focus:outline-none ${
                pageBgValid ? "border-white/10 focus:border-emerald-400/50" : "border-red-400/60"
              }`}
            />
            <SmallButton
              tone="good"
              onClick={() => applyPageBackground("page")}
              title={`Whole background of ${currentRoute.label} only — other pages stay the same`}
            >
              This page
            </SmallButton>
            <SmallButton
              onClick={() => applyPageBackground("all")}
              title="Whole background of every page (home, login, dashboards…)"
            >
              All pages
            </SmallButton>
            {pageBgSaved.page || pageBgSaved.all ? (
              <SmallButton
                tone="danger"
                onClick={() => {
                  clearPageBackground(pathname);
                  setPageBgDraft({ route: "", value: "" });
                  flash("Page background reset");
                }}
                title="Remove the page-only and all-pages background changes"
              >
                ↺
              </SmallButton>
            ) : null}
          </div>
          {pageBgSaved.page && pageBgSaved.all ? (
            <p className="mt-0.5 text-[10px] text-slate-500">
              This page {pageBgSaved.page.value} overrides all pages {pageBgSaved.all.value} here.
            </p>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pb-1.5">
          {searchItems ? (
            <Section title={`${searchItems.length} matches`}>
              {searchItems.length ? (
                searchItems.map((hit) => (
                  <div key={`${hit.file}:${hit.line}`} className="text-[11px]">
                    <Loc loc={hit} onOpen={openLoc} onCopy={copy} />
                    <p className="mt-0.5 truncate font-mono text-[10.5px] text-slate-400">{hit.text}</p>
                  </div>
                ))
              ) : (
                <p className="text-[11px] text-slate-400">No matches.</p>
              )}
            </Section>
          ) : info ? (
            <>
              <Section title="Element">
                <p className="break-all font-mono text-[12px] text-amber-200">{info.label}</p>
                {info.src ? (
                  <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-400">
                    {info.src.self ? "JSX" : "nearest JSX"}
                    <Loc loc={info.src} onOpen={openLoc} onCopy={copy} />
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500">No source tag (third-party or injected DOM).</p>
                )}
                {info.text ? (
                  <PropRow
                    row={{ label: "text", value: `“${info.text.text}”`, swatch: false, sources: info.text.sources }}
                    onOpen={openLoc}
                    onCopy={copy}
                  />
                ) : null}
                {info.hasParent ? (
                  <button
                    type="button"
                    onClick={() => selectElement(selected.parentElement)}
                    className="rounded bg-white/10 px-2 py-0.5 text-[11px] hover:bg-white/20"
                  >
                    ↑ Select parent
                  </button>
                ) : null}
                {featureKey ? (
                  <div className="flex flex-wrap items-center gap-1">
                    <SmallButton
                      tone={featureDisabled ? "good" : "danger"}
                      onClick={() => {
                        const mode = toggleFeature(featureTarget, pathname, FEATURE_DISABLED);
                        flash(mode ? "Feature disabled on this page (dev only)" : "Feature enabled");
                      }}
                      title={
                        featureDisabled
                          ? "Let this feature work again"
                          : "Keep it visible but ignore every click, keystroke and submit inside it on this page (local dev only)"
                      }
                    >
                      {featureDisabled ? "Enable feature" : "Disable this feature"}
                    </SmallButton>
                    <SmallButton
                      tone={featureRemoved ? "good" : "danger"}
                      onClick={() => {
                        const mode = toggleFeature(featureTarget, pathname, FEATURE_REMOVED);
                        flash(mode ? "Feature removed from this page (dev only)" : "Feature restored");
                      }}
                      title={
                        featureRemoved
                          ? "Show this feature again and let it work"
                          : "Hide it from this page and stop everything inside it (local dev only) — restore from Dev changes"
                      }
                    >
                      {featureRemoved ? "Restore feature" : "Remove this feature"}
                    </SmallButton>
                    {featureTarget !== selected ? (
                      <span className="text-[10px] text-slate-500">
                        applies to the enclosing &lt;{featureTarget.tagName.toLowerCase()}&gt;
                      </span>
                    ) : null}
                    {disabledAncestor ? (
                      <span className="text-[10px] text-red-300/80">
                        already off — inside a {ancestorRemoved ? "removed" : "disabled"} &lt;
                        {disabledAncestor.tagName.toLowerCase()}&gt;
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </Section>

              {styleTarget && featureKeyFor(styleTarget) ? (
                <Section title="Background color (dev only)">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={/^#[0-9a-f]{6}$/i.test(backgroundValue) ? backgroundValue : "#ffffff"}
                      onChange={(event) => setBgDraft({ el: styleTarget, value: event.target.value })}
                      className="h-6 w-8 shrink-0 cursor-pointer rounded border border-white/20 bg-transparent p-0"
                      title="Pick a color"
                    />
                    <input
                      value={backgroundValue}
                      onChange={(event) => setBgDraft({ el: styleTarget, value: event.target.value.trim() })}
                      placeholder="#1e293b, red, rgb(…)"
                      className={`min-w-0 flex-1 rounded border bg-black/40 px-1.5 py-0.5 font-mono text-[11px] text-white focus:outline-none ${
                        backgroundValid ? "border-white/10 focus:border-emerald-400/50" : "border-red-400/60"
                      }`}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <SmallButton
                      onClick={() => applyBackground("element")}
                      title={`Only the selected element, only on ${currentRoute.label}`}
                    >
                      This element
                    </SmallButton>
                    <SmallButton
                      tone="good"
                      onClick={() => applyBackground("page")}
                      title={`The whole background of ${currentRoute.label} (top to bottom); other pages stay the same`}
                    >
                      Entire page
                    </SmallButton>
                    <SmallButton
                      tone="good"
                      onClick={() => applyBackground("all")}
                      title="The whole background of every page — home, login, dashboards, profile…"
                    >
                      All pages
                    </SmallButton>
                    {hasAnyBackground ? (
                      <SmallButton
                        tone="danger"
                        onClick={resetBackgrounds}
                        title="Undo this element's color and the page background (this page and all pages)"
                      >
                        Reset
                      </SmallButton>
                    ) : null}
                  </div>
                  {hasAnyBackground ? (
                    <p className="text-[10px] text-slate-500">
                      {[
                        backgroundSaved.page && `This element: ${backgroundSaved.page.value}`,
                        backgroundSaved.all && `This element (legacy, everywhere): ${backgroundSaved.all.value}`,
                        pageBgSaved.page && `This page: ${pageBgSaved.page.value}`,
                        pageBgSaved.all && `All pages: ${pageBgSaved.all.value}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      {pageBgSaved.page && pageBgSaved.all ? " (this page wins here)" : ""}
                    </p>
                  ) : null}
                  {styleTarget !== selected ? (
                    <p className="text-[10px] text-slate-500">
                      applies to the enclosing &lt;{styleTarget.tagName.toLowerCase()}&gt;
                    </p>
                  ) : null}
                  {backgroundPainter && !backgroundSaved.page && !backgroundSaved.all ? (
                    <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-400">
                      <span className="min-w-0">
                        This element is see-through — the color shown is painted behind it by{" "}
                        <span className="font-mono text-amber-200">{elementLabel(backgroundPainter)}</span>.
                        Use “Entire page” or “All pages” to recolor the whole background.
                      </span>
                      {resolveStyleTarget(backgroundPainter) === backgroundPainter ? (
                        <SmallButton
                          onClick={() => selectElement(backgroundPainter)}
                          title="Inspect the layer that paints this color (changing it there affects everything it covers)"
                        >
                          Select that layer
                        </SmallButton>
                      ) : null}
                    </div>
                  ) : null}
                </Section>
              ) : null}

              {info.logic.length ? (
                <Section title="Logic this element uses">
                  <LogicList logic={info.logic} onOpen={openLoc} onCopy={copy} />
                </Section>
              ) : null}

              {info.images.length ? (
                <Section title="Images">
                  {info.images.map((image, idx) => (
                    <ImageCard key={idx} image={image} onOpen={openLoc} onCopy={copy} />
                  ))}
                </Section>
              ) : null}

              {info.icon ? (
                <Section title="Lucide icon">
                  <div className="flex flex-wrap items-center gap-1 text-[11px]">
                    <span className="font-mono text-white">{info.icon.name}</span>
                    {info.icon.src ? <Loc loc={info.icon.src} onOpen={openLoc} onCopy={copy} /> : null}
                  </div>
                  <Chips items={info.icon.classes} tone="sky" />
                </Section>
              ) : null}

              <Section title="Colors">
                {info.colors.map((row) => (
                  <PropRow key={row.label} row={row} onOpen={openLoc} onCopy={copy} />
                ))}
              </Section>

              {info.motion.length ? (
                <Section title="Animation / motion">
                  {info.motion.map((row) => (
                    <PropRow key={row.label} row={{ ...row, swatch: false }} onOpen={openLoc} onCopy={copy}>
                      {row.keyframes?.map((kf) => (
                        <div key={kf.name} className="mt-0.5 flex flex-wrap items-center gap-1">
                          <span className="font-mono text-[10.5px] text-white">@keyframes {kf.name}</span>
                          {kf.hits.map((hit) => (
                            <Loc key={`${hit.file}:${hit.line}`} loc={hit} onOpen={openLoc} onCopy={copy} />
                          ))}
                          {!kf.hits.length && kf.builtin ? (
                            <span className="text-[10px] text-slate-500">Tailwind built-in</span>
                          ) : null}
                        </div>
                      ))}
                    </PropRow>
                  ))}
                </Section>
              ) : null}

              {info.cssRules.length ? (
                <Section title="CSS rules applied">
                  {info.cssRules.map((rule) => (
                    <div key={`${rule.loc.file}:${rule.loc.line}`} className="flex items-start gap-2 text-[11px]">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-sky-300" title={rule.selector}>
                          {rule.selector}
                        </p>
                        <p className="truncate font-mono text-[10px] text-slate-500">{rule.props.join(", ")}</p>
                      </div>
                      <div className="max-w-[58%] shrink-0">
                        <Loc loc={rule.loc} onOpen={openLoc} onCopy={copy} />
                      </div>
                    </div>
                  ))}
                </Section>
              ) : null}

              {info.pseudo.length ? (
                <Section title="Pseudo elements">
                  {info.pseudo.map((p) => (
                    <div key={p.which} className="font-mono text-[10.5px] text-slate-300">
                      <span className="text-white">{p.which}</span> content {p.content}
                      {p.background ? ` · bg ${p.background}` : ""}
                      {p.backgroundImage ? ` · ${p.backgroundImage.slice(0, 60)}` : ""}
                      {p.animation ? ` · animation ${p.animation}` : ""}
                      {p.transition ? ` · transition ${p.transition}` : ""}
                    </div>
                  ))}
                </Section>
              ) : null}

              {info.inlineStyle ? (
                <Section title="Inline style (set by JS)">
                  <p className="break-all font-mono text-[10.5px] text-slate-300">{info.inlineStyle}</p>
                </Section>
              ) : null}

              {info.layers.length > 1 ? (
                <Section title="Layers at this point (smallest first)">
                  {info.layers.map((layer, idx) => (
                    <div key={idx} className="flex items-center gap-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() => selectElement(layer.el, point)}
                        className={`min-w-0 truncate rounded px-1.5 py-0.5 text-left font-mono ${
                          layer.el === selected
                            ? "bg-amber-400/20 text-amber-200"
                            : "bg-white/5 text-slate-200 hover:bg-white/15"
                        }`}
                        title="Inspect this layer"
                      >
                        {layer.label}
                      </button>
                      {layer.src ? (
                        <span className="shrink-0 font-mono text-[10px] text-slate-500">
                          {shortPath(layer.src.file)}:{layer.src.line}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </Section>
              ) : null}
            </>
          ) : (
            <p className="px-2 pb-1 text-[10px] text-slate-500">
              Click an element to inspect. Green chips open in Cursor.
            </p>
          )}
          <DisabledFeatures overrides={overrides} />
        </div>

        {notice ? (
          <div className="border-t border-white/10 px-2 py-1 font-mono text-[10px] text-emerald-300/90">
            {notice}
          </div>
        ) : null}
      </aside>
      )}
    </div>,
    document.body
  );
}
