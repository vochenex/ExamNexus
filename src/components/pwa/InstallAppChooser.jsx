import { Monitor, Smartphone } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import { useModalDismiss } from "../../hooks/useModalDismiss";
import ModalPortal from "../ui/ModalPortal";
import { motion } from "../../utils/motion";

/** Public URL for the Android APK served from /public/downloads. */
export const ANDROID_APK_URL = "/downloads/ExamNexus-Android.apk";
export const ANDROID_APK_FILENAME = "ExamNexus-Android.apk";

/**
 * Choose desktop (PWA) install vs Android APK download.
 */
export default function InstallAppChooser({
  open,
  onClose,
  onDesktop,
  onAndroid,
  busy = false,
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  useModalDismiss(busy ? undefined : onClose, { enabled: open && !busy });

  if (!open) return null;

  const cardClass = isDark
    ? "border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-emerald-400/30"
    : "border-emerald-100 bg-white hover:border-teal-300 hover:bg-teal-50/60";

  return (
    <ModalPortal>
      <div
        className={`fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 ${motion.overlay}`}
      >
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm en-fade-in"
          onClick={busy ? undefined : onClose}
          aria-hidden="true"
        />

        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-chooser-title"
          className={`${motion.scaleIn} en-modal-panel relative z-10 mx-auto w-full max-w-[min(100%,26rem)] overflow-hidden rounded-3xl border p-4 shadow-2xl sm:p-6 ${
            isDark
              ? "border-white/10 bg-[#0a1f1f]"
              : "border-emerald-200/80 en-bg-elevated"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <h2
            id="install-chooser-title"
            className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}
          >
            Install ExamNexus
          </h2>
          <p
            className={`mt-2 text-sm leading-relaxed ${
              isDark ? "text-gray-300" : "text-gray-600"
            }`}
          >
            Choose desktop or Android so you get the right app for your device.
          </p>

          <div className="mt-5 grid gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={onDesktop}
              className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition disabled:opacity-60 ${cardClass}`}
            >
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                  isDark
                    ? "bg-sky-500/15 text-sky-300"
                    : "bg-sky-50 text-sky-700"
                }`}
                aria-hidden="true"
              >
                <Monitor size={26} strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-sm font-semibold ${
                    isDark ? "text-white" : "text-gray-900"
                  }`}
                >
                  Desktop / laptop
                </span>
                <span
                  className={`mt-0.5 block text-xs ${
                    isDark ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  Install the website as an app on this computer
                </span>
              </span>
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={onAndroid}
              className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition disabled:opacity-60 ${cardClass}`}
            >
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                  isDark
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-emerald-50 text-emerald-700"
                }`}
                aria-hidden="true"
              >
                <Smartphone size={26} strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-sm font-semibold ${
                    isDark ? "text-white" : "text-gray-900"
                  }`}
                >
                  Android phone
                </span>
                <span
                  className={`mt-0.5 block text-xs ${
                    isDark ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  Download the APK to install on your Android device
                </span>
              </span>
            </button>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className={`mt-4 w-full rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:opacity-60 ${
              isDark
                ? "text-gray-300 hover:bg-white/5"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            {busy ? "Please wait…" : "Not now"}
          </button>
        </div>
      </div>
    </ModalPortal>
  );
}
