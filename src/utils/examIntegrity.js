export const INTEGRITY_EVENT_TYPES = {
  TAB_HIDDEN: "tab_hidden",
  WINDOW_BLUR: "window_blur",
  EXTERNAL_APP_OVERLAY: "external_app_overlay",
  ALT_TAB_ATTEMPT: "alt_tab_attempt",
  FULLSCREEN_EXIT: "fullscreen_exit",
  COPY_ATTEMPT: "copy_attempt",
  PASTE_ATTEMPT: "paste_attempt",
  CUT_ATTEMPT: "cut_attempt",
  CONTEXT_MENU: "context_menu",
  NAVIGATION_ATTEMPT: "navigation_attempt",
  DEVTOOLS_SHORTCUT: "devtools_shortcut",
  MULTIPLE_TABS: "multiple_tabs",
};

export const INTEGRITY_EVENT_MESSAGES = {
  [INTEGRITY_EVENT_TYPES.TAB_HIDDEN]:
    "You switched away from the assessment tab. This incident has been recorded and sent to your teacher.",
  [INTEGRITY_EVENT_TYPES.WINDOW_BLUR]:
    "The assessment window lost focus. This incident has been recorded and sent to your teacher.",
  [INTEGRITY_EVENT_TYPES.EXTERNAL_APP_OVERLAY]:
    "Another app or window appears to be open on top of the assessment. Close it to continue. This incident has been recorded.",
  [INTEGRITY_EVENT_TYPES.ALT_TAB_ATTEMPT]:
    "Switching apps or windows (Alt+Tab) is blocked during the assessment. This incident has been recorded.",
  [INTEGRITY_EVENT_TYPES.FULLSCREEN_EXIT]:
    "You exited fullscreen mode during the assessment. Return to fullscreen or this incident will remain recorded.",
  [INTEGRITY_EVENT_TYPES.COPY_ATTEMPT]:
    "Copying is not allowed during the assessment. This incident has been recorded.",
  [INTEGRITY_EVENT_TYPES.PASTE_ATTEMPT]:
    "Pasting is not allowed during the assessment. This incident has been recorded.",
  [INTEGRITY_EVENT_TYPES.CUT_ATTEMPT]:
    "Cutting is not allowed during the assessment. This incident has been recorded.",
  [INTEGRITY_EVENT_TYPES.CONTEXT_MENU]:
    "Right-click is disabled during the assessment. This incident has been recorded.",
  [INTEGRITY_EVENT_TYPES.NAVIGATION_ATTEMPT]:
    "You cannot leave the assessment until you submit or the timer expires. This incident has been recorded.",
  [INTEGRITY_EVENT_TYPES.DEVTOOLS_SHORTCUT]:
    "Keyboard shortcuts are disabled during the assessment. This incident has been recorded.",
  [INTEGRITY_EVENT_TYPES.MULTIPLE_TABS]:
    "Only one assessment tab is allowed. Close other tabs immediately. This incident has been recorded.",
};

export function getIntegrityEventMessage(eventType) {
  return (
    INTEGRITY_EVENT_MESSAGES[eventType] ||
    "Suspicious activity detected. This incident has been recorded and sent to your teacher."
  );
}

export function formatIntegrityEventLabel(eventType) {
  return String(eventType || "unknown")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getExamSessionKey(examId) {
  return `examnexus_active_session_${examId}`;
}

export function getExamTabLockKey(examId) {
  return `examnexus_tab_lock_${examId}`;
}

export function saveExamSession(examId, payload) {
  sessionStorage.setItem(getExamSessionKey(examId), JSON.stringify(payload));
}

export function loadExamSession(examId) {
  try {
    const raw = sessionStorage.getItem(getExamSessionKey(examId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearExamSession(examId) {
  sessionStorage.removeItem(getExamSessionKey(examId));
  sessionStorage.removeItem(getExamTabLockKey(examId));
}

export function computeRemainingSeconds(startedAtIso, totalSeconds) {
  const startedAt = new Date(startedAtIso).getTime();
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  return Math.max(0, totalSeconds - elapsed);
}

const RESTRICTED_SHORTCUTS = [
  { key: "F12" },
  { key: "F5" },
  { key: "F11" },
  { key: "F1" },
  { key: "F3" },
  { key: "F7" },
  { ctrl: true, shift: true, key: "I" },
  { ctrl: true, shift: true, key: "J" },
  { ctrl: true, shift: true, key: "C" },
  { ctrl: true, shift: true, key: "R" },
  { ctrl: true, key: "U" },
  { ctrl: true, key: "S" },
  { ctrl: true, key: "C" },
  { ctrl: true, key: "V" },
  { ctrl: true, key: "X" },
  { ctrl: true, key: "A" },
  { ctrl: true, key: "P" },
  { ctrl: true, key: "F" },
  { ctrl: true, key: "H" },
  { ctrl: true, key: "R" },
  { ctrl: true, key: "T" },
  { ctrl: true, key: "W" },
  { ctrl: true, key: "N" },
  { ctrl: true, key: "G" },
  { ctrl: true, key: "D" },
  { ctrl: true, key: "E" },
  { ctrl: true, key: "O" },
  { ctrl: true, key: "K" },
  { ctrl: true, key: "L" },
  { meta: true, alt: true, key: "I" },
  { meta: true, key: "C" },
  { meta: true, key: "V" },
  { meta: true, key: "X" },
  { meta: true, key: "A" },
  { meta: true, key: "P" },
  { meta: true, key: "R" },
  { meta: true, key: "T" },
  { meta: true, key: "W" },
  { meta: true, key: "N" },
  { meta: true, key: "S" },
  { meta: true, key: "F" },
  { meta: true, key: "H" },
  { meta: true, key: "G" },
  { meta: true, key: "D" },
  { meta: true, key: "E" },
  { meta: true, key: "O" },
  { meta: true, key: "K" },
  { meta: true, key: "L" },
];

const MODIFIER_BLOCKED_KEYS = new Set([
  "C",
  "V",
  "X",
  "A",
  "P",
  "F",
  "H",
  "R",
  "T",
  "W",
  "N",
  "U",
  "S",
  "I",
  "J",
  "K",
  "L",
  "G",
  "D",
  "E",
  "O",
  "B",
  "M",
  "Q",
  "Y",
  "Z",
]);

export function isAltTabAttempt(event) {
  const key = String(event.key || "");

  if (event.altKey && (key === "Tab" || key === "Escape")) {
    return true;
  }

  if (event.key === "Tab" && event.altKey) {
    return true;
  }

  return false;
}

export function isRestrictedShortcut(event) {
  if (isAltTabAttempt(event)) {
    return true;
  }

  const key = String(event.key || "").toUpperCase();

  if (event.ctrlKey || event.metaKey) {
    if (MODIFIER_BLOCKED_KEYS.has(key)) {
      return true;
    }
  }

  return RESTRICTED_SHORTCUTS.some((combo) => {
    if (combo.key.toUpperCase() !== key) return false;
    if (Boolean(combo.ctrl) !== (event.ctrlKey || event.metaKey)) return false;
    if (Boolean(combo.shift) !== event.shiftKey) return false;
    if (Boolean(combo.meta) && !event.metaKey) return false;
    if (Boolean(combo.alt) !== event.altKey) return false;
    return true;
  });
}

export function blockClipboardEvent(event) {
  event.preventDefault();
}

export async function enterAssessmentFullscreen() {
  const root = document.documentElement;
  if (!root.requestFullscreen) return false;

  try {
    await root.requestFullscreen();
    return true;
  } catch {
    return false;
  }
}

export async function exitAssessmentFullscreen() {
  if (!document.fullscreenElement) return;

  try {
    await document.exitFullscreen();
  } catch {
    // ignore
  }
}
