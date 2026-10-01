import { AlertCircle } from "lucide-react";
import { useScrollIntoViewWhen } from "../../hooks/useScrollIntoViewWhen";
import { secondaryButtonSm } from "../../utils/themeButtons";
import { friendlyError } from "../../utils/friendlyError";

export function formatAdminError(err) {
  const message = err?.message || String(err || "");

  if (message.includes("Admin access required")) {
    return "Your account does not have admin access.";
  }
  if (
    message.includes("password_reset") ||
    message.includes("admin_list_password_reset") ||
    message.includes("Password reset functions") ||
    message.includes("Password reset is not set up")
  ) {
    return "Password reset isn't set up yet. Please contact the system administrator.";
  }

  return friendlyError(err, "Could not load this page. Please try again.");
}

export default function AdminPageError({ theme, message, onRetry }) {
  const ref = useScrollIntoViewWhen(Boolean(message), { deps: [message] });

  return (
    <div
      ref={ref}
      role="status"
      className={`mb-5 flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
        theme === "dark"
          ? "border-red-500/30 bg-red-500/10 text-red-100"
          : "border-red-200 bg-red-50 text-red-900"
      }`}
    >
      <div className="flex items-start gap-2 text-sm">
        <AlertCircle size={18} className="mt-0.5 shrink-0" />
        <p>{message}</p>
      </div>
      {onRetry && (
        <button type="button" onClick={onRetry} className={secondaryButtonSm(theme)}>
          Retry
        </button>
      )}
    </div>
  );
}
