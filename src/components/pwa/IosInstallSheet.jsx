import { useState } from "react";
import { Check, Copy, Share, SquarePlus, ExternalLink, Bell } from "lucide-react";
import { isIOSSafari, isStandalonePWA } from "../../utils/pwa";
import { initWebPushNotifications, canUseWebPush } from "../../utils/pushNotifications";
import { useModalDismiss } from "../../hooks/useModalDismiss";
import ModalPortal from "../ui/ModalPortal";
import { motion } from "../../utils/motion";

const SITE_URL = "https://exam-nexus-eta.vercel.app";

/**
 * Centered install help for iPhone / iPad (Safari Add to Home Screen).
 * Chrome on iOS cannot show that menu — we detect and guide users to Safari.
 */
export default function IosInstallSheet({ open, onClose, isDark }) {
  const [copied, setCopied] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushNote, setPushNote] = useState("");
  useModalDismiss(onClose, { enabled: open });

  if (!open) return null;

  const inSafari = isIOSSafari();
  const standalone = isStandalonePWA();
  const showPushCta = standalone && canUseWebPush();

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(SITE_URL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link and open it in Safari:", SITE_URL);
    }
  };

  const enablePush = async () => {
    setPushBusy(true);
    setPushNote("");
    try {
      const ok = await initWebPushNotifications({ requestPermission: true });
      setPushNote(
        ok
          ? "Notifications enabled — you’ll get announcement alerts on this Home Screen app."
          : "Could not enable notifications. Check Settings → ExamNexus → Notifications."
      );
    } finally {
      setPushBusy(false);
    }
  };

  const handleDone = async () => {
    if (showPushCta && Notification.permission !== "granted") {
      await enablePush();
    }
    onClose();
  };

  return (
    <ModalPortal>
      <div
        className={`en-install-sheet-root fixed inset-0 z-[120] flex items-center justify-center p-4 ${motion.overlay}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ios-install-title"
      >
        <div className="en-install-overlay" onClick={onClose} aria-hidden="true" />
        <div
          className={`en-install-sheet ${
            isDark ? "en-install-sheet--dark" : "en-install-sheet--light"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <h3 id="ios-install-title" className="en-install-sheet-title">
            Install ExamNexus
          </h3>

          {!inSafari && (
            <div
              className={`mb-3 rounded-2xl border px-3 py-2.5 text-sm ${
                isDark
                  ? "border-amber-400/30 bg-amber-500/10 text-amber-100"
                  : "border-amber-200 bg-amber-50 text-amber-900"
              }`}
            >
              You are not in Safari right now (Chrome / another browser on iPhone
              does not show <strong>Add to Home Screen</strong>).
              <br />
              Open ExamNexus in <strong>Safari</strong> first, then use Share.
            </div>
          )}

          <p className="en-install-sheet-text">
            {inSafari
              ? "Use Safari’s Share menu — Add to Home Screen is not under the ⋯ page menu."
              : "After you open this site in Safari:"}
          </p>

          <ol className="en-install-steps">
            {!inSafari && (
              <li>
                <span className="en-install-step-icon">
                  <ExternalLink size={16} />
                </span>
                Open the <strong>Safari</strong> app and go to ExamNexus (copy the
                link below).
              </li>
            )}
            <li>
              <span className="en-install-step-icon">
                <Share size={16} />
              </span>
              Tap the <strong>Share</strong> button
              {inSafari ? " at the bottom of Safari" : " in Safari’s toolbar"} (box
              with an upward arrow).
            </li>
            <li>
              <span className="en-install-step-icon">
                <SquarePlus size={16} />
              </span>
              Scroll the share sheet and tap <strong>Add to Home Screen</strong>.
            </li>
            <li>
              <span className="en-install-step-num">✓</span>
              Tap <strong>Add</strong> — ExamNexus appears on your home screen like
              an app.
            </li>
            <li>
              <span className="en-install-step-icon">
                <Bell size={16} />
              </span>
              Open the Home Screen app and allow <strong>Notifications</strong> so
              you get announcement alerts (same as Android).
            </li>
          </ol>

          {!inSafari && (
            <button
              type="button"
              onClick={copyLink}
              className={`mb-3 flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold ${
                isDark
                  ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-200"
                  : "border-emerald-200 bg-emerald-50 text-teal-800"
              }`}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "Link copied" : "Copy Safari link"}
            </button>
          )}

          {showPushCta && (
            <button
              type="button"
              onClick={enablePush}
              disabled={pushBusy}
              className={`mb-3 flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold disabled:opacity-60 ${
                isDark
                  ? "border-sky-400/30 bg-sky-500/15 text-sky-100"
                  : "border-sky-200 bg-sky-50 text-sky-900"
              }`}
            >
              <Bell size={16} />
              {pushBusy ? "Enabling…" : "Enable announcement alerts"}
            </button>
          )}

          {pushNote && (
            <p
              className={`mb-2 text-center text-xs ${
                isDark ? "text-emerald-200/90" : "text-teal-800"
              }`}
            >
              {pushNote}
            </p>
          )}

          <button type="button" onClick={handleDone} className="en-install-sheet-done">
            Got it
          </button>
        </div>
      </div>
    </ModalPortal>
  );
}
