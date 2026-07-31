import { WifiOff, Wifi } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";

export default function ConnectionStatusBanner({ status, className = "" }) {
  const { theme } = useTheme();

  if (!status || status === "online") return null;

  const offline = status === "offline";

  return (
    <div
      role="status"
      className={`rounded-xl border px-4 py-3 text-sm ${
        offline
          ? theme === "dark"
            ? "border-amber-500/35 bg-amber-500/10 text-amber-100"
            : "border-amber-300 bg-amber-50 text-amber-950"
          : theme === "dark"
            ? "border-orange-500/35 bg-orange-500/10 text-orange-100"
            : "border-orange-300 bg-orange-50 text-orange-950"
      } ${className}`}
    >
      <div className="flex items-start gap-2.5">
        {offline ? (
          <WifiOff size={18} className="mt-0.5 shrink-0" />
        ) : (
          <Wifi size={18} className="mt-0.5 shrink-0" />
        )}
        <div>
          {offline ? (
            <>
              <strong>You are offline.</strong> Keep this page open. Content already loaded
              stays available; reconnect to save or sync changes.
            </>
          ) : (
            <>
              <strong>Unstable internet connection.</strong> The page stays open while we
              silently check for a steady connection.
            </>
          )}
        </div>
      </div>
    </div>
  );
}
