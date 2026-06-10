import { useCallback, useEffect, useRef, useState } from "react";

export const REALTIME_POLL_MS = 5000;

export default function useRealtimeFetch(fetchFn, deps = [], intervalMs = REALTIME_POLL_MS) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const fetchRef = useRef(fetchFn);
  fetchRef.current = fetchFn;

  const reload = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError("");
      const result = await fetchRef.current();
      setData(result);
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
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load data.");
      } finally {
        if (!cancelled && !silent) setLoading(false);
      }
    };

    run(false);
    const timer = setInterval(() => run(true), intervalMs);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, intervalMs]);

  return { data, setData, loading, error, setError, reload };
}

export function usePolling(loadFn, deps = [], intervalMs = REALTIME_POLL_MS) {
  const loadRef = useRef(loadFn);
  loadRef.current = loadFn;

  useEffect(() => {
    let cancelled = false;

    const run = async (silent) => {
      if (!cancelled) {
        await loadRef.current(silent);
      }
    };

    run(false);
    const timer = setInterval(() => run(true), intervalMs);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, intervalMs]);
}
