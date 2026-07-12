import { useState } from "react";
import { Check, Copy, Share, SquarePlus, ExternalLink } from "lucide-react";
import { isIOSSafari } from "../../utils/pwa";

const SITE_URL = "https://exam-nexus-eta.vercel.app";

/**
 * Bottom sheet with Safari Add to Home Screen steps for iPhone / iPad.
 * Chrome on iOS cannot show that menu — we detect and redirect users to Safari.
 */
export default function IosInstallSheet({ open, onClose, isDark }) {
  const [copied, setCopied] = useState(false);
  if (!open) return null;

  const inSafari = isIOSSafari();

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(SITE_URL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link and open it in Safari:", SITE_URL);
    }
  };

  return (
    <div className="en-install-sheet-root" role="dialog" aria-modal="true">
      <div className="en-install-overlay" onClick={onClose} aria-hidden="true" />
      <div
        className={`en-install-sheet ${isDark ? "en-install-sheet--dark" : "en-install-sheet--light"}`}
      >
        <div className="en-install-sheet-handle" aria-hidden="true" />
        <h3 className="en-install-sheet-title">Add to Home Screen</h3>

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

        <button type="button" onClick={onClose} className="en-install-sheet-done">
          Got it
        </button>
      </div>
    </div>
  );
}
