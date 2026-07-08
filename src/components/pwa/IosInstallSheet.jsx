import { Share, SquarePlus } from "lucide-react";

/**
 * Bottom sheet with "Add to Home Screen" steps for iOS Safari,
 * which has no programmatic install prompt.
 */
export default function IosInstallSheet({ open, onClose, isDark }) {
  if (!open) return null;

  return (
    <div className="en-install-sheet-root" role="dialog" aria-modal="true">
      <div className="en-install-overlay" onClick={onClose} aria-hidden="true" />
      <div className={`en-install-sheet ${isDark ? "en-install-sheet--dark" : "en-install-sheet--light"}`}>
        <div className="en-install-sheet-handle" aria-hidden="true" />
        <h3 className="en-install-sheet-title">Install ExamNexus</h3>
        <p className="en-install-sheet-text">
          To add the app to your home screen on iPhone or iPad:
        </p>
        <ol className="en-install-steps">
          <li>
            <span className="en-install-step-icon"><Share size={16} /></span>
            Tap the <strong>Share</strong> button in Safari&apos;s toolbar.
          </li>
          <li>
            <span className="en-install-step-icon"><SquarePlus size={16} /></span>
            Choose <strong>Add to Home Screen</strong>.
          </li>
          <li>
            <span className="en-install-step-num">✓</span>
            Tap <strong>Add</strong> — ExamNexus will appear like a native app.
          </li>
        </ol>
        <button type="button" onClick={onClose} className="en-install-sheet-done">
          Got it
        </button>
      </div>
    </div>
  );
}
