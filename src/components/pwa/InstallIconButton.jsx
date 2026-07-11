import { useCallback, useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import { useInstallPrompt } from "../../hooks/useInstallPrompt";
import { useAppModal } from "../../contexts/AppModalContext";

const AUTO_OFFER_KEY = "examnexus_install_offer_seen";

/**
 * Header install button: confirm → browser install dialog.
 * Waits for Chrome's beforeinstallprompt after ensuring the service worker
 * is ready, instead of immediately showing a manual-instructions dead-end.
 */
export default function InstallIconButton({ inverted = false, compact = false }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const onDarkSurface = isDark || inverted;
  const { supported, hasNativePrompt, isIOS, promptInstall } = useInstallPrompt();
  const { confirm, alert } = useAppModal();
  const offeringRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const iconSize = compact ? 18 : 22;

  const offerInstall = useCallback(async () => {
    if (offeringRef.current) return;
    offeringRef.current = true;
    setBusy(true);
    try {
      const accepted = await confirm({
        title: "Add to home screen?",
        message:
          "Install ExamNexus on this device so you can open it like an app from your home screen or desktop.",
        confirmLabel: "Add",
        cancelLabel: "Not now",
        tone: "info",
      });

      if (!accepted) return;

      const result = await promptInstall();
      if (result === "accepted" || result === "dismissed") return;

      if (result === "ios") {
        await alert({
          title: "Add to Home Screen",
          message:
            "On iPhone/iPad: tap Share in Safari, then Add to Home Screen.",
          confirmLabel: "OK",
          tone: "info",
        });
        return;
      }

      await alert({
        title: "Install not available yet",
        message:
          "Chrome has not enabled install on this tab yet. Open the main site (not a preview link), stay on the page for a few seconds, then try again. If you dismissed install before, Chrome may hide it for a while.",
        confirmLabel: "OK",
        tone: "info",
      });
    } finally {
      setBusy(false);
      offeringRef.current = false;
    }
  }, [alert, confirm, promptInstall]);

  // When Chrome exposes the install prompt, ask once automatically.
  useEffect(() => {
    if (!supported || !hasNativePrompt) return;
    try {
      if (sessionStorage.getItem(AUTO_OFFER_KEY) === "1") return;
      sessionStorage.setItem(AUTO_OFFER_KEY, "1");
    } catch {
      // ignore
    }
    const timer = window.setTimeout(() => {
      offerInstall();
    }, 900);
    return () => window.clearTimeout(timer);
  }, [supported, hasNativePrompt, offerInstall]);

  if (!supported) return null;

  return (
    <div className="en-install-tip-wrap">
      <button
        type="button"
        onClick={offerInstall}
        disabled={busy}
        className={`en-install-icon-btn flex shrink-0 items-center justify-center transition-colors duration-150 ${
          compact ? "h-10 w-10 rounded-xl" : "rounded-2xl p-3.5"
        } ${
          onDarkSurface
            ? "border border-emerald-400/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20"
            : "en-bg-elevated border border-emerald-700/20 text-teal-800 en-hover"
        } disabled:opacity-60`}
        aria-label="Add ExamNexus to home screen"
      >
        <Download size={iconSize} strokeWidth={2.25} />
      </button>

      <span role="tooltip" className="en-install-tip">
        <strong>Add to home screen</strong>
        <span>Install ExamNexus</span>
      </span>
    </div>
  );
}
