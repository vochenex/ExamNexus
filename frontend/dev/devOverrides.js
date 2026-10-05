/**
 * Dev-only feature overrides driven by the Ctrl+E inspector:
 * - removed pages render a blank slate (DevPageOutlet / DevPageGate)
 * - disabled features (any button, link, input, card, section…) ignore clicks, typing and
 *   submits (devClickBlocker); removed features are also hidden (DevUiInspector style tag)
 * - background colors per element, on one page or on all pages (DevUiInspector style tag)
 * Stored per browser in localStorage. Every check is a no-op outside `vite dev`.
 */
import { useSyncExternalStore } from "react";
import { resolveRouteFileInfo } from "../config/routeFileMap";

const ENABLED = import.meta.env.DEV;
const STORAGE_KEY = "en_dev_overrides_v1";
const CHANGE_EVENT = "en:dev-overrides";
const EMPTY = Object.freeze({ pages: [], features: [], styles: [] });

export const CLICKABLE_SELECTOR =
  'button, a[href], [role="button"], input[type="submit"], input[type="button"]';

let cache = null;
let inspectorPicking = false;

/** While the inspector is picking, clicks must reach it even on disabled features. */
export function setInspectorPicking(value) {
  inspectorPicking = Boolean(value);
}

export function isInspectorPicking() {
  return inspectorPicking;
}

function parse(raw) {
  try {
    const value = JSON.parse(raw || "null");
    const features = value?.features ?? value?.buttons;
    return {
      pages: Array.isArray(value?.pages) ? value.pages : [],
      features: Array.isArray(features) ? features : [],
      styles: Array.isArray(value?.styles) ? value.styles : [],
    };
  } catch {
    return { pages: [], features: [], styles: [] };
  }
}

export function getDevOverrides() {
  if (!ENABLED) return EMPTY;
  if (!cache) cache = parse(localStorage.getItem(STORAGE_KEY));
  return cache;
}

function write(next) {
  if (!ENABLED) return;
  cache = next;
  if (next.pages.length || next.features.length || next.styles.length) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(callback) {
  if (!ENABLED) return () => {};
  const onStorage = (event) => {
    if (event.key !== STORAGE_KEY) return;
    cache = null;
    callback();
  };
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", onStorage);
  };
}

export function useDevOverrides() {
  return useSyncExternalStore(subscribe, getDevOverrides, () => EMPTY);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Route identity for a pathname: the routeFileMap pattern, or the exact path if unmapped. */
export function routeFor(pathname) {
  const path = String(pathname || "/").split("?")[0] || "/";
  const info = resolveRouteFileInfo(path);
  if (info.match) return { match: info.match.source, label: info.label };
  return { match: `^${escapeRegex(path)}$`, label: path };
}

function routeMatches(match, pathname) {
  try {
    return new RegExp(match).test(String(pathname || "/").split("?")[0] || "/");
  } catch {
    return false;
  }
}

export function isPageRemoved(pathname) {
  if (!ENABLED) return false;
  return getDevOverrides().pages.some((page) => routeMatches(page.match, pathname));
}

export function togglePage(pathname) {
  const route = routeFor(pathname);
  const current = getDevOverrides();
  const exists = current.pages.some((page) => page.match === route.match);
  write({
    ...current,
    pages: exists
      ? current.pages.filter((page) => page.match !== route.match)
      : [...current.pages, route],
  });
  return !exists;
}

export function restorePage(match) {
  const current = getDevOverrides();
  write({ ...current, pages: current.pages.filter((page) => page.match !== match) });
}

export function findClickable(node) {
  if (!node || node.nodeType !== 1) return null;
  return node.closest(CLICKABLE_SELECTOR);
}

const TAGGED_SELECTOR = "[data-en-use], [data-en-src]";

/**
 * The element a "Disable / Remove this feature" toggle acts on: the enclosing button/link when the
 * selection sits inside one, otherwise the selected element (or its nearest JSX-tagged ancestor).
 */
export function resolveFeatureTarget(node) {
  if (!node || node.nodeType !== 1) return null;
  const start = findClickable(node) || node;
  const target = start.closest(TAGGED_SELECTOR);
  if (!target || target === document.body || target === document.documentElement) return null;
  return target;
}

/** Prefer the call-site tag so disabling a shared <ProgressButton> only hits that usage. */
export function featureKeyFor(el) {
  if (!el || el.nodeType !== 1) return "";
  return el.getAttribute("data-en-use") || el.getAttribute("data-en-src") || "";
}

function hasKey(el, keys) {
  const use = el.getAttribute("data-en-use");
  const src = el.getAttribute("data-en-src");
  return Boolean((use && keys.has(use)) || (src && keys.has(src)));
}

export function describeFeature(el) {
  if (!el) return "feature";
  const text = (el.innerText || el.value || "").replace(/\s+/g, " ").trim();
  return (
    text.slice(0, 40) ||
    el.getAttribute("aria-label") ||
    el.getAttribute("placeholder") ||
    el.getAttribute("title") ||
    el.tagName.toLowerCase()
  );
}

export const FEATURE_DISABLED = "disabled";
export const FEATURE_REMOVED = "removed";

function modeOf(feature) {
  return feature.mode === FEATURE_REMOVED ? FEATURE_REMOVED : FEATURE_DISABLED;
}

function featuresOn(pathname) {
  return getDevOverrides().features.filter((feature) => routeMatches(feature.route, pathname));
}

function featureKeysFor(pathname) {
  return new Set(featuresOn(pathname).map((feature) => feature.key));
}

/** Feature keys active on this route, optionally only one mode (for outlining / hiding). */
export function activeFeatureKeys(pathname, mode) {
  if (!ENABLED) return [];
  return featuresOn(pathname)
    .filter((feature) => !mode || modeOf(feature) === mode)
    .map((feature) => feature.key);
}

/** "disabled", "removed", or null when the element itself is not overridden on this route. */
export function featureModeFor(el, pathname) {
  if (!ENABLED || !el || el.nodeType !== 1 || !getDevOverrides().features.length) return null;
  const use = el.getAttribute("data-en-use");
  const src = el.getAttribute("data-en-src");
  const hit = featuresOn(pathname).find((feature) => feature.key === use || feature.key === src);
  return hit ? modeOf(hit) : null;
}

/** Nearest element at or above `node` that is a disabled or removed feature on this route, or null. */
export function findDisabledFeature(node, pathname) {
  if (!ENABLED || !node || !getDevOverrides().features.length) return null;
  const keys = featureKeysFor(pathname);
  if (!keys.size) return null;
  let el = node.nodeType === 1 ? node : node.parentElement;
  while (el && el !== document.body) {
    if (hasKey(el, keys)) return el;
    el = el.parentElement;
  }
  return null;
}

/**
 * Turn `mode` ("disabled" | "removed") on for this element on the current route, switch it
 * from the other mode, or turn it off if it already has `mode`. Returns the new mode or null.
 */
export function toggleFeature(el, pathname, mode = FEATURE_DISABLED) {
  const key = featureKeyFor(el);
  if (!key) return null;
  const route = routeFor(pathname);
  const current = getDevOverrides();
  const same = (feature) => feature.key === key && feature.route === route.match;
  const existing = current.features.find(same);
  const others = current.features.filter((feature) => !same(feature));
  if (existing && modeOf(existing) === mode) {
    write({ ...current, features: others });
    return null;
  }
  write({
    ...current,
    features: [
      ...others,
      {
        key,
        label: existing?.label || describeFeature(el),
        tag: el.tagName.toLowerCase(),
        mode,
        route: route.match,
        routeLabel: route.label,
      },
    ],
  });
  return mode;
}

export function restoreFeature(key, route) {
  const current = getDevOverrides();
  write({
    ...current,
    features: current.features.filter((feature) => !(feature.key === key && feature.route === route)),
  });
}

export const ALL_PAGES = "*";

/** The element a background change acts on: the selection itself or its nearest JSX-tagged ancestor. */
export function resolveStyleTarget(node) {
  if (!node || node.nodeType !== 1) return null;
  const target = node.closest(TAGGED_SELECTOR);
  if (!target || target === document.body || target === document.documentElement) return null;
  return target;
}

/** Pseudo key for the whole-page background (not tied to one JSX element). */
export const PAGE_BACKGROUND_KEY = "@page";

function backgroundOverridesForKey(key, pathname) {
  if (!ENABLED || !key) return {};
  const route = routeFor(pathname).match;
  const mine = getDevOverrides().styles.filter((style) => style.key === key);
  return {
    page: mine.find((style) => style.route === route),
    all: mine.find((style) => style.route === ALL_PAGES),
  };
}

function setBackgroundForKey({ key, label, tag, allLabel }, pathname, value, scope) {
  if (!key || !value) return;
  const route = scope === "all" ? { match: ALL_PAGES, label: allLabel } : routeFor(pathname);
  const current = getDevOverrides();
  const same = (style) => style.key === key && style.route === route.match;
  const existing = current.styles.find(same);
  write({
    ...current,
    styles: [
      ...current.styles.filter((style) => !same(style)),
      {
        key,
        label: existing?.label || label,
        tag,
        prop: "background",
        value,
        route: route.match,
        routeLabel: route.label,
      },
    ],
  });
}

function clearBackgroundForKey(key, pathname) {
  if (!key) return;
  const route = routeFor(pathname).match;
  const current = getDevOverrides();
  write({
    ...current,
    styles: current.styles.filter(
      (style) => !(style.key === key && (style.route === route || style.route === ALL_PAGES))
    ),
  });
}

/** Background overrides saved for this element: `{ page, all }` (either may be undefined). */
export function backgroundOverridesFor(el, pathname) {
  return backgroundOverridesForKey(featureKeyFor(el), pathname);
}

/** `scope` is "page" (current route only) or "all" (every page the element appears on). */
export function setBackground(el, pathname, value, scope) {
  const key = featureKeyFor(el);
  if (!key) return;
  setBackgroundForKey(
    { key, label: describeFeature(el), tag: el.tagName.toLowerCase(), allLabel: "Everywhere it appears" },
    pathname,
    value,
    scope
  );
}

/** Clears this element's page-only and all-pages background overrides. */
export function clearBackground(el, pathname) {
  clearBackgroundForKey(featureKeyFor(el), pathname);
}

/** Whole-page background overrides: `{ page, all }`. */
export function pageBackgroundFor(pathname) {
  return backgroundOverridesForKey(PAGE_BACKGROUND_KEY, pathname);
}

/** `scope` is "page" (current route only) or "all" (every route, login included). */
export function setPageBackground(pathname, value, scope) {
  setBackgroundForKey(
    { key: PAGE_BACKGROUND_KEY, label: "Page background", tag: "page", allLabel: "All pages" },
    pathname,
    value,
    scope
  );
}

export function clearPageBackground(pathname) {
  clearBackgroundForKey(PAGE_BACKGROUND_KEY, pathname);
}

export function restoreStyle(key, route) {
  const current = getDevOverrides();
  write({
    ...current,
    styles: current.styles.filter((style) => !(style.key === key && style.route === route)),
  });
}

/** Style overrides active on this route, all-pages first so page-only entries win. */
export function activeStyleOverrides(pathname) {
  if (!ENABLED) return [];
  const { styles } = getDevOverrides();
  return [
    ...styles.filter((style) => style.route === ALL_PAGES),
    ...styles.filter((style) => style.route !== ALL_PAGES && routeMatches(style.route, pathname)),
  ];
}

export function restoreAllOverrides() {
  write({ pages: [], features: [], styles: [] });
}
