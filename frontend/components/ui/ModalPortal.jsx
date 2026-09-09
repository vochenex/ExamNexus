import { useEffect } from "react";
import { createPortal } from "react-dom";
import { acquireScrollLock, releaseScrollLock } from "../../utils/bodyScrollLock";

export default function ModalPortal({ children, lockScroll = true }) {
  useEffect(() => {
    if (!lockScroll) return undefined;
    acquireScrollLock();
    return () => releaseScrollLock();
  }, [lockScroll]);

  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
