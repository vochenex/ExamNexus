import { useCallback, useMemo, useState } from "react";
import { Users, Pencil, Trash2, Check, CheckCheck, X, Search } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import { useAppModal } from "../../contexts/AppModalContext";
import PageHeader from "../../components/ui/PageHeader";
import Select from "../../components/ui/Select";
import ModalPortal from "../../components/ui/ModalPortal";
import ProgressButton from "../../components/ui/ProgressButton";
import { PageLoadingSkeleton } from "../../components/ui/PageLoadingSkeleton";
import { usePolling } from "../../hooks/useRealtimeFetch";
import {
  adminTableClass,
  adminTableWrapClass,
  adminTdClass,
  adminThClass,
  adminNoticeClass,
  adminToolbarClass,
  adminSearchWrapClass,
  adminToolbarActionsClass,
  adminFilterSelectClass,
  adminToolbarButtonClass,
  adminTableInnerClass,
} from "../../components/admin/adminTableStyles";
import AdminPageError, { formatAdminError } from "../../components/admin/AdminPageError";
import {
  deleteAdminUser,
  fetchAdminUsers,
  getAccountStatus,
  reviewAdminAccount,
  updateAdminUser,
} from "../../utils/adminData";
import { removeSavedAccountMatch } from "../../utils/savedAccounts";
import { pageShellClass, inputClass, panelClass } from "../../utils/themeInputs";
import { iconButton, primaryButtonSm, secondaryButtonSm, dangerButton } from "../../utils/themeButtons";
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

function isAdminRole(user) {
  return String(user?.role || "").toLowerCase() === "admin";
}

function clearLocalSavedLogin(user) {
  removeSavedAccountMatch({ email: user?.email, userId: user?.id });
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
  const [bulkApproving, setBulkApproving] = useState(false);
  const [bulkRejecting, setBulkRejecting] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const currentUser = useMemo(
    () => JSON.parse(localStorage.getItem("examnexus_user") || "{}"),
    []
  );

  const pendingUsers = useMemo(
    () =>
      users.filter(
        (user) => getAccountStatus(user) === "pending" && !isAdminRole(user)
      ),
    [users]
  );

  const pendingCount = pendingUsers.length;

  const visibleUsers = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) return users;
    return users.filter((user) => {
      const name = `${user.first_name || ""} ${user.last_name || ""}`.trim().toLowerCase();
      const id = String(user.school_id || "").toLowerCase();
      const email = String(user.email || "").toLowerCase();
      return name.includes(trimmed) || id.includes(trimmed) || email.includes(trimmed);
    });
  }, [users, searchQuery]);

  const selectableVisibleUsers = useMemo(
    () =>
      visibleUsers.filter(
        (user) => !isAdminRole(user) && user.id !== currentUser.id
      ),
    [visibleUsers, currentUser.id]
  );

  const selectedVisibleUsers = useMemo(
    () => selectableVisibleUsers.filter((user) => selectedIds.has(user.id)),
    [selectableVisibleUsers, selectedIds]
  );

  const selectedPendingUsers = useMemo(
    () =>
      selectedVisibleUsers.filter(
        (user) => getAccountStatus(user) === "pending"
      ),
    [selectedVisibleUsers]
  );

  const allVisibleSelected =
    selectableVisibleUsers.length > 0 &&
    selectableVisibleUsers.every((user) => selectedIds.has(user.id));

  const busy =
    bulkApproving ||
    bulkRejecting ||
    bulkDeleting ||
    reviewingId !== null ||
    deletingId !== null ||
    saving;

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setLoadError("");
      const rows = await fetchAdminUsers(roleFilter || null, statusFilter || null);
      setUsers(rows);
      setSelectedIds((prev) => {
        const next = new Set();
        for (const id of prev) {
          if (rows.some((row) => row.id === id)) next.add(id);
        }
        return next;
      });
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

  const toggleSelected = (userId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const user of selectableVisibleUsers) next.delete(user.id);
      } else {
        for (const user of selectableVisibleUsers) next.add(user.id);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!editing) return;

    const role = String(editing.role || "").toLowerCase();
    if (!editing.department) {
      error("Department is required before saving this account.");
      return;
    }
    if (role.includes("student") && !editing.course) {
      error("Course is required for student accounts.");
      return;
    }

    try {
      setSaving(true);
      await updateAdminUser(editing.id, editing);
      setEditing(null);
      await load(true);
      setSaving(false);
      await success("Account updated successfully.");
    } catch (err) {
      setSaving(false);
      error(err.message || "Failed to update account.");
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
      await load(true);
      setReviewingId(null);
      await success(action === "approve" ? "Account approved." : "Account rejected.");
    } catch (err) {
      setReviewingId(null);
      error(err.message || `Failed to ${action} account.`);
    }
  };

  const handleApproveAll = async () => {
    if (!pendingUsers.length) {
      error("No pending accounts to approve.");
      return;
    }

    const ok = await confirm({
      title: "Approve all pending accounts?",
      message: `Approve ${pendingUsers.length} account${pendingUsers.length === 1 ? "" : "s"}? Each user will be able to log in.`,
      tone: "success",
      confirmLabel: "Approve all",
    });
    if (!ok) return;

    try {
      setBulkApproving(true);
      for (const user of pendingUsers) {
        await reviewAdminAccount(user.id, "approve");
      }
      const count = pendingUsers.length;
      await load(true);
      setBulkApproving(false);
      await success(`Approved ${count} account${count === 1 ? "" : "s"}.`);
    } catch (err) {
      setBulkApproving(false);
      error(err.message || "Failed to approve all accounts.");
    }
  };

  const handleApproveSelected = async () => {
    if (!selectedPendingUsers.length) {
      error("Select at least one pending account to approve.");
      return;
    }

    const ok = await confirm({
      title: "Approve selected accounts?",
      message: `Approve ${selectedPendingUsers.length} selected account${
        selectedPendingUsers.length === 1 ? "" : "s"
      }?`,
      tone: "success",
      confirmLabel: "Approve selected",
    });
    if (!ok) return;

    try {
      setBulkApproving(true);
      for (const user of selectedPendingUsers) {
        await reviewAdminAccount(user.id, "approve");
      }
      const count = selectedPendingUsers.length;
      setSelectedIds(new Set());
      await load(true);
      setBulkApproving(false);
      await success(`Approved ${count} account${count === 1 ? "" : "s"}.`);
    } catch (err) {
      setBulkApproving(false);
      error(err.message || "Failed to approve selected accounts.");
    }
  };

  const handleRejectAll = async () => {
    if (!pendingUsers.length) {
      error("No pending accounts to reject.");
      return;
    }

    const ok = await confirm({
      title: "Reject all pending accounts?",
      message: `Reject ${pendingUsers.length} account${pendingUsers.length === 1 ? "" : "s"}? Those users will not be able to use the platform.`,
      tone: "danger",
      confirmLabel: "Reject all",
    });
    if (!ok) return;

    try {
      setBulkRejecting(true);
      for (const user of pendingUsers) {
        await reviewAdminAccount(user.id, "reject");
      }
      const count = pendingUsers.length;
      await load(true);
      setBulkRejecting(false);
      await success(`Rejected ${count} account${count === 1 ? "" : "s"}.`);
    } catch (err) {
      setBulkRejecting(false);
      error(err.message || "Failed to reject all accounts.");
    }
  };

  const deleteUsers = async (targets, { title, message, confirmLabel, successLabel }) => {
    if (!targets.length) {
      error("No accounts available to delete.");
      return;
    }

    const ok = await confirm({
      title,
      message,
      tone: "danger",
      confirmLabel,
    });
    if (!ok) return;

    const ids = new Set(targets.map((user) => user.id));
    try {
      setBulkDeleting(true);
      for (const user of targets) {
        setDeletingId(user.id);
        await deleteAdminUser(user.id);
        clearLocalSavedLogin(user);
      }
      setUsers((prev) => prev.filter((user) => !ids.has(user.id)));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
      setDeletingId(null);
      await load(true);
      setBulkDeleting(false);
      await success(successLabel);
    } catch (err) {
      setDeletingId(null);
      setBulkDeleting(false);
      error(err.message || "Failed to delete account.");
    }
  };

  const handleDelete = async (user) => {
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
      setDeletingId(user.id);
      await deleteAdminUser(user.id);
      clearLocalSavedLogin(user);
      setUsers((prev) => prev.filter((row) => row.id !== user.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(user.id);
        return next;
      });
      setDeletingId(null);
      await load(true);
      await success("Account deleted.");
    } catch (err) {
      setDeletingId(null);
      error(err.message || "Failed to delete account.");
    }
  };

  const handleDeleteSelected = async () => {
    await deleteUsers(selectedVisibleUsers, {
      title: "Delete selected accounts?",
      message: `Permanently delete ${selectedVisibleUsers.length} selected account${
        selectedVisibleUsers.length === 1 ? "" : "s"
      }? This cannot be undone.`,
      confirmLabel: "Delete selected",
      successLabel: `Deleted ${selectedVisibleUsers.length} account${
        selectedVisibleUsers.length === 1 ? "" : "s"
      }.`,
    });
  };

  const handleDeleteAll = async () => {
    const targets = selectableVisibleUsers;
    await deleteUsers(targets, {
      title: "Delete all listed accounts?",
      message: `Permanently delete all ${targets.length} non-admin account${
        targets.length === 1 ? "" : "s"
      } in the current list? This cannot be undone.`,
      confirmLabel: "Delete all",
      successLabel: `Deleted ${targets.length} account${targets.length === 1 ? "" : "s"}.`,
    });
  };

  if (loading && users.length === 0) return <PageLoadingSkeleton theme={theme} variant="list" />;

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
        <div className={adminNoticeClass(theme)}>
          {pendingCount} account{pendingCount === 1 ? "" : "s"} waiting for your approval.
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
            aria-label="Search accounts by name, school ID, or email"
          />
        </div>
        <div className={adminToolbarActionsClass()}>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={adminFilterSelectClass()}
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
          className={adminFilterSelectClass()}
        >
          <option value="">All roles</option>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </Select>
        {statusFilter === "pending" && pendingCount > 0 && (
          <>
            <ProgressButton
              type="button"
              onClick={handleApproveAll}
              loading={bulkApproving}
              loadingLabel="Approving..."
              disabled={busy && !bulkApproving}
              className={primaryButtonSm(theme, `${adminToolbarButtonClass()} text-xs px-3 py-1.5`)}
              aria-label="Approve all pending accounts"
              title="Approve all pending accounts"
            >
              <CheckCheck size={14} />
              Approve all
            </ProgressButton>
            <ProgressButton
              type="button"
              onClick={handleRejectAll}
              loading={bulkRejecting}
              loadingLabel="Rejecting..."
              disabled={busy && !bulkRejecting}
              className={dangerButton(theme, `${adminToolbarButtonClass()} text-xs px-3 py-1.5`)}
              aria-label="Reject all pending accounts"
              title="Reject all pending accounts"
            >
              <X size={14} />
              Reject all
            </ProgressButton>
          </>
        )}
        {selectedPendingUsers.length > 0 && (
          <ProgressButton
            type="button"
            onClick={handleApproveSelected}
            loading={bulkApproving}
            loadingLabel="Approving..."
            disabled={busy && !bulkApproving}
            className={primaryButtonSm(theme, `${adminToolbarButtonClass()} text-xs px-3 py-1.5`)}
            aria-label="Approve selected accounts"
            title="Approve selected accounts"
          >
            <Check size={14} />
            Approve selected ({selectedPendingUsers.length})
          </ProgressButton>
        )}
        {selectedVisibleUsers.length > 0 && (
          <ProgressButton
            type="button"
            onClick={handleDeleteSelected}
            loading={bulkDeleting}
            loadingLabel="Deleting..."
            disabled={busy && !bulkDeleting}
            className={dangerButton(theme, `${adminToolbarButtonClass()} text-xs px-3 py-1.5`)}
            aria-label="Delete selected accounts"
            title="Delete selected accounts"
          >
            <Trash2 size={14} />
            Delete selected ({selectedVisibleUsers.length})
          </ProgressButton>
        )}
        {selectableVisibleUsers.length > 0 && (
          <ProgressButton
            type="button"
            onClick={handleDeleteAll}
            loading={bulkDeleting}
            loadingLabel="Deleting..."
            disabled={busy && !bulkDeleting}
            className={dangerButton(theme, `${adminToolbarButtonClass()} text-xs px-3 py-1.5`)}
            aria-label="Delete all listed accounts"
            title="Delete all listed non-admin accounts"
          >
            <Trash2 size={14} />
            Delete all
          </ProgressButton>
        )}
        </div>
      </div>

      <div className={`${adminTableWrapClass(theme)} min-w-0`}>
      {visibleUsers.length === 0 ? (
        <div
          className={`flex min-h-[12rem] w-full items-center justify-center px-4 py-10 text-center text-sm ${
            theme === "dark" ? "text-gray-400" : "text-gray-600"
          }`}
        >
          No accounts match the current filters.
        </div>
      ) : (
        <div className={adminTableInnerClass()}>
          <table className={`${adminTableClass(theme)} min-w-[76rem]`}>
            <thead>
              <tr>
                <th className={`${adminThClass(theme)} w-10`}>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    disabled={selectableVisibleUsers.length === 0 || busy}
                    aria-label="Select all listed accounts"
                    className="h-4 w-4 rounded border-emerald-400/40"
                  />
                </th>
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
              {visibleUsers.map((user, index) => {
                  const status = getAccountStatus(user);
                  const isPending = status === "pending";
                  const isAdmin = isAdminRole(user);
                  const canSelect = !isAdmin && user.id !== currentUser.id;

                  return (
                    <tr key={user.id}>
                      <td className={adminTdClass(theme)}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(user.id)}
                          onChange={() => toggleSelected(user.id)}
                          disabled={!canSelect || busy}
                          aria-label={`Select ${user.email}`}
                          className="h-4 w-4 rounded border-emerald-400/40"
                        />
                      </td>
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
                            <ProgressButton
                              type="button"
                              loading={reviewingId === user.id}
                              loadingLabel="Approving account"
                              iconOnly
                              disabled={busy && reviewingId !== user.id}
                              onClick={() => handleReview(user, "approve")}
                              className={iconButton(theme, "primary")}
                              aria-label={`Approve ${user.email}`}
                              title="Approve"
                            >
                              <Check size={16} />
                            </ProgressButton>
                          )}
                          <button
                            type="button"
                            onClick={() => setEditing({ ...user })}
                            className={iconButton(theme, "secondary")}
                            aria-label={`Edit ${user.email}`}
                            title="Edit"
                            disabled={busy}
                          >
                            <Pencil size={16} />
                          </button>
                          {!isAdmin && (
                            <ProgressButton
                              type="button"
                              loading={deletingId === user.id}
                              loadingLabel="Deleting account"
                              iconOnly
                              disabled={busy && deletingId !== user.id}
                              onClick={() => handleDelete(user)}
                              className={iconButton(theme, "danger")}
                              aria-label={`Delete ${user.email}`}
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </ProgressButton>
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
              <button
                type="button"
                onClick={() => setEditing(null)}
                disabled={saving}
                className={secondaryButtonSm(theme, "disabled:opacity-60")}
              >
                Cancel
              </button>
              <ProgressButton
                type="button"
                onClick={handleSave}
                loading={saving}
                loadingLabel="Saving..."
                disabled={deletingId !== null}
                className={primaryButtonSm(theme)}
              >
                Save changes
              </ProgressButton>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
}
