import { useEffect, useState } from "react";
import { isNativeApp, isMobileOrTabletDevice } from "../utils/platform";

const MOBILE_QUERY = "(max-width: 1023px)";

/**
 * True when the bottom tab bar should replace the desktop sidebar/header:
 * always in the native app, on small screens, and on phones/tablets/iPads
 * viewing the website (including large iPad landscape).
 */
export default function useMobileNav() {
  const native = isNativeApp();

  const [isMobile, setIsMobile] = useState(() => {
    if (native) return true;
    if (typeof window === "undefined") return false;
    return isMobileOrTabletDevice() || window.matchMedia?.(MOBILE_QUERY)?.matches;
  });

  useEffect(() => {
    if (native) {
      setIsMobile(true);
      return undefined;
    }
    if (typeof window === "undefined") return undefined;

    const sync = () => {
      setIsMobile(
        isMobileOrTabletDevice() || Boolean(window.matchMedia?.(MOBILE_QUERY)?.matches)
      );
    };

    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);

    const mql = window.matchMedia?.(MOBILE_QUERY);
    mql?.addEventListener?.("change", sync);

    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
      mql?.removeEventListener?.("change", sync);
    };
  }, [native]);

  return native || isMobile;
}
