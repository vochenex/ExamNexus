import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useNavigationProgress } from "../contexts/NavigationProgressContext";

/**
 * useNavigate wrapper that starts the global progress indicator
 * and ignores overlapping navigations.
 */
export default function useProgressNavigate() {
  const navigate = useNavigate();
  const { isNavigating, beginNavigation } = useNavigationProgress();

  return useCallback(
    (to, options) => {
      if (isNavigating) return;
      if (typeof to === "number") {
        if (!beginNavigation("__history__")) return;
        navigate(to);
        return;
      }
      if (!beginNavigation(to)) return;
      navigate(to, options);
    },
    [beginNavigation, isNavigating, navigate]
  );
}
