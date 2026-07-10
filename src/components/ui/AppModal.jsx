import {
  AlertCircle,
  AlertTriangle,
  Info,
  X,
} from "lucide-react";
import { useEffect } from "react";
import { useTheme } from "../../layouts/ThemeContext";
import { primaryButton, secondaryButton } from "../../utils/themeButtons";
import { motion } from "../../utils/motion";
import ModalPortal from "./ModalPortal";
import { useModalDismiss } from "../../hooks/useModalDismiss";

import AnimatedSuccessCheck from "./AnimatedSuccessCheck";

const TONE_CONFIG = {
  success: {
    icon: null,
    titleClass: {
      dark: "text-emerald-300",
      light: "text-teal-800",
    },
    iconWrap: {
      dark: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/25",
      light: "bg-emerald-100 text-emerald-700 ring-emerald-200",
    },
    panel: {
      dark: "border-emerald-500/30 bg-[#0a1f1f]",
      light: "border-emerald-300/80 en-bg-elevated",
    },
  },
  error: {
    icon: AlertCircle,
    titleClass: {
      dark: "text-red-300",
      light: "text-red-700",
    },
    iconWrap: {
      dark: "bg-red-500/15 text-red-400 ring-red-500/25",
      light: "bg-red-100 text-red-700 ring-red-200",
    },
    panel: {
      dark: "border-red-500/30 bg-[#0a1f1f]",
      light: "border-red-300/80 en-bg-elevated",
    },
  },
  warning: {
    icon: AlertTriangle,
    titleClass: {
      dark: "text-amber-300",
      light: "text-amber-800",
    },
    iconWrap: {
      dark: "bg-amber-500/15 text-amber-400 ring-amber-500/25",
      light: "bg-amber-100 text-amber-800 ring-amber-200",
    },
    panel: {
      dark: "border-amber-500/30 bg-[#0a1f1f]",
      light: "border-amber-300/80 en-bg-elevated",
    },
  },
  info: {
    icon: Info,
    titleClass: {
      dark: "text-emerald-300",
      light: "text-teal-800",
    },
    iconWrap: {
      dark: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/25",
      light: "bg-emerald-100 text-teal-700 ring-emerald-200",
    },
    panel: {
      dark: "border-white/10 bg-[#0a1f1f]",
      light: "border-emerald-200/80 en-bg-elevated",
    },
  },
  default: {
    icon: Info,
    titleClass: {
      dark: "text-emerald-300",
      light: "text-teal-800",
    },
    iconWrap: {
      dark: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/25",
      light: "bg-emerald-100 text-teal-700 ring-emerald-200",
    },
    panel: {
      dark: "border-white/10 bg-[#0a1f1f]",
      light: "border-emerald-200/80 en-bg-elevated",
    },
  },
  danger: {
    icon: AlertTriangle,
    titleClass: {
      dark: "text-red-300",
      light: "text-red-700",
    },
    iconWrap: {
      dark: "bg-red-500/15 text-red-400 ring-red-500/25",
      light: "bg-red-100 text-red-700 ring-red-200",
    },
    panel: {
      dark: "border-red-500/30 bg-[#0a1f1f]",
      light: "border-red-300/80 en-bg-elevated",
    },
  },
};

export default function AppModal({
  open,
  mode = "alert",
  tone = "info",
  title,
  message,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  loading = false,
  showClose = true,
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const config = TONE_CONFIG[tone] || TONE_CONFIG.info;
  const Icon = config.icon;
  const isSuccessAlert = tone === "success" && mode === "alert";

  useModalDismiss(!loading && showClose && !isSuccessAlert ? onCancel : undefined, {
    enabled: open && !loading && showClose && !isSuccessAlert,
  });

  useEffect(() => {
    if (!open || !isSuccessAlert || loading) return undefined;

    const timer = window.setTimeout(() => {
      onConfirm?.();
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [open, isSuccessAlert, loading, onConfirm]);

  if (!open) return null;

  const isConfirm = mode === "confirm";

  return (
    <ModalPortal>
      <div
        className={`fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 ${motion.overlay}`}
        role="presentation"
      >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm en-fade-in"
        onClick={!loading ? onCancel : undefined}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-modal-title"
        className={`${motion.scaleIn} relative z-10 mx-auto max-h-[min(90dvh,40rem)] w-full max-w-[min(100%,28rem)] overflow-y-auto rounded-3xl border p-4 shadow-2xl sm:p-6 ${
          isDark ? config.panel.dark : config.panel.light
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {showClose && !loading && !isSuccessAlert && (
          <button
            type="button"
            onClick={onCancel}
            className={`absolute right-4 top-4 rounded-lg p-1.5 transition ${
              isDark
                ? "text-gray-400 hover:bg-white/10 hover:text-white"
                : "text-gray-500 en-hover hover:text-gray-800"
            }`}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        )}

        <div className={`flex flex-col items-center text-center ${isSuccessAlert ? "gap-4" : "items-start gap-4 pr-6 sm:flex-row sm:text-left"}`}>
          {isSuccessAlert ? (
            <AnimatedSuccessCheck size={80} />
          ) : Icon ? (
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${
                isDark ? config.iconWrap.dark : config.iconWrap.light
              }`}
            >
              <Icon size={22} strokeWidth={2.2} />
            </div>
          ) : null}

          <div className={`min-w-0 flex-1 ${isSuccessAlert ? "w-full" : ""}`}>
            <h2
              id="app-modal-title"
              className={`text-lg font-bold leading-snug ${
                isDark ? config.titleClass.dark : config.titleClass.light
              }`}
            >
              {title}
            </h2>

            {message ? (
              <p
                className={`mt-2 text-sm leading-relaxed whitespace-pre-line ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                {message}
              </p>
            ) : null}
          </div>
        </div>

        {!isSuccessAlert && (
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {isConfirm && (
            <button
              type="button"
              disabled={loading}
              onClick={onCancel}
              className={secondaryButton(theme, "disabled:opacity-60")}
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={
              tone === "danger" || tone === "error"
                ? "rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                : primaryButton(theme, "disabled:opacity-60")
            }
          >
            {loading ? "Please wait..." : confirmLabel}
          </button>
        </div>
        )}
      </div>
    </div>
    </ModalPortal>
  );
}
