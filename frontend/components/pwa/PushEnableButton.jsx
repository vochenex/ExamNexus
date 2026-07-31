import { useCallback, useEffect, useState } from "react";
import { BellOff, BellRing } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import { isNativeApp } from "../../utils/platform";
import {
  initPushNotifications,
  initWebPushNotifications,
  isPushAvailable,
  needsPushPermissionPrompt,
} from "../../utils/pushNotifications";

/**
 * Compact top-bar control (same slot as Install on A2HS) that asks for
 * announcement alerts when the APK or Add-to-Home-Screen app has not
 * granted notification permission yet.
 */
export default function PushEnableButton({ compact = false }) {
  const { theme } = useTheme();
  const [needed, setNeeded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const iconSize = compact ? 17 : 18;

  const refresh = useCallback(async () => {
    if (!isPushAvailable()) {
      setNeeded(false);
      return;
    }
    try {
      setNeeded(await needsPushPermissionPrompt());
    } catch {
      setNeeded(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener("en:push-enabled", onChange);
    document.addEventListener("visibilitychange", onChange);
    return () => {
      window.removeEventListener("en:push-enabled", onChange);
      document.removeEventListener("visibilitychange", onChange);
    };
  }, [refresh]);

  const enable = async () => {
    setBusy(true);
    setNote("");
    try {
      const ok = isNativeApp()
        ? await initPushNotifications()
        : await initWebPushNotifications({ requestPermission: true });
      if (ok) {
        setNeeded(false);
        setNote("");
      } else {
        setNote("Allow notifications in system settings for ExamNexus.");
        await refresh();
      }
    } catch {
      setNote("Could not enable alerts. Check system notification settings.");
    } finally {
      setBusy(false);
    }
  };

  if (!needed) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={enable}
        disabled={busy}
        title="Enable announcement alerts"
        aria-label="Enable announcement alerts"
        className={`inline-flex items-center justify-center rounded-full transition disabled:opacity-60 ${
          compact ? "h-9 w-9" : "h-10 w-10"
        } ${
          theme === "dark"
            ? "bg-amber-500/15 text-amber-200 hover:bg-amber-500/25"
            : "bg-amber-50 text-amber-700 hover:bg-amber-100"
        }`}
      >
        {busy ? <BellRing size={iconSize} className="animate-pulse" /> : <BellOff size={iconSize} />}
      </button>
      {note ? (
        <p
          className={`absolute right-0 top-full z-50 mt-1 w-48 rounded-lg px-2 py-1 text-[10px] leading-snug shadow-lg ${
            theme === "dark"
              ? "bg-[#0b1f1d] text-amber-100"
              : "bg-white text-amber-900 ring-1 ring-amber-100"
          }`}
        >
          {note}
        </p>
      ) : null}
    </div>
  );
}
