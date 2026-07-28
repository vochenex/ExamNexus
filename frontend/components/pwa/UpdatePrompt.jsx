import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import ExamNexusLogo from "../ExamNexusLogo";
import {
  applyServiceWorkerUpdate,
  subscribeServiceWorkerUpdate,
} from "../../utils/pwa";

/**
 * Modal that appears briefly while ExamNexus auto-activates a new deploy.
 * Desktop/installed PWA updates apply automatically via the service worker.
 */
export default function UpdatePrompt() {
  const { theme } = useTheme();
  const isDark = theme !== "light";

  const [visible, setVisible] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    return subscribeServiceWorkerUpdate(() => {
      setVisible(true);
      setUpdating(true);
      // Instant apply — do not leave the user staring at a spinner.
      applyServiceWorkerUpdate();
    });
  }, []);

  if (!visible) return null;

  const handleUpdate = () => {
    setUpdating(true);
    applyServiceWorkerUpdate();
  };

  return (
    <div className="en-update-root" role="dialog" aria-modal="true" aria-label="Updating ExamNexus">
      <div className="en-update-overlay" aria-hidden="true" />
      <div className={`en-update-card ${isDark ? "en-update-card--dark" : "en-update-card--light"}`}>
        <span className="en-update-badge">
          <ExamNexusLogo size={40} showGlow={false} idSuffix="update-prompt" />
        </span>

        <h3 className="en-update-title">Updating ExamNexus…</h3>
        <p className="en-update-text">
          Refreshing to the latest version now.
        </p>

        <div className="en-update-actions">
          <button
            type="button"
            className="en-update-cta"
            onClick={handleUpdate}
            disabled={updating}
          >
            <RefreshCw size={16} className={updating ? "en-update-spin" : ""} />
            {updating ? "Refreshing…" : "Reload now"}
          </button>
        </div>
      </div>
    </div>
  );
}
