import { X } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import { secondaryButtonSm } from "../utils/themeButtons";
import { formatIntegrityEventLabel } from "../utils/examIntegrity";

export default function StudentIntegrityAlertsModal({
  open,
  onClose,
  studentName,
  alerts = [],
  loading = false,
}) {
  const { theme } = useTheme();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border ${
          theme === "dark"
            ? "border-white/10 bg-slate-900"
            : "border-amber-200/80 en-bg-elevated shadow-xl"
        }`}
      >
        <div
          className={`flex items-start justify-between gap-4 border-b px-5 py-4 ${
            theme === "dark" ? "border-white/10" : "border-amber-100"
          }`}
        >
          <div>
            <p
              className={`text-xs font-semibold uppercase tracking-wide ${
                theme === "dark" ? "text-amber-400" : "text-amber-700"
              }`}
            >
              Integrity alerts
            </p>
            <h2 className={`text-xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
              {studentName}
            </h2>
            <p className={`mt-1 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
              {alerts.length} alert{alerts.length === 1 ? "" : "s"} recorded across all attempts
              (first try and retakes)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-lg p-2 ${theme === "dark" ? "hover:bg-white/10" : "hover:bg-gray-100"}`}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
              Loading alerts...
            </p>
          ) : alerts.length === 0 ? (
            <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
              No integrity alerts for this student.
            </p>
          ) : (
            <ul className="space-y-3">
              {alerts.map((alert, index) => (
                <li
                  key={alert.id || `${alert.event_type}-${index}`}
                  className={`rounded-xl border px-4 py-3 ${
                    theme === "dark"
                      ? "border-amber-500/20 bg-amber-500/5"
                      : "border-amber-200 bg-amber-50/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`font-semibold text-sm ${theme === "dark" ? "text-amber-200" : "text-amber-900"}`}>
                        {formatIntegrityEventLabel(alert.event_type)}
                      </p>
                      {alert.metadata?.attempt === "retake" && (
                        <span
                          className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            theme === "dark"
                              ? "bg-purple-500/20 text-purple-300"
                              : "bg-purple-100 text-purple-800"
                          }`}
                        >
                          Retake attempt
                        </span>
                      )}
                    </div>
                    {alert.created_at && (
                      <span className={`shrink-0 text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
                        {new Date(alert.created_at).toLocaleString("en-PH", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    )}
                  </div>
                  {alert.description && (
                    <p className={`mt-2 text-sm ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>
                      {alert.description}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          className={`border-t px-5 py-4 text-right ${
            theme === "dark" ? "border-white/10" : "border-amber-100"
          }`}
        >
          <button type="button" onClick={onClose} className={secondaryButtonSm(theme)}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
