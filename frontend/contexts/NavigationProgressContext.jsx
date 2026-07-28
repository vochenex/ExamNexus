import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router-dom";

const NavigationProgressContext = createContext({
  isNavigating: false,
  beginNavigation: () => true,
  endNavigation: () => {},
});

const MAX_PENDING_MS = 12000;
const MIN_VISIBLE_MS = 180;

function toPathname(to) {
  if (to == null) return "";
  if (typeof to === "number") return `__history_${to}`;
  if (typeof to === "string") {
    const withoutQuery = to.split("?")[0] || "";
    const pathname = withoutQuery.split("#")[0] || "";
    return pathname || "/";
  }
  if (typeof to === "object") {
    return String(to.pathname || "/");
  }
  return "";
}

function isHashOnlyNav(to, currentPathname) {
  if (typeof to !== "string") return false;
  if (to.startsWith("#")) return true;
  const pathname = toPathname(to);
  return pathname === currentPathname && to.includes("#");
}

export function NavigationProgressProvider({ children }) {
  const location = useLocation();
  const [isNavigating, setIsNavigating] = useState(false);
  const startedAtRef = useRef(0);
  const clearTimerRef = useRef(null);
  const maxTimerRef = useRef(null);
  const pendingPathRef = useRef(null);

  const clearTimers = useCallback(() => {
    if (clearTimerRef.current) {
      window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
    if (maxTimerRef.current) {
      window.clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
  }, []);

  const endNavigation = useCallback(() => {
    clearTimers();
    const elapsed = Date.now() - startedAtRef.current;
    const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
    clearTimerRef.current = window.setTimeout(() => {
      setIsNavigating(false);
      pendingPathRef.current = null;
      clearTimerRef.current = null;
    }, wait);
  }, [clearTimers]);

  const beginNavigation = useCallback(
    (to) => {
      if (isHashOnlyNav(to, location.pathname)) {
        return true;
      }

      const nextPath = toPathname(to);
      if (nextPath && nextPath === location.pathname) {
        return true;
      }

      if (isNavigating) {
        return false;
      }

      clearTimers();
      startedAtRef.current = Date.now();
      pendingPathRef.current = nextPath || null;
      setIsNavigating(true);

      maxTimerRef.current = window.setTimeout(() => {
        setIsNavigating(false);
        pendingPathRef.current = null;
        maxTimerRef.current = null;
      }, MAX_PENDING_MS);

      return true;
    },
    [clearTimers, isNavigating, location.pathname]
  );

  useEffect(() => {
    if (!isNavigating) return;
    endNavigation();
  }, [location.pathname, location.search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearTimers(), [clearTimers]);

  useEffect(() => {
    if (!isNavigating) return undefined;
    const previous = document.body.style.cursor;
    document.body.style.cursor = "wait";
    document.documentElement.classList.add("en-nav-pending");
    return () => {
      document.body.style.cursor = previous;
      document.documentElement.classList.remove("en-nav-pending");
    };
  }, [isNavigating]);

  const value = useMemo(
    () => ({
      isNavigating,
      beginNavigation,
      endNavigation,
    }),
    [isNavigating, beginNavigation, endNavigation]
  );

  return (
    <NavigationProgressContext.Provider value={value}>
      {children}
    </NavigationProgressContext.Provider>
  );
}

export function useNavigationProgress() {
  return useContext(NavigationProgressContext);
}
