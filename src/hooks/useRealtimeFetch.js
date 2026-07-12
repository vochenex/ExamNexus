import { useCallback, useEffect, useRef, useState } from "react";

export const REALTIME_POLL_MS = 5000;
export const REALTIME_POLL_HIDDEN_MS = 20000;

/**
 * Keep polls responsive while the tab is focused. Chrome heavily throttles
 * background-tab timers, which made the website look "not realtime" vs APK.
 */
function schedulePoll(callback, visibleMs, hiddenMs) {
  let timerId = null;
  let stopped = false;

  const clear = () => {
    if (timerId != null) {
      clearTimeout(timerId);
      timerId = null;
    }
  };

  const tick = async () => {
    if (stopped) return;
    try {
      await callback();
    } catch {
      // caller handles errors
    }
    if (stopped) return;
    const delay =
      typeof document !== "undefined" && document.visibilityState === "hidden"
        ? hiddenMs
        : visibleMs;
    timerId = window.setTimeout(tick, delay);
  };

  const onVisibility = () => {
    if (stopped) return;
    if (document.visibilityState === "visible") {
      clear();
      tick();
    }
  };

  tick();
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibility);
  }

  return () => {
    stopped = true;
    clear();
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onVisibility);
    }
  };
}

/**
 * Page/query loader with silent live refresh.
 *
 * - First mount → non-silent (skeleton OK while navigating in)
 * - Polls + later dependency changes → silent (no skeleton flash)
 * - Unmount (leave page) resets so the next visit shows skeleton again
 */
export default function useRealtimeFetch(
  fetchFn,
  deps = [],
  intervalMs = REALTIME_POLL_MS
) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const fetchRef = useRef(fetchFn);
  fetchRef.current = fetchFn;
  const hasPaintedRef = useRef(false);

  const reload = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError("");
      const result = await fetchRef.current();
      setData(result);
      hasPaintedRef.current = true;
      return result;
    } catch (err) {
      setError(err.message || "Failed to load data.");
      throw err;
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async (silent) => {
      try {
        if (!silent) setLoading(true);
        setError("");
        const result = await fetchRef.current();
        if (!cancelled) {
          setData(result);
          hasPaintedRef.current = true;
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load data.");
      } finally {
        if (!cancelled && !silent) setLoading(false);
      }
    };

    const silent = hasPaintedRef.current;
    run(silent);
    const stop = schedulePoll(() => run(true), intervalMs, REALTIME_POLL_HIDDEN_MS);

    return () => {
      cancelled = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, intervalMs]);

  useEffect(
    () => () => {
      hasPaintedRef.current = false;
    },
    []
  );

  return { data, setData, loading, error, setError, reload };
}

/**
 * Call `loadFn(silent)` on an interval.
 * First paint of a page visit is non-silent; everything after is silent
 * so live updates never remount the page skeleton.
 */
export function usePolling(loadFn, deps = [], intervalMs = REALTIME_POLL_MS) {
  const loadRef = useRef(loadFn);
  loadRef.current = loadFn;
  const hasPaintedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const run = async (silent) => {
      if (cancelled) return;
      await loadRef.current(silent);
      if (!cancelled) hasPaintedRef.current = true;
    };

    const silent = hasPaintedRef.current;
    run(silent);
    const stop = schedulePoll(() => run(true), intervalMs, REALTIME_POLL_HIDDEN_MS);

    return () => {
      cancelled = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, intervalMs]);

  useEffect(
    () => () => {
      hasPaintedRef.current = false;
    },
    []
  );
}
