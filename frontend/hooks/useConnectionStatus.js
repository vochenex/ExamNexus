import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "../utils/apiBase";

const DEFAULT_SILENT_PING_MS = 12000;
const DEFAULT_PING_TIMEOUT_MS = 4000;
const FAST_SILENT_PING_MS = 2000;
const FAST_PING_TIMEOUT_MS = 2000;

function browserOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
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

  const intervalMs =
    pingIntervalMs ?? (fast ? FAST_SILENT_PING_MS : DEFAULT_SILENT_PING_MS);
  const timeoutMs =
    pingTimeoutMs ?? (fast ? FAST_PING_TIMEOUT_MS : DEFAULT_PING_TIMEOUT_MS);

  const applyStatus = useCallback((next) => {
    if (!mountedRef.current) return;
    setStatus((prev) => (prev === next ? prev : next));
  }, []);

  const silentPing = useCallback(async () => {
    if (!enabled) return;
    if (browserOffline()) {
      failStreakRef.current = 0;
      applyStatus("offline");
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${API_BASE}/health`, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("health_failed");
      failStreakRef.current = 0;
      applyStatus("online");
    } catch {
      if (browserOffline()) {
        failStreakRef.current = 0;
        applyStatus("offline");
        return;
      }
      failStreakRef.current += 1;
      // One failed ping while browser says online → unstable; keep probing.
      applyStatus(failStreakRef.current >= 1 ? "unstable" : "online");
    } finally {
      clearTimeout(timer);
    }
  }, [applyStatus, enabled, timeoutMs]);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) return undefined;

    const onOnline = () => {
      // Restore immediately so exam UI can dismiss recovery without waiting on a ping.
      failStreakRef.current = 0;
      applyStatus("online");
      void silentPing();
    };
    const onOffline = () => {
      failStreakRef.current = 0;
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
    };
  }, [applyStatus, enabled, intervalMs, silentPing]);

  return {
    status,
    isOffline: status === "offline",
    isUnstable: status === "unstable",
    isOnline: status === "online",
    refresh: silentPing,
  };
}
