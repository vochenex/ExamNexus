import { useCallback, useState } from "react";
import { KeyRound, Check, X } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import { useAppModal } from "../../contexts/AppModalContext";
import PageHeader from "../../components/ui/PageHeader";
import Select from "../../components/ui/Select";
import { PageLoadingSkeleton } from "../../components/ui/PageLoadingSkeleton";
import { usePolling } from "../../hooks/useRealtimeFetch";
import AdminPageError, { formatAdminError } from "../../components/admin/AdminPageError";
import {
  adminTableClass,
  adminTableWrapClass,
  adminTdClass,
  adminThClass,
  adminToolbarClass,
} from "../../components/admin/adminTableStyles";
import {
  completeAdminPasswordResetRequest,
  fetchAdminPasswordResetRequests,
  rejectAdminPasswordResetRequest,
} from "../../utils/passwordReset";
import { pageShellClass, inputClass, panelClass } from "../../utils/themeInputs";
import { primaryButtonSm, secondaryButtonSm, dangerButton } from "../../utils/themeButtons";

const STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "rejected", label: "Rejected" },
  { value: "", label: "All" },
];

function statusBadge(theme, status) {
  const styles = {
    pending:
      theme === "dark"
        ? "bg-amber-500/15 text-amber-300 ring-amber-500/30"
        : "bg-amber-50 text-amber-800 ring-amber-200",
    completed:
      theme === "dark"
        ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
        : "bg-emerald-50 text-emerald-800 ring-emerald-200",
    rejected:
      theme === "dark"
        ? "bg-red-500/15 text-red-300 ring-red-500/30"
        : "bg-red-50 text-red-800 ring-red-200",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${
        styles[status] || styles.pending
      }`}
    >
      {status}
    </span>
  );
}

export default function AdminPasswordResets() {
  const { theme } = useTheme();
  const { success, error, confirm } = useAppModal();
  const [rows, setRows] = useState([]);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actingId, setActingId] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setLoadError("");
      const data = await fetchAdminPasswordResetRequests(statusFilter || null);
      setRows(data);
    } catch (err) {
      console.error(err);
      setRows([]);
      setLoadError(formatAdminError(err));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [statusFilter]);

  usePolling(load, [statusFilter]);

  const handleReject = async (row) => {
    const ok = await confirm({
      title: "Reject request?",
      message: `Reject the password reset request for ${row.email}?`,
      tone: "danger",
      confirmLabel: "Reject",
    });
    if (!ok) return;

    try {
      setActingId(row.id);
      await rejectAdminPasswordResetRequest(row.id, "Request rejected by administrator.");
      await success("Request rejected.");
      await load(true);
    } catch (err) {
      error(err.message || "Failed to reject request.");
    } finally {
      setActingId(null);
    }
  };

  const handleComplete = async () => {
    if (!resetTarget) return;
    if (newPassword.trim().length < 6) {
      error("Temporary password must be at least 6 characters.");
      return;
    }

    try {
      setSubmitting(true);
      await completeAdminPasswordResetRequest({
        requestId: resetTarget.id,
        newPassword: newPassword.trim(),
        adminNotes: adminNotes.trim() || null,
      });
      await success("Password reset completed.");
      setResetTarget(null);
      setNewPassword("");
      setAdminNotes("");
      await load(true);
    } catch (err) {
      error(err.message || "Failed to reset password.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <PageLoadingSkeleton theme={theme} variant="list" />;

  const pendingCount = rows.filter((r) => r.status === "pending").length;

  return (
    <div className={pageShellClass(theme, "mx-auto max-w-7xl")}>
      <PageHeader
        theme={theme}
        icon={KeyRound}
        title="Password reset requests"
        subtitle="Review forgot-password requests from students and faculty, then set a new temporary password."
      />

      {loadError && (
        <AdminPageError theme={theme} message={loadError} onRetry={() => load()} />
      )}

      {statusFilter === "pending" && pendingCount > 0 && (
        <div
          className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
            theme === "dark"
              ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          {pendingCount} password reset request{pendingCount === 1 ? "" : "s"} waiting for action.
          Ensure the backend is running with <code className="text-xs">SUPABASE_SERVICE_ROLE_KEY</code> to apply new passwords.
        </div>
      )}

      <div className={adminToolbarClass(theme)}>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="max-w-xs"
        >
          {STATUSES.map((item) => (
            <option key={item.value || "all"} value={item.value}>
              {item.label}
            </option>
          ))}
        </Select>
      </div>

      <div className={adminTableWrapClass(theme)}>
        <div className="overflow-x-auto">
          <table className={adminTableClass(theme)}>
            <thead>
              <tr>
                <th className={adminThClass(theme)}>Requested</th>
                <th className={adminThClass(theme)}>Email</th>
                <th className={adminThClass(theme)}>School ID</th>
                <th className={adminThClass(theme)}>Message</th>
                <th className={adminThClass(theme)}>Status</th>
                <th className={adminThClass(theme)}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!rows.length ? (
                <tr>
                  <td colSpan={6} className={`${adminTdClass(theme)} py-8 text-center`}>
                    No password reset requests match this filter.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td className={adminTdClass(theme)}>
                      {row.created_at
                        ? new Date(row.created_at).toLocaleString()
                        : "—"}
                    </td>
                    <td className={adminTdClass(theme)}>{row.email}</td>
                    <td className={adminTdClass(theme)}>{row.school_id}</td>
                    <td className={adminTdClass(theme)}>{row.message || "—"}</td>
                    <td className={adminTdClass(theme)}>{statusBadge(theme, row.status)}</td>
                    <td className={adminTdClass(theme)}>
                      {row.status === "pending" ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={actingId === row.id}
                            onClick={() => {
                              setResetTarget(row);
                              setNewPassword("");
                              setAdminNotes("");
                            }}
                            className={primaryButtonSm(theme, "text-xs px-2 py-1")}
                          >
                            <Check size={14} />
                            Reset password
                          </button>
                          <button
                            type="button"
                            disabled={actingId === row.id}
                            onClick={() => handleReject(row)}
                            className={dangerButton(theme, "text-xs px-2 py-1")}
                          >
                            <X size={14} />
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className={`text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
                          {row.admin_notes || "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {resetTarget && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className={`${panelClass(theme)} w-full max-w-md`}>
            <h2 className="text-lg font-bold">Set new password</h2>
            <p className={`mt-2 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
              Create a temporary password for <strong>{resetTarget.email}</strong>. Share it with the user securely.
            </p>
            <div className="mt-4 space-y-3">
              <input
                type="password"
                className={inputClass(theme)}
                placeholder="New temporary password (min. 6 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
              <input
                type="text"
                className={inputClass(theme)}
                placeholder="Admin note (optional)"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                className={secondaryButtonSm(theme)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleComplete}
                disabled={submitting}
                className={primaryButtonSm(theme)}
              >
                {submitting ? "Saving..." : "Apply reset"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
