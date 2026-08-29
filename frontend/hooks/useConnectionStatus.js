import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "../utils/apiBase";

const DEFAULT_SILENT_PING_MS = 6000;
const DEFAULT_PING_TIMEOUT_MS = 2500;
const FAST_SILENT_PING_MS = 1500;
const FAST_PING_TIMEOUT_MS = 1500;
const UNSTABLE_FAIL_THRESHOLD = 2;
const ONLINE_GRACE_MS = 3000;
const RECOVERY_BURST_DELAYS_MS = [0, 250, 600, 1100, 1800, 2800];

function browserOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function inOnlineGracePeriod(untilMs) {
  return untilMs > 0 && Date.now() < untilMs;
}

/**
 * Tracks online / offline / unstable connection with silent health pings.
 * Does not block UI — banners only.
 *
 * @param {{ enabled?: boolean, fast?: boolean, pingIntervalMs?: number, pingTimeoutMs?: number }} [options]
 */
export default function useConnectionStatus({
  enabled = true,
  fast = false,
  pingIntervalMs,
  pingTimeoutMs,
} = {}) {
  const [status, setStatus] = useState(() =>
    browserOffline() ? "offline" : "online"
  );
  const failStreakRef = useRef(0);
  const mountedRef = useRef(true);
  const onlineGraceUntilRef = useRef(0);
  const burstTimerIdsRef = useRef([]);

  const intervalMs =
    pingIntervalMs ?? (fast ? FAST_SILENT_PING_MS : DEFAULT_SILENT_PING_MS);
  const timeoutMs =
    pingTimeoutMs ?? (fast ? FAST_PING_TIMEOUT_MS : DEFAULT_PING_TIMEOUT_MS);

  const applyStatus = useCallback((next) => {
    if (!mountedRef.current) return;
    setStatus((prev) => (prev === next ? prev : next));
  }, []);

  const clearRecoveryBurst = useCallback(() => {
    for (const timerId of burstTimerIdsRef.current) {
      window.clearTimeout(timerId);
    }
    burstTimerIdsRef.current = [];
  }, []);

  const silentPing = useCallback(async () => {
    if (!enabled) return;
    if (browserOffline()) {
      failStreakRef.current = 0;
      onlineGraceUntilRef.current = 0;
      applyStatus("offline");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${API_BASE}/health`, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("health_failed");
      failStreakRef.current = 0;
      onlineGraceUntilRef.current = 0;
      applyStatus("online");
    } catch {
      if (browserOffline()) {
        failStreakRef.current = 0;
        onlineGraceUntilRef.current = 0;
        applyStatus("offline");
        return;
      }

      failStreakRef.current += 1;

      if (
        inOnlineGracePeriod(onlineGraceUntilRef.current) ||
        failStreakRef.current < UNSTABLE_FAIL_THRESHOLD
      ) {
        applyStatus("online");
        return;
      }

      applyStatus("unstable");
    } finally {
      window.clearTimeout(timer);
    }
  }, [applyStatus, enabled, timeoutMs]);

  const scheduleRecoveryBurst = useCallback(() => {
    clearRecoveryBurst();
    for (const delay of RECOVERY_BURST_DELAYS_MS) {
      const timerId = window.setTimeout(() => {
        void silentPing();
      }, delay);
      burstTimerIdsRef.current.push(timerId);
    }
  }, [clearRecoveryBurst, silentPing]);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) return undefined;

    const onOnline = () => {
      failStreakRef.current = 0;
      onlineGraceUntilRef.current = Date.now() + ONLINE_GRACE_MS;
      applyStatus("online");
      scheduleRecoveryBurst();
    };
    const onOffline = () => {
      failStreakRef.current = 0;
      onlineGraceUntilRef.current = 0;
      clearRecoveryBurst();
      applyStatus("offline");
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    if (browserOffline()) {
      applyStatus("offline");
    } else {
      void silentPing();
    }

    const intervalId = window.setInterval(() => {
      void silentPing();
    }, intervalMs);

    return () => {
      mountedRef.current = false;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.clearInterval(intervalId);
      clearRecoveryBurst();
    };
  }, [
    applyStatus,
    clearRecoveryBurst,
    enabled,
    intervalMs,
    scheduleRecoveryBurst,
    silentPing,
  ]);

  return {
    status,
    isOffline: status === "offline",
    isUnstable: status === "unstable",
    isOnline: status === "online",
    refresh: silentPing,
  };
}
