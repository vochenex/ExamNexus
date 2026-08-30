import { useCallback, useMemo, useState } from "react";
import { KeyRound, X, CheckCheck, Eye, EyeOff, Sparkles, Search } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import { useAppModal } from "../../contexts/AppModalContext";
import PageHeader from "../../components/ui/PageHeader";
import Select from "../../components/ui/Select";
import ModalPortal from "../../components/ui/ModalPortal";
import ProgressButton from "../../components/ui/ProgressButton";
import { PageLoadingSkeleton } from "../../components/ui/PageLoadingSkeleton";
import { usePolling } from "../../hooks/useRealtimeFetch";
import AdminPageError, { formatAdminError } from "../../components/admin/AdminPageError";
import {
  adminTableClass,
  adminTableWrapClass,
  adminTdClass,
  adminThClass,
  adminNoticeClass,
  adminToolbarClass,
  adminSearchWrapClass,
  adminToolbarActionsClass,
  adminTableInnerClass,
} from "../../components/admin/adminTableStyles";
import {
  completeAdminPasswordResetRequest,
  fetchAdminPasswordResetRequests,
  rejectAdminPasswordResetRequest,
} from "../../utils/passwordReset";
import { pageShellClass, inputClass, panelClass } from "../../utils/themeInputs";
import { iconButton, primaryButtonSm, secondaryButtonSm, dangerButton } from "../../utils/themeButtons";

const STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "rejected", label: "Rejected" },
  { value: "", label: "All" },
];

function generateTempPassword(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let value = "";
  for (let index = 0; index < length; index += 1) {
    value += chars[Math.floor(Math.random() * chars.length)];
  }
  return value;
}

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
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bulkCompleting, setBulkCompleting] = useState(false);
  const [bulkRejecting, setBulkRejecting] = useState(false);
  const [bulkResults, setBulkResults] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const pendingRows = useMemo(
    () => rows.filter((row) => row.status === "pending"),
    [rows]
  );

  const visibleRows = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) return rows;
    return rows.filter((row) => {
      const email = String(row.email || "").toLowerCase();
      const id = String(row.school_id || "").toLowerCase();
      const name = `${row.first_name || ""} ${row.last_name || ""}`.trim().toLowerCase();
      return email.includes(trimmed) || id.includes(trimmed) || name.includes(trimmed);
    });
  }, [rows, searchQuery]);

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
      await success("Password reset completed. The user can view the temporary password on the forgot-password page.");
      setResetTarget(null);
      setNewPassword("");
      setAdminNotes("");
      setShowResetPassword(false);
      await load(true);
    } catch (err) {
      error(err.message || "Failed to reset password.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveAll = async () => {
    if (!pendingRows.length) {
      error("No pending password reset requests.");
      return;
    }

    const ok = await confirm({
      title: "Approve all pending resets?",
      message: `Complete ${pendingRows.length} password reset request${pendingRows.length === 1 ? "" : "s"} with auto-generated temporary passwords? Share each password securely with the user.`,
      tone: "warning",
      confirmLabel: "Approve all",
    });
    if (!ok) return;

    try {
      setBulkCompleting(true);
      const completed = [];

      for (const row of pendingRows) {
        const tempPassword = generateTempPassword();
        await completeAdminPasswordResetRequest({
          requestId: row.id,
          newPassword: tempPassword,
          adminNotes: "Bulk reset by administrator.",
        });
        completed.push({
          email: row.email,
          schoolId: row.school_id,
          password: tempPassword,
        });
      }

      setBulkResults(completed);
      await success(
        `Completed ${completed.length} password reset${completed.length === 1 ? "" : "s"}.`
      );
      await load(true);
    } catch (err) {
      error(err.message || "Failed to complete all password resets.");
    } finally {
      setBulkCompleting(false);
    }
  };

  const handleRejectAll = async () => {
    if (!pendingRows.length) {
      error("No pending password reset requests.");
      return;
    }

    const ok = await confirm({
      title: "Reject all pending resets?",
      message: `Reject ${pendingRows.length} password reset request${pendingRows.length === 1 ? "" : "s"}? Users will need to submit a new request if they still need help.`,
      tone: "danger",
      confirmLabel: "Reject all",
    });
    if (!ok) return;

    try {
      setBulkRejecting(true);
      for (const row of pendingRows) {
        await rejectAdminPasswordResetRequest(row.id, "Bulk rejection by administrator.");
      }
      await success(
        `Rejected ${pendingRows.length} password reset request${pendingRows.length === 1 ? "" : "s"}.`
      );
      await load(true);
    } catch (err) {
      error(err.message || "Failed to reject all password reset requests.");
    } finally {
      setBulkRejecting(false);
    }
  };

  if (loading && rows.length === 0) return <PageLoadingSkeleton theme={theme} variant="list" />;

  const pendingCount = pendingRows.length;

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
        <div className={adminNoticeClass(theme)}>
          {pendingCount} password reset request{pendingCount === 1 ? "" : "s"} waiting for action.
        </div>
      )}

      <div className={adminToolbarClass(theme)}>
        <div className={adminSearchWrapClass()}>
          <Search
            size={16}
            className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${
              theme === "dark" ? "text-gray-500" : "text-gray-400"
            }`}
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, school ID, or email…"
            className={inputClass(theme, "w-full min-w-0 py-2.5 pl-9 pr-3")}
            aria-label="Search password reset requests by name, school ID, or email"
          />
        </div>
        <div className={adminToolbarActionsClass()}>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full min-w-[9rem] sm:w-auto sm:max-w-[11rem]"
        >
          {STATUSES.map((item) => (
            <option key={item.value || "all"} value={item.value}>
              {item.label}
            </option>
          ))}
        </Select>
        {statusFilter === "pending" && pendingCount > 0 && (
          <>
            <ProgressButton
              type="button"
              onClick={handleApproveAll}
              loading={bulkCompleting}
              loadingLabel="Approving..."
              disabled={bulkRejecting || actingId !== null || submitting}
              className={primaryButtonSm(theme, "text-xs px-3 py-1.5 whitespace-nowrap")}
              aria-label="Approve all pending resets"
              title="Approve all pending resets"
            >
              <CheckCheck size={14} />
              Approve all
            </ProgressButton>
            <ProgressButton
              type="button"
              onClick={handleRejectAll}
              loading={bulkRejecting}
              loadingLabel="Rejecting..."
              disabled={bulkCompleting || actingId !== null || submitting}
              className={dangerButton(theme, "text-xs px-3 py-1.5 whitespace-nowrap")}
              aria-label="Reject all pending resets"
              title="Reject all pending resets"
            >
              <X size={14} />
              Reject all
            </ProgressButton>
          </>
        )}
        </div>
      </div>

      <div className={adminTableWrapClass(theme)}>
        <div className={adminTableInnerClass()}>
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
              {!visibleRows.length ? (
                <tr>
                  <td colSpan={6} className={`${adminTdClass(theme)} py-8 text-center`}>
                    {statusFilter === "pending" ? (
                      <span>
                        No pending password reset requests. Requests only reach admins when the
                        user&apos;s email and school ID match an existing account.
                      </span>
                    ) : (
                      "No password reset requests match this filter."
                    )}
                  </td>
                </tr>
              ) : (
                visibleRows.map((row) => (
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
                            disabled={bulkCompleting || bulkRejecting || submitting || actingId === row.id}
                            onClick={() => {
                              setResetTarget(row);
                              setNewPassword("");
                              setAdminNotes("");
                              setShowResetPassword(false);
                            }}
                            className={iconButton(theme, "primary")}
                            aria-label={`Reset password for ${row.email}`}
                            title="Reset password"
                          >
                            <KeyRound size={16} />
                          </button>
                          <ProgressButton
                            type="button"
                            loading={actingId === row.id}
                            loadingLabel="Rejecting request"
                            iconOnly
                            disabled={bulkCompleting || bulkRejecting || submitting || (actingId !== null && actingId !== row.id)}
                            onClick={() => handleReject(row)}
                            className={iconButton(theme, "danger")}
                            aria-label={`Reject reset for ${row.email}`}
                            title="Reject"
                          >
                            <X size={16} />
                          </ProgressButton>
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
        <ModalPortal>
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4" role="presentation">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => !submitting && setResetTarget(null)}
            aria-hidden="true"
          />
          <div
            className={`${panelClass(theme)} relative z-10 w-full max-w-md`}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h2 className="text-lg font-bold">Set temporary password</h2>
            <p className={`mt-2 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
              Create a temporary password for <strong>{resetTarget.email}</strong>. The user can also view it on the forgot-password page after verifying their email and school ID.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label
                  className={`mb-1.5 block text-xs font-semibold uppercase tracking-wide ${
                    theme === "dark" ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Temporary password
                </label>
                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <input
                      type={showResetPassword ? "text" : "password"}
                      className={`${inputClass(theme)} pr-11`}
                      placeholder="New temporary password (min. 6 characters)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPassword((current) => !current)}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 ${
                        theme === "dark" ? "text-gray-400 hover:text-emerald-300" : "text-gray-500 hover:text-teal-700"
                      }`}
                      aria-label={showResetPassword ? "Hide password" : "Show password"}
                    >
                      {showResetPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNewPassword(generateTempPassword());
                      setShowResetPassword(true);
                    }}
                    className={iconButton(theme, "secondary")}
                    title="Generate temporary password"
                    aria-label="Generate temporary password"
                  >
                    <Sparkles size={16} />
                  </button>
                </div>
              </div>
              <div>
                <label
                  className={`mb-1.5 block text-xs font-semibold uppercase tracking-wide ${
                    theme === "dark" ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Message to user (optional)
                </label>
                <textarea
                  className={`${inputClass(theme)} resize-none`}
                  rows={3}
                  placeholder="Shown to the user when they check their reset request"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (submitting) return;
                  setResetTarget(null);
                  setShowResetPassword(false);
                }}
                className={secondaryButtonSm(theme)}
                disabled={submitting}
              >
                Cancel
              </button>
              <ProgressButton
                type="button"
                onClick={handleComplete}
                loading={submitting}
                loadingLabel="Saving..."
                className={primaryButtonSm(theme)}
              >
                Apply reset
              </ProgressButton>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {bulkResults?.length ? (
        <ModalPortal>
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4" role="presentation">
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setBulkResults(null)}
              aria-hidden="true"
            />
            <div
              className={`${panelClass(theme)} relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col`}
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <h2 className="text-lg font-bold">Temporary passwords</h2>
              <p className={`mt-2 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                Share each temporary password securely with the user. They should change it after logging in.
              </p>
              <div className="en-inner-scroll mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto">
                {bulkResults.map((item) => (
                  <div
                    key={item.email}
                    className={`rounded-xl border px-3 py-2 text-sm ${
                      theme === "dark"
                        ? "border-white/10 bg-white/[0.03]"
                        : "border-emerald-200 bg-emerald-50/60"
                    }`}
                  >
                    <p className="break-all font-semibold">{item.email}</p>
                    {item.schoolId ? (
                      <p className={`text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-600"}`}>
                        School ID: {item.schoolId}
                      </p>
                    ) : null}
                    <p className={`mt-1 font-mono text-sm ${theme === "dark" ? "text-emerald-300" : "text-teal-800"}`}>
                      {item.password}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setBulkResults(null)}
                  className={primaryButtonSm(theme)}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      ) : null}
    </div>
  );
}
