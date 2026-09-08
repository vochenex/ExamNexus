import { useEffect } from "react";
import { createPortal } from "react-dom";

/** Ref-counted body scroll lock so overlapping modals cannot leave the page frozen. */
let scrollLockCount = 0;
let previousBodyOverflow = "";
let previousHtmlOverflow = "";
let previousBodyPaddingRight = "";
let previousScrollLockOffset = "";

function getScrollbarWidth() {
  return Math.max(0, window.innerWidth - document.documentElement.clientWidth);
}

function acquireScrollLock() {
  if (scrollLockCount === 0) {
    const scrollbarWidth = getScrollbarWidth();
    const bodyPad =
      Number.parseFloat(window.getComputedStyle(document.body).paddingRight) || 0;

    previousBodyOverflow = document.body.style.overflow;
    previousHtmlOverflow = document.documentElement.style.overflow;
    previousBodyPaddingRight = document.body.style.paddingRight;
    previousScrollLockOffset = document.documentElement.style.getPropertyValue(
      "--en-scroll-lock-offset"
    );

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.documentElement.classList.add("en-scroll-locked");

    // Keep layout width stable when the classic scrollbar disappears, otherwise
    // the page (and absolute header controls like Install) jump sideways.
    if (scrollbarWidth > 0) {
      const pad = `${scrollbarWidth}px`;
      document.body.style.paddingRight = `${bodyPad + scrollbarWidth}px`;
      document.documentElement.style.setProperty("--en-scroll-lock-offset", pad);
    }
  }
  scrollLockCount += 1;
}

function clearScrollLockStyles() {
  document.body.style.overflow = previousBodyOverflow;
  document.documentElement.style.overflow = previousHtmlOverflow;
  document.body.style.paddingRight = previousBodyPaddingRight;
  if (previousScrollLockOffset) {
    document.documentElement.style.setProperty(
      "--en-scroll-lock-offset",
      previousScrollLockOffset
    );
  } else {
    document.documentElement.style.removeProperty("--en-scroll-lock-offset");
  }
  document.documentElement.classList.remove("en-scroll-locked");
  previousBodyOverflow = "";
  previousHtmlOverflow = "";
  previousBodyPaddingRight = "";
  previousScrollLockOffset = "";
}

/** Emergency unlock — call on route changes if a modal unmounted uncleanly. */
export function forceUnlockBodyScroll() {
  scrollLockCount = 0;
  previousBodyOverflow = "";
  previousHtmlOverflow = "";
  previousBodyPaddingRight = "";
  previousScrollLockOffset = "";
  document.body.style.overflow = "";
  document.documentElement.style.overflow = "";
  document.body.style.paddingRight = "";
  document.documentElement.style.removeProperty("--en-scroll-lock-offset");
  document.documentElement.classList.remove("en-scroll-locked");
}

function releaseScrollLock() {
  if (scrollLockCount <= 0) {
    scrollLockCount = 0;
    return;
  }
  scrollLockCount -= 1;
  if (scrollLockCount === 0) {
    clearScrollLockStyles();
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
