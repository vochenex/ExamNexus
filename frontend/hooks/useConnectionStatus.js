import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "../utils/apiBase";

const SILENT_PING_MS = 12000;
const PING_TIMEOUT_MS = 4000;

function browserOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/**
 * Tracks online / offline / unstable connection with silent health pings.
 * Does not block UI — banners only.
 */
export default function useConnectionStatus({ enabled = true } = {}) {
  const [status, setStatus] = useState(() =>
    browserOffline() ? "offline" : "online"
  );
  const failStreakRef = useRef(0);
  const mountedRef = useRef(true);

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
    const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);

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
  }, [applyStatus, enabled]);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) return undefined;

    const onOnline = () => {
      applyStatus("unstable");
      silentPing();
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
      silentPing();
    }

    const intervalId = window.setInterval(silentPing, SILENT_PING_MS);

    return () => {
      mountedRef.current = false;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.clearInterval(intervalId);
    };
  }, [applyStatus, enabled, silentPing]);

  return {
    status,
    isOffline: status === "offline",
    isUnstable: status === "unstable",
    isOnline: status === "online",
    refresh: silentPing,
  };
}
