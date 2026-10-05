import { isInspectorNode } from "./uiInspectorDescribe";
import { findDisabledFeature, getDevOverrides, isInspectorPicking } from "./devOverrides";

const ALWAYS_BLOCKED = ["click", "auxclick", "dblclick", "beforeinput", "paste", "drop"];
const FIELD_SELECTOR = 'input, select, textarea, [contenteditable=""], [contenteditable="true"]';
const PASS_KEYS = new Set(["Tab", "Escape"]);

function swallow(event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}

function insideDisabledFeature(node) {
  if (!node || isInspectorPicking() || !getDevOverrides().features.length) return false;
  const el = node.nodeType === 1 ? node : node.parentElement;
  if (!el || isInspectorNode(el)) return false;
  return Boolean(findDisabledFeature(el, window.location.pathname));
}

/**
 * Window capture listeners run before React's root listener, so anything inside a disabled
 * feature stays visible and hoverable, but its clicks, typing, dropdown changes, drops and
 * form submits never reach the app. Returns an uninstall function.
 */
export function installDevClickBlocker() {
  const onAlways = (event) => {
    if (insideDisabledFeature(event.target)) swallow(event);
  };
  const onMouseDown = (event) => {
    const select = event.target?.closest?.("select");
    if (select && insideDisabledFeature(select)) swallow(event);
  };
  const onKeyDown = (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || PASS_KEYS.has(event.key)) return;
    const field = event.target?.closest?.(FIELD_SELECTOR);
    if (field && insideDisabledFeature(field)) swallow(event);
  };
  const onSubmit = (event) => {
    if (insideDisabledFeature(event.submitter) || insideDisabledFeature(event.target)) swallow(event);
  };

  const listeners = [
    ...ALWAYS_BLOCKED.map((type) => [type, onAlways]),
    ["mousedown", onMouseDown],
    ["keydown", onKeyDown],
    ["submit", onSubmit],
  ];
  listeners.forEach(([type, handler]) => window.addEventListener(type, handler, true));
  return () => {
    listeners.forEach(([type, handler]) => window.removeEventListener(type, handler, true));
  };
}
