import { useCallback, useState } from "react";
import { Download } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import { useInstallPrompt } from "../../hooks/useInstallPrompt";
import IosInstallSheet from "./IosInstallSheet";

/**
 * Compact install button for headers — sits beside the theme toggle.
 * Shows a tooltip on hover/focus and triggers the PWA install (or iOS steps).
 * Renders nothing when the app can't be installed (native app / already installed).
 *
 * `inverted` matches ThemeToggle: use on dark headers (e.g. homepage).
 */
export default function InstallIconButton({ inverted = false, compact = false }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const onDarkSurface = isDark || inverted;
  const { available, promptInstall } = useInstallPrompt();

  const [showIosSheet, setShowIosSheet] = useState(false);
  const iconSize = compact ? 18 : 22;

  const handleInstall = useCallback(async () => {
    const result = await promptInstall();
    if (result === "ios") setShowIosSheet(true);
  }, [promptInstall]);

  if (!available) return null;

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
          aria-label="Install ExamNexus — add to home screen"
        >
          <Download size={iconSize} strokeWidth={2.25} />
        </button>

        <span role="tooltip" className="en-install-tip">
          <strong>Install ExamNexus</strong>
          <span>Add to home screen</span>
        </span>
      </div>

      <IosInstallSheet
        open={showIosSheet}
        onClose={() => setShowIosSheet(false)}
        isDark={isDark}
      />
    </>
  );
}
