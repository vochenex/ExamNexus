import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Users,
  Pencil,
  Trash2,
  Check,
  CheckCheck,
  Search,
  FileSpreadsheet,
  UserPlus,
  ShieldCheck,
} from "lucide-react";
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
import { ProgressLink } from "../../components/ProgressLink";
import {
  deleteAdminUser,
  fetchAdminUsers,
  getAccountStatus,
  getDeletedAccountDaysLeft,
  reviewAdminAccount,
  updateAdminUser,
} from "../../utils/adminData";
import { removeSavedAccountMatch } from "../../utils/savedAccounts";
import { promoteUserToAdmin } from "../../utils/adminPromotion";
import { pageShellClass, inputClass, panelClass } from "../../utils/themeInputs";
import { iconButton, secondaryButtonSm, dangerButton } from "../../utils/themeButtons";
import { getCoursesForDepartment, useAcademicCatalog } from "../../utils/academicOptions";
import { YEAR_LEVELS } from "../../utils/yearLevels";

const ROLES = ["Student", "Faculty", "Admin"];
const STATUSES = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending approval" },
  { value: "approved", label: "Approved" },
  { value: "deleted", label: "Deleted (7-day hold)" },
];

function statusBadge(theme, status, daysLeft = null) {
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
    deleted:
      theme === "dark"
        ? "bg-red-500/15 text-red-300 ring-red-500/30"
        : "bg-red-50 text-red-800 ring-red-200",
  };

  const label =
    value === "deleted" && daysLeft != null
      ? `Deleted · ${daysLeft}d left`
      : value;

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${
        styles[value] || styles.approved
      }`}
    >
      {label}
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
  const location = useLocation();
  const navigate = useNavigate();
  const [importedEmails, setImportedEmails] = useState(
    () =>
      new Set(
        (location.state?.importedEmails || []).map((email) => String(email).trim().toLowerCase())
      )
  );
  const [users, setUsers] = useState([]);
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState(() =>
    location.state?.importedEmails?.length ? "" : "pending"
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [reviewingId, setReviewingId] = useState(null);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [promotingId, setPromotingId] = useState(null);
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

  // Clear router state so a refresh doesn't re-highlight; the Set above keeps it for this visit.
  useEffect(() => {
    if (location.state?.importedEmails) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  const isImported = useCallback(
    (user) => importedEmails.has(String(user?.email || "").trim().toLowerCase()),
    [importedEmails]
  );

  const visibleUsers = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    const matched = !trimmed
      ? users
      : users.filter((user) => {
          const name = `${user.first_name || ""} ${user.last_name || ""}`.trim().toLowerCase();
          const id = String(user.school_id || "").toLowerCase();
          const email = String(user.email || "").toLowerCase();
          return name.includes(trimmed) || id.includes(trimmed) || email.includes(trimmed);
        });
    if (importedEmails.size === 0) return matched;
    return [...matched].sort((a, b) => Number(isImported(b)) - Number(isImported(a)));
  }, [users, searchQuery, importedEmails, isImported]);

  const selectableVisibleUsers = useMemo(
    () =>
      visibleUsers.filter(
        (user) =>
          !isAdminRole(user) &&
          user.id !== currentUser.id &&
          getAccountStatus(user) !== "deleted"
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
    bulkDeleting ||
    reviewingId !== null ||
    deletingId !== null ||
    promotingId !== null ||
    saving;

  const load = useCallback(async (silent = false, overrides = {}) => {
    const nextRole =
      overrides.role !== undefined ? overrides.role : roleFilter;
    const nextStatus =
      overrides.status !== undefined ? overrides.status : statusFilter;
    try {
      if (!silent) setLoading(true);
      setLoadError("");
      const rows = await fetchAdminUsers(
        nextRole || null,
        nextStatus || null
      );
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

  const departments = useAcademicCatalog();
  const courses = getCoursesForDepartment(editing?.department);

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

    const original = users.find((user) => user.id === editing.id);
    const becomingAdmin = role === "admin" && !isAdminRole(original);

    try {
      setSaving(true);
      await updateAdminUser(editing.id, editing);
      // Same flow as the Promote button so they're asked for a 3-digit admin ID at sign-in.
      if (becomingAdmin) await promoteUserToAdmin(editing.id);
      setEditing(null);
      setSaving(false);
      success("Account updated successfully.");
      await load(true);
    } catch (err) {
      setSaving(false);
      error(err.message || "Failed to update account.");
    }
  };

  const handleReview = async (user, action) => {
    if (action !== "approve") return;

    const ok = await confirm({
      title: "Approve account?",
      message: `Approve ${user.first_name} ${user.last_name} (${user.role})? They will be able to log in.`,
      tone: "success",
      confirmLabel: "Approve",
    });
    if (!ok) return;

    try {
      setReviewingId(user.id);
      await reviewAdminAccount(user.id, "approve");
      setReviewingId(null);
      success("Account approved.");
      await load(true);
    } catch (err) {
      setReviewingId(null);
      error(err.message || "Failed to approve account.");
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
      setBulkApproving(false);
      success(`Approved ${count} account${count === 1 ? "" : "s"}.`);
      await load(true);
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
      setBulkApproving(false);
      success(`Approved ${count} account${count === 1 ? "" : "s"}.`);
      await load(true);
    } catch (err) {
      setBulkApproving(false);
      error(err.message || "Failed to approve selected accounts.");
    }
  };

  const handlePromote = async (user) => {
    const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email;
    const ok = await confirm({
      title: "Promote to admin?",
      message: `Give ${name} full administrator access? The next time they sign in they'll be asked to enter their 3-digit admin ID number.`,
      tone: "warning",
      confirmLabel: "Promote",
    });
    if (!ok) return;

    try {
      setPromotingId(user.id);
      await promoteUserToAdmin(user.id);
      setUsers((prev) =>
        prev.map((row) =>
          row.id === user.id ? { ...row, role: "Admin", account_status: "approved" } : row
        )
      );
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(user.id);
        return next;
      });
      setPromotingId(null);
      success(`${name} is now an admin. They'll set a 3-digit admin ID at their next sign-in.`);
      await load(true);
    } catch (err) {
      setPromotingId(null);
      error(err.message || "Failed to promote account.");
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
      setBulkDeleting(false);
      success(successLabel);
      setStatusFilter("deleted");
      await load(true, { status: "deleted" });
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
      message: `Delete ${user.first_name} ${user.last_name}? They stay in Deleted for 1 week, then are removed forever.`,
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
      success("Account moved to Deleted (kept 7 days).");
      setStatusFilter("deleted");
      await load(true, { status: "deleted" });
    } catch (err) {
      setDeletingId(null);
      error(err.message || "Failed to delete account.");
    }
  };

  const handleDeleteSelected = async () => {
    await deleteUsers(selectedVisibleUsers, {
      title: "Delete selected accounts?",
      message: `Delete ${selectedVisibleUsers.length} selected account${
        selectedVisibleUsers.length === 1 ? "" : "s"
      }? They stay in Deleted for 1 week, then are removed forever.`,
      confirmLabel: "Delete selected",
      successLabel: `Moved ${selectedVisibleUsers.length} account${
        selectedVisibleUsers.length === 1 ? "" : "s"
      } to Deleted (kept 7 days).`,
    });
  };

  const handleDeleteAll = async () => {
    const targets = selectableVisibleUsers;
    await deleteUsers(targets, {
      title: "Delete all listed accounts?",
      message: `Delete all ${targets.length} non-admin account${
        targets.length === 1 ? "" : "s"
      } in the current list? They stay in Deleted for 1 week, then are removed forever.`,
      confirmLabel: "Delete all",
      successLabel: `Moved ${targets.length} account${targets.length === 1 ? "" : "s"} to Deleted (kept 7 days).`,
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
        actions={
          <ProgressLink
            to="/admin/accounts/import"
            className={secondaryButtonSm(theme, "inline-flex items-center gap-1.5")}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Import students
          </ProgressLink>
        }
      />

      {loadError && (
        <AdminPageError theme={theme} message={loadError} onRetry={() => load()} />
      )}

      {importedEmails.size > 0 && (
        <div
          className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
            theme === "dark"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          <span className="inline-flex items-center gap-2">
            <UserPlus size={16} className="shrink-0" />
            {importedEmails.size} new student account{importedEmails.size === 1 ? "" : "s"} added.
            They're highlighted at the top of the list.
          </span>
          <button
            type="button"
            onClick={() => setImportedEmails(new Set())}
            className="text-xs font-semibold underline-offset-2 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {statusFilter === "deleted" && (
        <div className={adminNoticeClass(theme)}>
          Recently deleted accounts stay here for 7 days, then are permanently removed.
        </div>
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
          <ProgressButton
            type="button"
            onClick={handleApproveAll}
            loading={bulkApproving}
            loadingLabel="Approving..."
            disabled={busy && !bulkApproving}
            className={`en-btn-primary en-btn-primary-sm ${adminToolbarButtonClass()} text-xs px-3 py-1.5`}
            aria-label="Approve all pending accounts"
            title="Approve all pending accounts"
          >
            <CheckCheck size={14} />
            Approve all
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
        {/* Selection buttons sit last and keep their slot while hidden, so ticking a row never shifts the layout. */}
        {(statusFilter === "" || statusFilter === "pending") && pendingCount > 0 && (
          <ProgressButton
            type="button"
            onClick={handleApproveSelected}
            loading={bulkApproving}
            loadingLabel="Approving..."
            disabled={selectedPendingUsers.length === 0 || (busy && !bulkApproving)}
            aria-hidden={selectedPendingUsers.length === 0 || undefined}
            tabIndex={selectedPendingUsers.length === 0 ? -1 : undefined}
            className={`en-btn-primary en-btn-primary-sm ${adminToolbarButtonClass()} text-xs px-3 py-1.5 ${
              selectedPendingUsers.length === 0 ? "invisible" : ""
            }`}
            aria-label="Approve selected accounts"
            title="Approve selected accounts"
          >
            <Check size={14} />
            Approve selected ({selectedPendingUsers.length})
          </ProgressButton>
        )}
        {selectableVisibleUsers.length > 0 && (
          <ProgressButton
            type="button"
            onClick={handleDeleteSelected}
            loading={bulkDeleting}
            loadingLabel="Deleting..."
            disabled={selectedVisibleUsers.length === 0 || (busy && !bulkDeleting)}
            aria-hidden={selectedVisibleUsers.length === 0 || undefined}
            tabIndex={selectedVisibleUsers.length === 0 ? -1 : undefined}
            className={dangerButton(
              theme,
              `${adminToolbarButtonClass()} text-xs px-3 py-1.5 ${
                selectedVisibleUsers.length === 0 ? "invisible" : ""
              }`
            )}
            aria-label="Delete selected accounts"
            title="Delete selected accounts"
          >
            <Trash2 size={14} />
            Delete selected ({selectedVisibleUsers.length})
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
          {statusFilter === "deleted"
            ? "No recently deleted accounts in the 7-day hold."
            : "No accounts match the current filters."}
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
                  const isDeleted = status === "deleted";
                  const isAdmin = isAdminRole(user);
                  const canSelect = !isAdmin && user.id !== currentUser.id && !isDeleted;
                  const daysLeft = isDeleted ? getDeletedAccountDaysLeft(user) : null;
                  const isNew = isImported(user);

                  return (
                    <tr
                      key={user.id}
                      className={
                        isNew ? (theme === "dark" ? "bg-emerald-500/10" : "bg-emerald-50") : undefined
                      }
                    >
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
                        {isNew && (
                          <span
                            className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                              theme === "dark"
                                ? "bg-emerald-500/20 text-emerald-300"
                                : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            New
                          </span>
                        )}
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
                        {statusBadge(theme, status, daysLeft)}
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
                          {!isDeleted && (
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
                          )}
                          {!isAdmin && !isDeleted && (
                            <ProgressButton
                              type="button"
                              loading={promotingId === user.id}
                              loadingLabel="Promoting account"
                              iconOnly
                              disabled={busy && promotingId !== user.id}
                              onClick={() => handlePromote(user)}
                              className={iconButton(theme, "secondary")}
                              aria-label={`Promote ${user.email} to admin`}
                              title="Promote to admin"
                            >
                              <ShieldCheck size={16} />
                            </ProgressButton>
                          )}
                          {!isAdmin && !isDeleted && (
                            <ProgressButton
                              type="button"
                              loading={deletingId === user.id}
                              loadingLabel="Deleting account"
                              iconOnly
                              disabled={busy && deletingId !== user.id}
                              onClick={() => handleDelete(user)}
                              className={iconButton(theme, "danger")}
                              aria-label={`Delete ${user.email}`}
                              title="Delete (kept 7 days)"
                            >
                              <Trash2 size={16} />
                            </ProgressButton>
                          )}
                          {isDeleted ? (
                            <span
                              className={`text-xs ${
                                theme === "dark" ? "text-gray-500" : "text-gray-500"
                              }`}
                            >
                              Purges automatically
                            </span>
                          ) : null}
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
                {departments.map((d) => (
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
                className="en-btn-primary en-btn-primary-sm"
              >
                Save changes
              </ProgressButton>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}    </div>
  );
}
