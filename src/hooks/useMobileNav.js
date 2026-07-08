import { useEffect, useState } from "react";
import { isNativeApp } from "../utils/platform";

const MOBILE_QUERY = "(max-width: 1023px)";

/**
 * True when the bottom tab bar should replace the desktop sidebar/header:
 * always in the native app, and on small screens (<1024px) on the web.
 */
export default function useMobileNav() {
  const native = isNativeApp();

  const [isMobile, setIsMobile] = useState(() => {
    if (native) return true;
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(MOBILE_QUERY).matches;
  });

  useEffect(() => {
    if (native) {
      setIsMobile(true);
      return undefined;
    }
    if (typeof window === "undefined" || !window.matchMedia) return undefined;

    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = (event) => setIsMobile(event.matches);
    setIsMobile(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [native]);

  return native || isMobile;
}
