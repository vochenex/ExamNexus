import { Outlet, useLocation } from "react-router-dom";
import { isPageRemoved, useDevOverrides } from "../dev/devOverrides";

function useRemovedPage() {
  const { pathname } = useLocation();
  useDevOverrides();
  return isPageRemoved(pathname);
}

/** Layout outlet that renders a blank slate for pages removed via the dev inspector. */
export default function DevPageOutlet() {
  const removed = useRemovedPage();
  return removed ? <div className="min-h-[60vh]" aria-hidden="true" /> : <Outlet />;
}

/** Same as DevPageOutlet for routes that have no layout (home, login). */
export function DevPageGate({ children }) {
  const removed = useRemovedPage();
  return removed ? <div className="min-h-screen" aria-hidden="true" /> : children;
}
