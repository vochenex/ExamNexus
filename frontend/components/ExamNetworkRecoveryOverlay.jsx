import { Loader2, WifiOff } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";

/**
 * Full-screen recovery state during exams — auto-retry only, no manual actions.
 */
export default function ExamNetworkRecoveryOverlay({
  title = "Sorry — your internet was interrupted",
  message = "We're reconnecting automatically. Please stay on this page; your answers are safe on this device.",
  detail = "Retrying now…",
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 p-6 backdrop-blur-md"
      role="alertdialog"
      aria-modal="true"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className={`w-full max-w-md rounded-3xl border px-6 py-8 text-center shadow-2xl ${
          isDark
            ? "border-emerald-500/25 bg-[#061816]"
            : "border-emerald-200 bg-white"
        }`}
      >
        <div className="mx-auto mb-5 flex max-w-[16rem] flex-col items-center gap-3">
          <div
            className={`relative flex h-20 w-20 items-center justify-center rounded-full border-2 ${
              isDark
                ? "border-emerald-400/35 bg-emerald-500/10"
                : "border-emerald-300 bg-emerald-50"
            }`}
          >
            <span
              className={`text-3xl font-bold ${
                isDark ? "text-emerald-200" : "text-teal-800"
              }`}
              aria-hidden
            >
              EN
            </span>
            <span
              className={`absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border ${
                isDark
                  ? "border-orange-400/40 bg-orange-500/20 text-orange-200"
                  : "border-orange-300 bg-orange-50 text-orange-700"
              }`}
            >
              <WifiOff size={14} strokeWidth={2.25} />
            </span>
          </div>

          <div
            className={`rounded-2xl px-4 py-3 text-left text-sm leading-relaxed ${
              isDark
                ? "border border-white/10 bg-white/[0.04] text-gray-200"
                : "border border-emerald-100 bg-emerald-50/70 text-gray-800"
            }`}
          >
            <p className="font-semibold">{title}</p>
            <p className="mt-1.5 text-[0.92rem] opacity-90">{message}</p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <Loader2
            size={34}
            className={`animate-spin ${isDark ? "text-emerald-300" : "text-teal-600"}`}
            strokeWidth={2.25}
          />
          <p
            className={`text-sm font-medium ${
              isDark ? "text-emerald-200/90" : "text-teal-800"
            }`}
          >
            {detail}
          </p>
        </div>
      </div>
    </div>
  );
}
