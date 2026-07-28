import { useCallback, useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import { useInstallPrompt } from "../../hooks/useInstallPrompt";
import { useAppModal } from "../../contexts/AppModalContext";
import InstallAppChooser, {
  ANDROID_APK_FILENAME,
  ANDROID_APK_URL,
} from "./InstallAppChooser";
import IosInstallSheet from "./IosInstallSheet";

const AUTO_OFFER_KEY = "examnexus_install_offer_seen";

/**
 * Header install button: Desktop PWA, iPhone/iPad (Safari), or Android APK.
 */
export default function InstallIconButton({ inverted = false, compact = false }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const onDarkSurface = isDark || inverted;
  const { supported, hasNativePrompt, isIOS, promptInstall } = useInstallPrompt();
  const { alert } = useAppModal();
  const offeringRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [iosSheetOpen, setIosSheetOpen] = useState(false);
  const iconSize = compact ? 18 : 22;

  const closeChooser = useCallback(() => {
    if (busy) return;
    setChooserOpen(false);
  }, [busy]);

  const showIosHelp = useCallback(() => {
    setChooserOpen(false);
    setIosSheetOpen(true);
  }, []);

  const installDesktop = useCallback(async () => {
    if (isIOS) {
      showIosHelp();
      return;
    }
    if (offeringRef.current) return;
    offeringRef.current = true;
    setBusy(true);
    try {
      setChooserOpen(false);
      const result = await promptInstall();
      if (result === "accepted" || result === "dismissed") return;

      if (result === "ios") {
        setIosSheetOpen(true);
        return;
      }

      await alert({
        title: "Desktop install not available yet",
        message:
          "Chrome has not enabled install on this tab yet. Open the main site (not a preview link), stay on the page for a few seconds, then try again. If you dismissed install before, Chrome may hide it for a while.",
        confirmLabel: "OK",
        tone: "info",
      });
    } finally {
      setBusy(false);
      offeringRef.current = false;
    }
  }, [alert, isIOS, promptInstall, showIosHelp]);

  const downloadAndroid = useCallback(async () => {
    setBusy(true);
    try {
      setChooserOpen(false);
      const link = document.createElement("a");
      link.href = ANDROID_APK_URL;
      link.download = ANDROID_APK_FILENAME;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();

      await alert({
        title: "Android download started",
        message:
          "Open the downloaded APK on your Android phone. You may need to allow installs from this browser or Files.",
        confirmLabel: "OK",
        tone: "success",
      });
    } finally {
      setBusy(false);
    }
  }, [alert]);

  const openChooser = useCallback(() => {
    if (busy || offeringRef.current) return;
    // On iPhone/iPad jump straight to Safari Add-to-Home-Screen help.
    if (isIOS) {
      setIosSheetOpen(true);
      return;
    }
    setChooserOpen(true);
  }, [busy, isIOS]);

  // Auto-offer once: iOS → Safari sheet; desktop → chooser when Chrome is ready.
  useEffect(() => {
    if (!supported) return;
    try {
      if (sessionStorage.getItem(AUTO_OFFER_KEY) === "1") return;
      sessionStorage.setItem(AUTO_OFFER_KEY, "1");
    } catch {
      // ignore
    }
    const timer = window.setTimeout(() => {
      if (isIOS) {
        setIosSheetOpen(true);
      } else if (hasNativePrompt) {
        setChooserOpen(true);
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [supported, hasNativePrompt, isIOS]);

  if (!supported) return null;

  return (
    <>
      <div className="en-install-tip-wrap">
        <button
          type="button"
          onClick={openChooser}
          disabled={busy}
          className={`en-install-icon-btn flex shrink-0 items-center justify-center transition-colors duration-150 ${
            compact ? "h-10 w-10 rounded-xl" : "rounded-2xl p-3.5"
          } ${
            onDarkSurface
              ? "border border-emerald-400/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20"
              : "en-bg-elevated border border-emerald-700/20 text-teal-800 en-hover"
          } disabled:opacity-60`}
          aria-label="Install ExamNexus"
        >
          <Download size={iconSize} strokeWidth={2.25} />
        </button>

        <span role="tooltip" className="en-install-tip">
          <strong>Install ExamNexus</strong>
          <span>{isIOS ? "Add to Home Screen" : "Desktop, iPhone, or Android"}</span>
        </span>
      </div>

      <InstallAppChooser
        open={chooserOpen}
        onClose={closeChooser}
        onDesktop={installDesktop}
        onIos={showIosHelp}
        onAndroid={downloadAndroid}
        busy={busy}
        preferIos={isIOS}
      />

      <IosInstallSheet
        open={iosSheetOpen}
        onClose={() => setIosSheetOpen(false)}
        isDark={isDark}
      />
    </>
  );
}
