import { useState } from "react";
import { Check, Copy, Share, SquarePlus, ExternalLink, Bell } from "lucide-react";
import { isIOSSafari, isStandalonePWA } from "../../utils/pwa";
import { initWebPushNotifications, canUseWebPush } from "../../utils/pushNotifications";
import { useModalDismiss } from "../../hooks/useModalDismiss";
import ModalPortal from "../ui/ModalPortal";
import { motion } from "../../utils/motion";

const SITE_URL = "https://exam-nexus-eta.vercel.app";

function Step({ icon, children }) {
  return (
    <li className="en-install-step">
      <span className="en-install-step-icon" aria-hidden="true">
        {icon}
      </span>
      <p className="en-install-step-text">{children}</p>
    </li>
  );
}

/**
 * Centered install help for iPhone / iPad (Safari Add to Home Screen).
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
              className={`en-install-warning ${
                isDark
                  ? "border-amber-400/30 bg-amber-500/10 text-amber-100"
                  : "border-amber-200 bg-amber-50 text-amber-900"
              }`}
            >
              <p>
                You’re not in Safari. Chrome and other iPhone browsers don’t show{" "}
                <strong>Add to Home Screen</strong>.
              </p>
              <p className="mt-1.5">
                Open this site in <strong>Safari</strong> first, then use Share.
              </p>
            </div>
          )}

          <p className="en-install-sheet-text">
            {inSafari
              ? "Use Safari’s Share button — not the ⋯ page menu."
              : "After you open ExamNexus in Safari:"}
          </p>

          <ol className="en-install-steps">
            {!inSafari && (
              <Step icon={<ExternalLink size={16} />}>
                Open the <strong>Safari</strong> app and go to ExamNexus (copy the
                link below).
              </Step>
            )}
            <Step icon={<Share size={16} />}>
              Tap <strong>Share</strong>
              {inSafari ? " at the bottom of Safari" : " in Safari’s toolbar"} (box
              with an upward arrow).
            </Step>
            <Step icon={<SquarePlus size={16} />}>
              Scroll and tap <strong>Add to Home Screen</strong>, then tap{" "}
              <strong>Add</strong>.
            </Step>
            <Step icon={<Bell size={16} />}>
              Open the Home Screen app and allow <strong>Notifications</strong> for
              announcement alerts.
            </Step>
          </ol>

          {!inSafari && (
            <button
              type="button"
              onClick={copyLink}
              className={`en-install-secondary ${
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
              className={`en-install-secondary disabled:opacity-60 ${
                isDark
                  ? "border-sky-400/30 bg-sky-500/15 text-sky-100"
                  : "border-sky-200 bg-sky-50 text-sky-900"
              }`}
            >
              <Bell size={16} />
              {pushBusy ? "Enabling…" : "Enable announcement alerts"}
            </button>
          )}

          {pushNote ? (
            <p
              className={`mb-2 text-center text-xs leading-snug ${
                isDark ? "text-emerald-200/90" : "text-teal-800"
              }`}
            >
              {pushNote}
            </p>
          ) : null}

          <button type="button" onClick={handleDone} className="en-install-sheet-done">
            Got it
          </button>
        </div>
      </div>
    </ModalPortal>
  );
}
