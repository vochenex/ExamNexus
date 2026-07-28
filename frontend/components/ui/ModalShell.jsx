import ModalPortal from "./ModalPortal";
import { useModalDismiss } from "../../hooks/useModalDismiss";

export default function ModalShell({
  open,
  onClose,
  children,
  dismissible = true,
  closeOnEscape = true,
  zIndexClass = "z-[100]",
  overlayClassName = "bg-black/70 backdrop-blur-sm",
  containerClassName = "flex items-center justify-center p-4",
  lockScroll = true,
}) {
  useModalDismiss(dismissible ? onClose : undefined, {
    enabled: open && dismissible,
    closeOnEscape,
  });

  if (!open) return null;

  return (
    <ModalPortal lockScroll={lockScroll}>
      <div
        className={`fixed inset-0 ${zIndexClass} ${containerClassName}`}
        role="presentation"
      >
        <div
          className={`absolute inset-0 ${overlayClassName}`}
          onClick={dismissible ? onClose : undefined}
          aria-hidden="true"
        />
        {children}
      </div>
    </ModalPortal>
  );
}
