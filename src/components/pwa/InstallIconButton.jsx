import { useCallback, useState } from "react";
import { Download } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import { useInstallPrompt } from "../../hooks/useInstallPrompt";
import IosInstallSheet from "./IosInstallSheet";

/**
 * Compact install button for headers — sits beside the theme toggle.
 * Always visible on the website when install is supported (not native APK /
 * not already installed). If the browser has no native prompt yet, tapping
 * shows install instructions instead of hiding the icon.
 *
 * `inverted` matches ThemeToggle: use on dark headers (e.g. homepage).
 */
export default function InstallIconButton({ inverted = false, compact = false }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const onDarkSurface = isDark || inverted;
  const { supported, hasNativePrompt, isIOS, promptInstall } = useInstallPrompt();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetVariant, setSheetVariant] = useState("ios");
  const iconSize = compact ? 18 : 22;

  const handleInstall = useCallback(async () => {
    const result = await promptInstall();
    if (result === "accepted" || result === "dismissed") return;
    if (result === "ios" || isIOS) {
      setSheetVariant("ios");
      setSheetOpen(true);
      return;
    }
    setSheetVariant("desktop");
    setSheetOpen(true);
  }, [promptInstall, isIOS]);

  // Hide only inside the Capacitor APK or when already installed as a PWA.
  if (!supported) return null;

  return (
    <>
      <div className="en-install-tip-wrap">
        <button
          type="button"
          onClick={handleInstall}
          className={`en-install-icon-btn flex shrink-0 items-center justify-center transition-colors duration-150 ${
            compact ? "h-10 w-10 rounded-xl" : "rounded-2xl p-3.5"
          } ${
            onDarkSurface
              ? "border border-emerald-400/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20"
              : "en-bg-elevated border border-emerald-700/20 text-teal-800 en-hover"
          }`}
          aria-label="Install ExamNexus — add to desktop or home screen"
        >
          <Download size={iconSize} strokeWidth={2.25} />
        </button>

        <span role="tooltip" className="en-install-tip">
          <strong>Install ExamNexus</strong>
          <span>
            {hasNativePrompt
              ? "Add to desktop / home screen"
              : isIOS
                ? "Add to Home Screen"
                : "Download to desktop"}
          </span>
        </span>
      </div>

      <IosInstallSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        isDark={isDark}
        variant={sheetVariant}
      />
    </>
  );
}
