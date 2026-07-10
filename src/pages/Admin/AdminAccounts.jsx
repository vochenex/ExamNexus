import { useCallback, useMemo, useState } from "react";
import { Users, Pencil, Trash2, Check } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import { useAppModal } from "../../contexts/AppModalContext";
import PageHeader from "../../components/ui/PageHeader";
import Select from "../../components/ui/Select";
import ModalPortal from "../../components/ui/ModalPortal";
import { PageLoadingSkeleton } from "../../components/ui/PageLoadingSkeleton";
import { usePolling } from "../../hooks/useRealtimeFetch";
import {
  adminTableClass,
  adminTableWrapClass,
  adminTdClass,
  adminThClass,
  adminToolbarClass,
} from "../../components/admin/adminTableStyles";
import AdminPageError, { formatAdminError } from "../../components/admin/AdminPageError";
import {
  deleteAdminUser,
  fetchAdminUsers,
  getAccountStatus,
  reviewAdminAccount,
  updateAdminUser,
} from "../../utils/adminData";
import { pageShellClass, inputClass, panelClass } from "../../utils/themeInputs";
import { primaryButtonSm, secondaryButtonSm, dangerButton } from "../../utils/themeButtons";
import { DEPARTMENTS, getCoursesForDepartment } from "../../utils/academicOptions";
import { YEAR_LEVELS } from "../../utils/yearLevels";

const ROLES = ["Student", "Faculty", "Admin"];
const STATUSES = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending approval" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

function statusBadge(theme, status) {
  const value = status || "approved";
  const styles = {
    pending:
      theme === "dark"
        ? "bg-amber-500/15 text-amber-300 ring-amber-500/30"
        : "bg-amber-50 text-amber-800 ring-amber-200",
    approved:
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
        styles[value] || styles.approved
      }`}
    >
      {value}
    </span>
  );
}

export default function AdminAccounts() {
  const { theme } = useTheme();
  const { success, error, confirm } = useAppModal();
  const [users, setUsers] = useState([]);
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [reviewingId, setReviewingId] = useState(null);

  const pendingCount = useMemo(
    () => users.filter((user) => getAccountStatus(user) === "pending").length,
    [users]
  );

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setLoadError("");
      const rows = await fetchAdminUsers(roleFilter || null, statusFilter || null);
      setUsers(rows);
    } catch (err) {
      console.error(err);
      setUsers([]);
      setLoadError(formatAdminError(err));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [roleFilter, statusFilter]);

  usePolling(load, [roleFilter, statusFilter]);

  const courses = useMemo(
    () => getCoursesForDepartment(editing?.department),
    [editing?.department]
  );

  const handleSave = async () => {
    if (!editing) return;
    try {
      setSaving(true);
      await updateAdminUser(editing.id, editing);
      await success("Account updated successfully.");
      setEditing(null);
      await load(true);
    } catch (err) {
      error(err.message || "Failed to update account.");
    } finally {
      setSaving(false);
    }
  };

  const handleReview = async (user, action) => {
    const label = action === "approve" ? "Approve" : "Reject";
    const ok = await confirm({
      title: `${label} account?`,
      message:
        action === "approve"
          ? `Approve ${user.first_name} ${user.last_name} (${user.role})? They will be able to log in.`
          : `Reject ${user.first_name} ${user.last_name}? They will not be able to use the platform.`,
      tone: action === "approve" ? "success" : "danger",
      confirmLabel: label,
    });
    if (!ok) return;

    try {
      setReviewingId(user.id);
      await reviewAdminAccount(user.id, action);
      await success(action === "approve" ? "Account approved." : "Account rejected.");
      await load(true);
    } catch (err) {
      error(err.message || `Failed to ${action} account.`);
    } finally {
      setReviewingId(null);
    }
  };

  const handleDelete = async (user) => {
    const currentUser = JSON.parse(localStorage.getItem("examnexus_user") || "{}");
    if (user.id === currentUser.id) {
      error("You cannot delete your own admin account while signed in.");
      return;
    }

    const ok = await confirm({
      title: "Delete account?",
      message: `Permanently delete ${user.first_name} ${user.last_name}? This cannot be undone.`,
      tone: "danger",
      confirmLabel: "Delete",
    });
    if (!ok) return;

    try {
      await deleteAdminUser(user.id);
      await success("Account deleted.");
      await load(true);
    } catch (err) {
      error(err.message || "Failed to delete account.");
    }
  };

  if (loading) return <PageLoadingSkeleton theme={theme} variant="list" />;

  return (
    <div className={pageShellClass(theme, "mx-auto max-w-[100rem]")}>
      <PageHeader
        theme={theme}
        icon={Users}
        title="Manage accounts"
        subtitle="Review new signup requests and manage user roles, academic info, and access."
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
          {pendingCount} account{pendingCount === 1 ? "" : "s"} waiting for your approval.
        </div>
      )}

      <div className={`${adminToolbarClass(theme)} flex flex-wrap gap-3`}>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="max-w-xs"
        >
          {STATUSES.map((status) => (
            <option key={status.value || "all"} value={status.value}>
              {status.label}
            </option>
          ))}
        </Select>
        <Select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="max-w-xs"
        >
          <option value="">All roles</option>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </Select>
      </div>

      <div className={`${adminTableWrapClass(theme)} min-w-0`}>
      {users.length === 0 ? (
        <div
          className={`flex min-h-[12rem] w-full items-center justify-center px-4 py-10 text-center text-sm ${
            theme === "dark" ? "text-gray-400" : "text-gray-600"
          }`}
        >
          No accounts match the current filters.
        </div>
      ) : (
        <div className="en-inner-scroll en-table-scroll w-full max-w-full overflow-x-auto overflow-y-visible overscroll-x-contain touch-pan-x touch-pan-y">
          <table className={`${adminTableClass(theme)} min-w-[76rem]`}>
            <thead>
              <tr>
                <th className={`${adminThClass(theme)} w-12`}>#</th>
                <th className={`${adminThClass(theme)} min-w-[11rem]`}>Name</th>
                <th className={`${adminThClass(theme)} min-w-[14rem]`}>Email</th>
                <th className={`${adminThClass(theme)} min-w-[7rem]`}>School ID</th>
                <th className={`${adminThClass(theme)} min-w-[5.5rem]`}>Role</th>
                <th className={`${adminThClass(theme)} min-w-[6.5rem]`}>Status</th>
                <th className={`${adminThClass(theme)} min-w-[9rem]`}>Department</th>
                <th className={`${adminThClass(theme)} min-w-[11rem]`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, index) => {
                  const status = getAccountStatus(user);
                  const isPending = status === "pending";
                  const isAdmin = String(user.role || "").toLowerCase() === "admin";

                  return (
                    <tr key={user.id}>
                      <td className={`${adminTdClass(theme)} tabular-nums text-gray-500`}>
                        {index + 1}
                      </td>
                      <td className={`${adminTdClass(theme)} min-w-[11rem] whitespace-nowrap`}>
                        {[user.first_name, user.last_name].filter(Boolean).join(" ") || "—"}
                      </td>
                      <td className={`${adminTdClass(theme)} min-w-[14rem] break-all`}>
                        {user.email}
                      </td>
                      <td className={`${adminTdClass(theme)} min-w-[7rem] whitespace-nowrap`}>
                        {user.school_id}
                      </td>
                      <td className={`${adminTdClass(theme)} min-w-[5.5rem] whitespace-nowrap`}>
                        {user.role}
                      </td>
                      <td className={`${adminTdClass(theme)} min-w-[6.5rem] whitespace-nowrap`}>
                        {statusBadge(theme, status)}
                      </td>
                      <td className={`${adminTdClass(theme)} min-w-[9rem]`}>
                        {user.department || "—"}
                      </td>
                      <td className={`${adminTdClass(theme)} min-w-[11rem]`}>
                        <div className="flex flex-wrap gap-2">
                          {isPending && !isAdmin && (
                            <button
                              type="button"
                              disabled={reviewingId === user.id}
                              onClick={() => handleReview(user, "approve")}
                              className={primaryButtonSm(theme, "text-xs px-3 py-1.5 whitespace-nowrap")}
                            >
                              <Check size={14} />
                              Approve
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setEditing({ ...user })}
                            className={secondaryButtonSm(theme, "text-xs px-3 py-1.5 whitespace-nowrap")}
                          >
                            <Pencil size={14} />
                            Edit
                          </button>
                          {!isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleDelete(user)}
                              className={dangerButton(theme, "text-xs px-3 py-1.5 whitespace-nowrap")}
                            >
                              <Trash2 size={14} />
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
      </div>

      {editing && (
        <ModalPortal>
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4" role="presentation">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => !saving && setEditing(null)}
            aria-hidden="true"
          />
          <div
            className={`${panelClass(theme)} relative z-10 w-full max-w-lg`}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h2 className="text-lg font-bold">Edit account</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input
                className={inputClass(theme)}
                value={editing.first_name || ""}
                onChange={(e) => setEditing({ ...editing, first_name: e.target.value })}
                placeholder="First name"
              />
              <input
                className={inputClass(theme)}
                value={editing.last_name || ""}
                onChange={(e) => setEditing({ ...editing, last_name: e.target.value })}
                placeholder="Last name"
              />
              <Select
                value={editing.role || "Student"}
                onChange={(e) => setEditing({ ...editing, role: e.target.value })}
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </Select>
              <Select
                value={editing.department || ""}
                onChange={(e) =>
                  setEditing({ ...editing, department: e.target.value, course: "" })
                }
              >
                <option value="">Department</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </Select>
              <Select
                value={editing.course || ""}
                onChange={(e) => setEditing({ ...editing, course: e.target.value })}
                disabled={!editing.department}
              >
                <option value="">Course</option>
                {courses.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
              <Select
                value={editing.year_level || ""}
                onChange={(e) => setEditing({ ...editing, year_level: e.target.value })}
              >
                <option value="">Year level</option>
                {YEAR_LEVELS.map((y) => (
                  <option key={y.value} value={y.value}>
                    {y.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className={secondaryButtonSm(theme)}>
                Cancel
              </button>
              <button type="button" onClick={handleSave} disabled={saving} className={primaryButtonSm(theme)}>
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
}
