import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import ModalPortal from "./ModalPortal";

const TONE = {
  success: {
    Icon: CheckCircle2,
    dark: "border-emerald-400/35 bg-[#0c1816]/95 text-emerald-100",
    light: "border-teal-200 bg-white/95 text-teal-950",
    icon: "text-emerald-400",
    accent: "bg-emerald-500",
  },
  error: {
    Icon: AlertCircle,
    dark: "border-red-400/35 bg-[#1a1010]/95 text-red-100",
    light: "border-red-200 bg-white/95 text-red-950",
    icon: "text-red-400",
    accent: "bg-red-500",
  },
  warning: {
    Icon: AlertTriangle,
    dark: "border-amber-400/35 bg-[#1a160c]/95 text-amber-100",
    light: "border-amber-200 bg-white/95 text-amber-950",
    icon: "text-amber-500",
    accent: "bg-amber-500",
  },
  info: {
    Icon: Info,
    dark: "border-white/15 bg-[#0c1412]/95 text-gray-100",
    light: "border-emerald-100 bg-white/95 text-gray-900",
    icon: "text-emerald-400",
    accent: "bg-emerald-500",
  },
  danger: {
    Icon: AlertTriangle,
    dark: "border-red-400/35 bg-[#1a1010]/95 text-red-100",
    light: "border-red-200 bg-white/95 text-red-950",
    icon: "text-red-400",
    accent: "bg-red-500",
  },
};

/**
 * Compact top-right confirmation / notice banners (replaces most AppModal dialogs).
 */
export default function AppToastStack({ toasts, onDismiss, onConfirm, onAction }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  if (!toasts?.length) return null;

  return (
    <ModalPortal>
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[220] flex flex-col items-end gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const tone = TONE[toast.tone] || TONE.info;
          const Icon = tone.Icon;
          const isConfirm = toast.mode === "confirm";
          const isChoice =
            toast.mode === "choice" && Array.isArray(toast.actions) && toast.actions.length > 0;

          return (
            <div
              key={toast.id}
              className={`en-app-toast pointer-events-auto w-[min(100%,20rem)] overflow-hidden rounded-2xl border shadow-[0_12px_40px_rgba(0,0,0,0.28)] backdrop-blur-md ${
                toast.leaving ? "en-app-toast--out" : "en-app-toast--in"
              } ${isDark ? tone.dark : tone.light}`}
              role="status"
            >
              <div className={`h-1 w-full ${tone.accent} opacity-80`} />
              <div className="flex items-start gap-2.5 px-3 py-2.5">
                <span className={`mt-0.5 shrink-0 ${tone.icon}`}>
                  <Icon size={18} strokeWidth={2.25} />
                </span>
                <div className="min-w-0 flex-1">
                  {toast.title ? (
                    <p className="text-[13px] font-semibold leading-snug">{toast.title}</p>
                  ) : null}
                  {toast.message ? (
                    <p
                      className={`mt-0.5 text-[12px] leading-snug ${
                        isDark ? "text-white/70" : "text-gray-600"
                      }`}
                    >
                      {toast.message}
                    </p>
                  ) : null}

                  {isConfirm ? (
                    <div className="mt-2.5 flex justify-end gap-1.5">
                      <button
                        type="button"
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                          isDark
                            ? "text-white/60 hover:bg-white/10"
                            : "text-gray-500 hover:bg-gray-100"
                        }`}
                        onClick={() => onDismiss(toast.id, false)}
                      >
                        {toast.cancelLabel || "Cancel"}
                      </button>
                      <button
                        type="button"
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white transition ${
                          toast.tone === "danger" || toast.tone === "error"
                            ? "bg-red-600 hover:bg-red-700"
                            : "bg-emerald-600 hover:bg-emerald-700"
                        }`}
                        onClick={() => onConfirm(toast.id)}
                      >
                        {toast.confirmLabel || "Confirm"}
                      </button>
                    </div>
                  ) : null}

                  {isChoice ? (
                    <div className="mt-2.5 flex flex-col gap-1.5">
                      {toast.actions.map((action) => (
                        <button
                          key={action.id}
                          type="button"
                          className={`rounded-lg px-2.5 py-1.5 text-left text-[11px] font-semibold transition ${
                            action.variant === "secondary" || action.secondary
                              ? isDark
                                ? "bg-white/5 text-white/80 hover:bg-white/10"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                              : action.tone === "danger" || action.tone === "error"
                                ? "bg-red-600 text-white hover:bg-red-700"
                                : "bg-emerald-600 text-white hover:bg-emerald-700"
                          }`}
                          onClick={() => onAction(toast.id, action.id)}
                        >
                          {action.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                          isDark
                            ? "text-white/45 hover:bg-white/5"
                            : "text-gray-400 hover:bg-gray-50"
                        }`}
                        onClick={() => onDismiss(toast.id, "cancel")}
                      >
                        Not now
                      </button>
                    </div>
                  ) : null}
                </div>

                {!isConfirm && !isChoice ? (
                  <button
                    type="button"
                    className={`shrink-0 rounded-md p-1 transition ${
                      isDark
                        ? "text-white/40 hover:bg-white/10 hover:text-white"
                        : "text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                    }`}
                    aria-label="Dismiss"
                    onClick={() => onDismiss(toast.id, true)}
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </ModalPortal>
  );
}
