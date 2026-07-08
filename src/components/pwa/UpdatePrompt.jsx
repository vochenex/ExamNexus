import { useEffect, useState } from "react";
import { RefreshCw, Sparkles, X } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import {
  applyServiceWorkerUpdate,
  subscribeServiceWorkerUpdate,
} from "../../utils/pwa";

/**
 * Modal that appears when a new version of ExamNexus has been deployed and is
 * ready to activate. "Update now" swaps to the fresh build and reloads.
 */
export default function UpdatePrompt() {
  const { theme } = useTheme();
  const isDark = theme !== "light";

  const [visible, setVisible] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    return subscribeServiceWorkerUpdate(() => setVisible(true));
  }, []);

  if (!visible) return null;

  const handleUpdate = () => {
    setUpdating(true);
    applyServiceWorkerUpdate();
  };

  return (
    <div className="en-update-root" role="dialog" aria-modal="true" aria-label="Update available">
      <div className="en-update-overlay" onClick={() => setVisible(false)} aria-hidden="true" />
      <div className={`en-update-card ${isDark ? "en-update-card--dark" : "en-update-card--light"}`}>
        <button
          type="button"
          className="en-update-dismiss"
          onClick={() => setVisible(false)}
          aria-label="Dismiss"
          disabled={updating}
        >
          <X size={18} />
        </button>

        <span className="en-update-badge">
          <Sparkles size={22} strokeWidth={2.2} />
        </span>

        <h3 className="en-update-title">A new version is available</h3>
        <p className="en-update-text">
          ExamNexus has been updated with the latest improvements. Update now to
          get the newest version.
        </p>

        <div className="en-update-actions">
          <button
            type="button"
            className="en-update-later"
            onClick={() => setVisible(false)}
            disabled={updating}
          >
            Later
          </button>
          <button
            type="button"
            className="en-update-cta"
            onClick={handleUpdate}
            disabled={updating}
          >
            <RefreshCw size={16} className={updating ? "en-update-spin" : ""} />
            {updating ? "Updating…" : "Update now"}
          </button>
        </div>
      </div>
    </div>
  );
}
