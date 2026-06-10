import { useTheme } from "../../layouts/ThemeContext";
import { primaryButton, secondaryButton } from "../../utils/themeButtons";
import { motion } from "../../utils/motion";

export default function ActionDialog({
  open,
  title,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  loading = false,
  showCancel = true,
  tone = "default",
}) {
  const { theme } = useTheme();

  if (!open) return null;

  const toneStyles =
    tone === "danger"
      ? theme === "dark"
        ? "border-red-500/30 bg-[#0a1f1f]"
        : "border-red-300/80 en-bg-elevated"
      : tone === "success"
        ? theme === "dark"
          ? "border-emerald-500/30 bg-[#0a1f1f]"
          : "border-emerald-300/80 en-bg-elevated"
        : theme === "dark"
          ? "border-white/10 bg-[#0a1f1f]"
          : "border-emerald-200/80 en-bg-elevated";

  return (
    <div className={`fixed inset-0 z-[120] flex items-center justify-center p-4 ${motion.overlay}`}>
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm en-fade-in"
        onClick={showCancel && !loading ? onCancel : undefined}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-dialog-title"
        className={`${motion.scaleIn} relative z-10 w-full max-w-md rounded-2xl border p-6 shadow-2xl ${toneStyles}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="action-dialog-title"
          className={`text-lg font-bold ${
            tone === "danger"
              ? theme === "dark"
                ? "text-red-300"
                : "text-red-700"
              : tone === "success"
                ? theme === "dark"
                  ? "text-emerald-300"
                  : "text-teal-800"
                : theme === "dark"
                  ? "text-white"
                  : "text-gray-900"
          }`}
        >
          {title}
        </h2>

        <div
          className={`mt-3 text-sm leading-relaxed whitespace-pre-line ${
            theme === "dark" ? "text-gray-300" : "text-gray-700"
          }`}
        >
          {children}
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {showCancel && (
            <button
              type="button"
              disabled={loading}
              onClick={onCancel}
              className={secondaryButton(theme)}
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={
              tone === "danger"
                ? "rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                : primaryButton(theme, "disabled:opacity-60")
            }
          >
            {loading ? "Please wait..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
