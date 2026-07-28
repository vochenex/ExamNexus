import { useEffect } from "react";
import { createPortal } from "react-dom";

/** Ref-counted body scroll lock so overlapping modals cannot leave the page frozen. */
let scrollLockCount = 0;
let previousBodyOverflow = "";
let previousHtmlOverflow = "";

function acquireScrollLock() {
  if (scrollLockCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
  }
  scrollLockCount += 1;
}

/** Emergency unlock — call on route changes if a modal unmounted uncleanly. */
export function forceUnlockBodyScroll() {
  scrollLockCount = 0;
  previousBodyOverflow = "";
  previousHtmlOverflow = "";
  document.body.style.overflow = "";
  document.documentElement.style.overflow = "";
}

function releaseScrollLock() {
  if (scrollLockCount <= 0) {
    scrollLockCount = 0;
    return;
  }
  scrollLockCount -= 1;
  if (scrollLockCount === 0) {
    document.body.style.overflow = previousBodyOverflow;
    document.documentElement.style.overflow = previousHtmlOverflow;
    previousBodyOverflow = "";
    previousHtmlOverflow = "";
  }
}

export default function ModalPortal({ children, lockScroll = true }) {
  useEffect(() => {
    if (!lockScroll) return undefined;
    acquireScrollLock();
    return () => releaseScrollLock();
  }, [lockScroll]);

  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
