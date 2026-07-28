import { AlertTriangle } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import { primaryButton } from "../../utils/themeButtons";
import { useModalDismiss } from "../../hooks/useModalDismiss";
import ModalPortal from "../ui/ModalPortal";

export default function PendingApprovalModal({ notice, onClose }) {
  const { theme } = useTheme();
  useModalDismiss(onClose, { enabled: Boolean(notice) });

  if (!notice) return null;

  return (
    <ModalPortal>
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center p-4"
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pending-approval-title"
        onClick={(event) => event.stopPropagation()}
        className={`relative z-10 w-full max-w-md rounded-2xl border p-6 shadow-2xl ${
          theme === "dark"
            ? "border-amber-500/30 bg-[#0a1f1f] text-white"
            : "border-amber-200 en-bg-elevated text-gray-900"
        }`}
      >
        <div className="flex items-start gap-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              theme === "dark"
                ? "bg-amber-500/15 text-amber-300"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            <AlertTriangle size={22} />
          </div>
          <div className="min-w-0">
            <h2
              id="pending-approval-title"
              className={`text-lg font-bold ${
                theme === "dark" ? "text-amber-200" : "text-amber-900"
              }`}
            >
              {notice.title}
            </h2>
            <p
              className={`mt-2 text-sm leading-relaxed ${
                theme === "dark" ? "text-gray-300" : "text-gray-600"
              }`}
            >
              {notice.message}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className={`${primaryButton(theme)} mt-6 w-full`}
        >
          {notice.confirmLabel || "OK"}
        </button>
      </div>
    </div>
    </ModalPortal>
  );
}
