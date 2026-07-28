import { useEffect } from "react";

export function useModalDismiss(onClose, { enabled = true, closeOnEscape = true } = {}) {
  useEffect(() => {
    if (!enabled || !closeOnEscape || !onClose) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeOnEscape, enabled, onClose]);
}
