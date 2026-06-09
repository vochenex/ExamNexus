import { useCallback, useEffect, useRef } from "react";
import {
  enterAssessmentFullscreen,
  exitAssessmentFullscreen,
  getExamTabLockKey,
  getIntegrityEventMessage,
  INTEGRITY_EVENT_TYPES,
  isAltTabAttempt,
  isRestrictedShortcut,
} from "../utils/examIntegrity";
import { logExamIntegrityEvent } from "../utils/supabaseData";

const LOG_DEBOUNCE_MS = 5000;
const STARTUP_GRACE_MS = 3500;
const RETURN_GRACE_MS = 2500;
const EXTERNAL_APP_CHECK_MS = 700;

export default function useAssessmentIntegrity({
  examId,
  active,
  onAlert,
  onFocusViolation,
  suppressAlerts = false,
}) {
  const lastLoggedRef = useRef({});
  const leftPageRef = useRef(false);
  const graceUntilRef = useRef(0);
  const externalAppTimerRef = useRef(null);
  const suppressAlertsRef = useRef(suppressAlerts);

  suppressAlertsRef.current = suppressAlerts;

  const isInGracePeriod = useCallback(() => Date.now() < graceUntilRef.current, []);

  const extendGracePeriod = useCallback((ms) => {
    graceUntilRef.current = Date.now() + ms;
  }, []);

  const shouldIgnoreEvent = useCallback(() => {
    return suppressAlertsRef.current || isInGracePeriod();
  }, [isInGracePeriod]);

  const recordEvent = useCallback(
    async (eventType, description, metadata = {}) => {
      if (shouldIgnoreEvent()) {
        return;
      }

      const now = Date.now();
      const last = lastLoggedRef.current[eventType] || 0;
      if (now - last < LOG_DEBOUNCE_MS) {
        return;
      }
      lastLoggedRef.current[eventType] = now;

      const message = description || getIntegrityEventMessage(eventType);
      onAlert?.(message);

      try {
        await logExamIntegrityEvent({
          examId,
          eventType,
          description: message,
          metadata,
        });
      } catch (error) {
        console.error("Failed to log integrity event:", error);
      }
    },
    [examId, onAlert, shouldIgnoreEvent]
  );

  const flagFocusViolation = useCallback(
    (eventType, metadata = {}) => {
      if (shouldIgnoreEvent()) {
        return;
      }

      leftPageRef.current = true;
      onFocusViolation?.(true);
      recordEvent(eventType, undefined, metadata);
    },
    [onFocusViolation, recordEvent, shouldIgnoreEvent]
  );

  useEffect(() => {
    if (!active || !examId) return;

    leftPageRef.current = false;
    extendGracePeriod(STARTUP_GRACE_MS);
    enterAssessmentFullscreen();

    const trapHistory = () => {
      window.history.pushState(null, "", window.location.href);
    };

    window.history.pushState(null, "", window.location.href);

    const tabLockKey = getExamTabLockKey(examId);
    const tabId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(tabLockKey, tabId);

    const handleStorage = (event) => {
      if (event.key === tabLockKey && event.newValue && event.newValue !== tabId) {
        recordEvent(
          INTEGRITY_EVENT_TYPES.MULTIPLE_TABS,
          getIntegrityEventMessage(INTEGRITY_EVENT_TYPES.MULTIPLE_TABS)
        );
      }
    };

    const handleVisibility = () => {
      if (shouldIgnoreEvent()) return;

      if (document.hidden) {
        flagFocusViolation(INTEGRITY_EVENT_TYPES.TAB_HIDDEN);
        return;
      }

      if (leftPageRef.current && document.hasFocus()) {
        onFocusViolation?.(true);
      }
    };

    const scheduleExternalAppCheck = () => {
      if (shouldIgnoreEvent()) return;

      clearTimeout(externalAppTimerRef.current);
      externalAppTimerRef.current = setTimeout(() => {
        if (shouldIgnoreEvent()) return;
        if (document.hidden) return;
        if (!document.hasFocus()) {
          flagFocusViolation(INTEGRITY_EVENT_TYPES.EXTERNAL_APP_OVERLAY);
        }
      }, EXTERNAL_APP_CHECK_MS);
    };

    const handleBlur = () => {
      scheduleExternalAppCheck();
    };

    const handleFocus = () => {
      clearTimeout(externalAppTimerRef.current);

      if (leftPageRef.current && !shouldIgnoreEvent()) {
        onFocusViolation?.(true);
      }
    };

    const handleFullscreenChange = () => {
      extendGracePeriod(RETURN_GRACE_MS);

      if (!document.fullscreenElement && !shouldIgnoreEvent()) {
        flagFocusViolation(INTEGRITY_EVENT_TYPES.FULLSCREEN_EXIT);
      }
    };

    const handleCopy = (event) => {
      event.preventDefault();
      recordEvent(
        INTEGRITY_EVENT_TYPES.COPY_ATTEMPT,
        getIntegrityEventMessage(INTEGRITY_EVENT_TYPES.COPY_ATTEMPT)
      );
    };

    const handlePaste = (event) => {
      event.preventDefault();
      recordEvent(
        INTEGRITY_EVENT_TYPES.PASTE_ATTEMPT,
        getIntegrityEventMessage(INTEGRITY_EVENT_TYPES.PASTE_ATTEMPT)
      );
    };

    const handleCut = (event) => {
      event.preventDefault();
      recordEvent(
        INTEGRITY_EVENT_TYPES.CUT_ATTEMPT,
        getIntegrityEventMessage(INTEGRITY_EVENT_TYPES.CUT_ATTEMPT)
      );
    };

    const handleContextMenu = (event) => {
      event.preventDefault();
      recordEvent(
        INTEGRITY_EVENT_TYPES.CONTEXT_MENU,
        getIntegrityEventMessage(INTEGRITY_EVENT_TYPES.CONTEXT_MENU)
      );
    };

    const handleDragStart = (event) => {
      event.preventDefault();
    };

    const handleBeforeInput = (event) => {
      if (event.inputType === "insertFromPaste" || event.inputType === "insertFromDrop") {
        event.preventDefault();
        recordEvent(
          INTEGRITY_EVENT_TYPES.PASTE_ATTEMPT,
          getIntegrityEventMessage(INTEGRITY_EVENT_TYPES.PASTE_ATTEMPT)
        );
      }
    };

    const handleKeyDown = (event) => {
      if (isAltTabAttempt(event)) {
        event.preventDefault();
        event.stopPropagation();
        flagFocusViolation(INTEGRITY_EVENT_TYPES.ALT_TAB_ATTEMPT, {
          key: event.key,
        });
        return;
      }

      if (isRestrictedShortcut(event)) {
        event.preventDefault();
        recordEvent(
          INTEGRITY_EVENT_TYPES.DEVTOOLS_SHORTCUT,
          getIntegrityEventMessage(INTEGRITY_EVENT_TYPES.DEVTOOLS_SHORTCUT),
          { key: event.key }
        );
      }
    };

    const handleBeforeUnload = (event) => {
      recordEvent(
        INTEGRITY_EVENT_TYPES.NAVIGATION_ATTEMPT,
        getIntegrityEventMessage(INTEGRITY_EVENT_TYPES.NAVIGATION_ATTEMPT),
        { trigger: "beforeunload" }
      );
      event.preventDefault();
      event.returnValue = "";
    };

    const handlePopState = () => {
      trapHistory();
      recordEvent(
        INTEGRITY_EVENT_TYPES.NAVIGATION_ATTEMPT,
        getIntegrityEventMessage(INTEGRITY_EVENT_TYPES.NAVIGATION_ATTEMPT),
        { trigger: "popstate" }
      );
    };

    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("copy", handleCopy, true);
    document.addEventListener("paste", handlePaste, true);
    document.addEventListener("cut", handleCut, true);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("dragstart", handleDragStart, true);
    document.addEventListener("beforeinput", handleBeforeInput, true);
    document.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);

    return () => {
      clearTimeout(externalAppTimerRef.current);
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("copy", handleCopy, true);
      document.removeEventListener("paste", handlePaste, true);
      document.removeEventListener("cut", handleCut, true);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("dragstart", handleDragStart, true);
      document.removeEventListener("beforeinput", handleBeforeInput, true);
      document.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);

      exitAssessmentFullscreen();

      if (sessionStorage.getItem(tabLockKey) === tabId) {
        sessionStorage.removeItem(tabLockKey);
      }
    };
  }, [
    active,
    examId,
    extendGracePeriod,
    flagFocusViolation,
    onFocusViolation,
    recordEvent,
    shouldIgnoreEvent,
  ]);

  const clearFocusViolation = useCallback(async () => {
    leftPageRef.current = false;
    onFocusViolation?.(false);
    extendGracePeriod(RETURN_GRACE_MS);
    await enterAssessmentFullscreen();
  }, [extendGracePeriod, onFocusViolation]);

  return { recordEvent, clearFocusViolation };
};
