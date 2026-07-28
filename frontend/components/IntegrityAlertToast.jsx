import { AlertTriangle, X } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";

export default function IntegrityAlertToast({ message, onDismiss }) {
  const { theme } = useTheme();

  if (!message) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-[90] w-[min(92vw,520px)] -translate-x-1/2">
      <div
        className={`flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-xl ${
          theme === "dark"
            ? "border-red-500/30 bg-[#1a0f0f] text-red-100"
            : "border-red-300/80 en-bg-elevated text-red-900"
        }`}
      >
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-500" />
        <p className="flex-1 text-sm leading-relaxed">{message}</p>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg p-1 opacity-70 transition hover:opacity-100"
          aria-label="Dismiss alert"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
