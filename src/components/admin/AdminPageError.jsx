import { AlertCircle } from "lucide-react";
import { secondaryButtonSm } from "../../utils/themeButtons";

export function formatAdminError(err) {
  const message = err?.message || String(err || "Unknown error");

  if (message.includes("Admin access required")) {
    return "Your account is not recognized as an admin. Run database/create_admin_account.sql in Supabase.";
  }
  if (message.includes("Could not find the function")) {
    return "Admin database functions are missing. Run database/admin_platform.sql and database/admin_platform_fixes.sql in Supabase SQL Editor.";
  }
  if (message.includes("JWT") || message.includes("session")) {
    return "Your session expired. Please log out and sign in again.";
  }

  return message;
}

export default function AdminPageError({ theme, message, onRetry }) {
  return (
    <div
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
