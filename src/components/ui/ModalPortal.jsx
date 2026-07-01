import { useEffect } from "react";
import { createPortal } from "react-dom";

export default function ModalPortal({ children, lockScroll = true }) {
  useEffect(() => {
    if (!lockScroll) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [lockScroll]);

  return createPortal(children, document.body);
}
