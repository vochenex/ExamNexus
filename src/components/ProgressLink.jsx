import { forwardRef, useCallback } from "react";
import { Link, NavLink } from "react-router-dom";
import { useNavigationProgress } from "../contexts/NavigationProgressContext";

function mergeClickHandlers(userOnClick, guardOnClick) {
  return (event) => {
    const allowed = guardOnClick(event);
    if (allowed === false) return;
    if (typeof userOnClick === "function") {
      userOnClick(event);
    }
  };
}

/**
 * React Router Link that shows global nav progress and blocks double-clicks.
 */
export const ProgressLink = forwardRef(function ProgressLink(
  { to, onClick, replace, state, ...rest },
  ref
) {
  const { isNavigating, beginNavigation } = useNavigationProgress();

  const guard = useCallback(
    (event) => {
      if (event.defaultPrevented) return false;
      if (event.button !== 0) return true;
      if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return true;

      if (isNavigating) {
        event.preventDefault();
        return false;
      }

      if (!beginNavigation(to)) {
        event.preventDefault();
        return false;
      }

      return true;
    },
    [beginNavigation, isNavigating, to]
  );

  return (
    <Link
      ref={ref}
      to={to}
      replace={replace}
      state={state}
      aria-disabled={isNavigating || undefined}
      onClick={mergeClickHandlers(onClick, guard)}
      {...rest}
    />
  );
});

/**
 * React Router NavLink with the same progress / double-click protection.
 */
export const ProgressNavLink = forwardRef(function ProgressNavLink(
  { to, onClick, ...rest },
  ref
) {
  const { isNavigating, beginNavigation } = useNavigationProgress();

  const guard = useCallback(
    (event) => {
      if (event.defaultPrevented) return false;
      if (event.button !== 0) return true;
      if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return true;

      if (isNavigating) {
        event.preventDefault();
        return false;
      }

      if (!beginNavigation(to)) {
        event.preventDefault();
        return false;
      }

      return true;
    },
    [beginNavigation, isNavigating, to]
  );

  return (
    <NavLink
      ref={ref}
      to={to}
      aria-disabled={isNavigating || undefined}
      onClick={mergeClickHandlers(onClick, guard)}
      {...rest}
    />
  );
});
