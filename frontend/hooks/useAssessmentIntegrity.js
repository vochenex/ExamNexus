import { useCallback, useEffect, useRef } from "react";
import {
  enterAssessmentFullscreen,
  exitAssessmentFullscreen,
  getExamTabLockKey,
  getIntegrityEventMessage,
  INTEGRITY_EVENT_TYPES,
  isAltTabAttempt,
  isRestrictedShortcut,
  isStrikeWorthyEvent,
  loadIntegrityStrikes,
  MAX_INTEGRITY_STRIKES,
  saveIntegrityStrikes,
} from "../utils/examIntegrity";
import { logExamIntegrityEvent } from "../utils/supabaseData";

const LOG_DEBOUNCE_MS = 5000;
const STRIKE_DEBOUNCE_MS = 1500;
const STARTUP_GRACE_MS = 3500;
const RETURN_GRACE_MS = 2500;
const EXTERNAL_APP_CHECK_MS = 700;

export default function useAssessmentIntegrity({
  examId,
  active,
  isRetakeAttempt = false,
  onAlert,
  onFocusViolation,
  onStrikeChange,
  onAutoSubmit,
  suppressAlerts = false,
}) {
  const lastLoggedRef = useRef({});
  const lastStrikeAtRef = useRef(0);
  const autoSubmitTriggeredRef = useRef(false);
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
    async (eventType, description, metadata = {}, options = {}) => {
      const { silentAlert = false, ignoreGrace = false } = options;
      if (!ignoreGrace && shouldIgnoreEvent()) {
        return;
      }

      const now = Date.now();
      const last = lastLoggedRef.current[eventType] || 0;
      if (now - last < LOG_DEBOUNCE_MS) {
        return;
      }
      lastLoggedRef.current[eventType] = now;

      const message = description || getIntegrityEventMessage(eventType);
      if (!silentAlert) {
        onAlert?.(message);
      }

      try {
        await logExamIntegrityEvent({
          examId,
          eventType,
          description: message,
          metadata: {
            ...metadata,
            attempt: isRetakeAttempt ? "retake" : "initial",
          },
        });
      } catch (error) {
        console.error("Failed to log integrity event:", error);
      }
    },
    [examId, isRetakeAttempt, onAlert, shouldIgnoreEvent]
  );

  const recordStrike = useCallback(
    (eventType, options = {}) => {
      const { ignoreGrace = false } = options;
      if (!isStrikeWorthyEvent(eventType) || (!ignoreGrace && shouldIgnoreEvent())) {
        return;
      }

      const now = Date.now();
      if (now - lastStrikeAtRef.current < STRIKE_DEBOUNCE_MS) {
        return;
      }
      lastStrikeAtRef.current = now;

      const next = Math.min(MAX_INTEGRITY_STRIKES, loadIntegrityStrikes(examId) + 1);
      saveIntegrityStrikes(examId, next);

      const remaining = Math.max(0, MAX_INTEGRITY_STRIKES - next);
      onStrikeChange?.({
        strikes: next,
        remaining,
        maxStrikes: MAX_INTEGRITY_STRIKES,
        eventType,
      });

      if (next >= MAX_INTEGRITY_STRIKES && !autoSubmitTriggeredRef.current) {
        autoSubmitTriggeredRef.current = true;
        onAutoSubmit?.(eventType);
      }
    },
    [examId, onAutoSubmit, onStrikeChange, shouldIgnoreEvent]
  );

  const flagFocusViolation = useCallback(
    (eventType, metadata = {}) => {
      if (shouldIgnoreEvent()) {
        return;
      }

      leftPageRef.current = true;
      onFocusViolation?.(true);
      recordStrike(eventType);
      recordEvent(eventType, undefined, metadata, {
        silentAlert: isStrikeWorthyEvent(eventType),
      });
    },
    [onFocusViolation, recordEvent, recordStrike, shouldIgnoreEvent]
  );

  useEffect(() => {
    if (!active || !examId) return;

    leftPageRef.current = false;
    autoSubmitTriggeredRef.current = false;
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
        // Multiple assessment tabs should always be recorded, even during grace.
        leftPageRef.current = true;
        onFocusViolation?.(true);
        recordStrike(INTEGRITY_EVENT_TYPES.MULTIPLE_TABS, { ignoreGrace: true });
        recordEvent(
          INTEGRITY_EVENT_TYPES.MULTIPLE_TABS,
          undefined,
          {},
          { silentAlert: true, ignoreGrace: true }
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
      const exited = !document.fullscreenElement;

      if (exited) {
        // Exiting fullscreen (via Escape or other means) should always be recorded.
        leftPageRef.current = true;
        onFocusViolation?.(true);
        recordStrike(INTEGRITY_EVENT_TYPES.FULLSCREEN_EXIT, { ignoreGrace: true });
        recordEvent(
          INTEGRITY_EVENT_TYPES.FULLSCREEN_EXIT,
          undefined,
          {},
          { silentAlert: true, ignoreGrace: true }
        );
      }

      // After handling the event, give a short grace window to avoid double-logging.
      extendGracePeriod(RETURN_GRACE_MS);
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
