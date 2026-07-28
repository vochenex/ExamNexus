import { useLayoutEffect } from "react";
import { useAppSplash } from "../contexts/AppSplashContext";

/** Keeps the global logo splash visible while async work runs (e.g. auth guards). */
export default function useBlockingAppSplash(active) {
  const { registerBlockingLoad } = useAppSplash();

  useLayoutEffect(() => {
    if (!active) return undefined;
    return registerBlockingLoad();
  }, [active, registerBlockingLoad]);
}
