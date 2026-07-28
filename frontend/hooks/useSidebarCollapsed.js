import { useCallback, useState } from "react";

const STORAGE_KEY = "examnexus_sidebar_collapsed";

function readCollapsed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Desktop sidebar expand/collapse preference (ignored on mobile tab bar).
 */
export default function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore quota / private mode
      }
      return next;
    });
  }, []);

  const setSidebarCollapsed = useCallback((value) => {
    const next = Boolean(value);
    setCollapsed(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // ignore
    }
  }, []);

  return { collapsed, toggleCollapsed, setSidebarCollapsed };
}
