import { WifiOff, Wifi } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";

export default function ConnectionStatusBanner({ status, className = "" }) {
  const { theme } = useTheme();

  if (!status || status === "online") return null;

  const offline = status === "offline";

  return (
    <div
      role="status"
      className={`inline-flex max-w-full w-fit items-start gap-2 rounded-xl border px-3 py-2 text-sm ${
        offline
          ? theme === "dark"
            ? "border-red-500/40 bg-red-500/15 text-red-100"
            : "border-red-300 bg-red-50 text-red-900"
          : theme === "dark"
            ? "border-orange-500/35 bg-orange-500/10 text-orange-100"
            : "border-orange-300 bg-orange-50 text-orange-950"
      } ${className}`}
    >
      {offline ? (
        <WifiOff size={16} className="mt-0.5 shrink-0" />
      ) : (
        <Wifi size={16} className="mt-0.5 shrink-0" />
      )}
      <p className="min-w-0 leading-snug">
        {offline ? (
          <>
            <strong>You are offline.</strong> Loaded content stays available;
            reconnect to sync.
          </>
        ) : (
          <>
            <strong>Unstable connection.</strong> Checking for a steady link…
          </>
        )}
      </p>
    </div>
  );
}
