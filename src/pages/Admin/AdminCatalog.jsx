import { useCallback, useMemo, useState } from "react";
import { Building2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import { useAppModal } from "../../contexts/AppModalContext";
import PageHeader from "../../components/ui/PageHeader";
import Select from "../../components/ui/Select";
import { PageLoadingSkeleton } from "../../components/ui/PageLoadingSkeleton";
import { usePolling } from "../../hooks/useRealtimeFetch";
import {
  deleteAdminCatalogItem,
  fetchAdminCatalog,
  upsertAdminCatalogItem,
} from "../../utils/adminData";
import {
  adminTableClass,
  adminTableWrapClass,
  adminTdClass,
  adminThClass,
} from "../../components/admin/adminTableStyles";
import { pageShellClass, inputClass, panelClass } from "../../utils/themeInputs";
import AdminPageError, { formatAdminError } from "../../components/admin/AdminPageError";
import {
  iconButton,
  primaryButtonSm,
  secondaryButtonSm,
  primaryButton,
} from "../../utils/themeButtons";

const TABS = [
  { id: "department", label: "Departments" },
  { id: "course", label: "Courses" },
  { id: "section", label: "Sections" },
];

const EMPTY_FORM = { code: "", label: "", parent_code: "" };

export default function AdminCatalog() {
  const { theme } = useTheme();
  const { success, error, confirm } = useAppModal();
  const [catalog, setCatalog] = useState([]);
  const [tab, setTab] = useState("department");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  // Separate draft per tab so values never bleed across Departments/Courses/Sections.
  const [forms, setForms] = useState({
    department: { ...EMPTY_FORM },
    course: { ...EMPTY_FORM },
    section: { ...EMPTY_FORM },
  });
  const [editingId, setEditingId] = useState(null);

  const form = forms[tab] || EMPTY_FORM;

  const setForm = (next) => {
    setForms((prev) => ({
      ...prev,
      [tab]: typeof next === "function" ? next(prev[tab] || EMPTY_FORM) : next,
    }));
  };

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setLoadError("");
      const rows = await fetchAdminCatalog();
      setCatalog(rows);
    } catch (err) {
      console.error(err);
      setCatalog([]);
      setLoadError(formatAdminError(err));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  usePolling(load, []);

  const rows = useMemo(
    () => catalog.filter((item) => item.item_type === tab),
    [catalog, tab]
  );

  const departments = useMemo(
    () => catalog.filter((item) => item.item_type === "department"),
    [catalog]
  );

  const switchTab = (nextTab) => {
    setTab(nextTab);
    setEditingId(null);
  };

  const clearCurrentForm = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setForm({
      code: item.code || "",
      label: item.label || "",
      parent_code: item.parent_code || "",
    });
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.label.trim()) {
      error("Code and label are required.");
      return;
    }
    if (tab === "course" && !form.parent_code) {
      error("Select a department for this course.");
      return;
    }
    try {
      await upsertAdminCatalogItem({
        id: editingId || null,
        item_type: tab,
        code: form.code,
        label: form.label,
        parent_code: tab === "course" ? form.parent_code : null,
      });
      await success(editingId ? "Catalog item updated." : "Catalog item saved.");
      clearCurrentForm();
      await load(true);
    } catch (err) {
      error(err.message || "Failed to save catalog item.");
    }
  };

  const handleDelete = async (item) => {
    const ok = await confirm({
      title: "Remove item?",
      message: `Remove ${item.label}?`,
      tone: "danger",
      confirmLabel: "Remove",
    });
    if (!ok) return;
    try {
      await deleteAdminCatalogItem(item.id);
      if (editingId === item.id) clearCurrentForm();
      await success("Item removed.");
      await load(true);
    } catch (err) {
      error(err.message || "Failed to remove item.");
    }
  };

  if (loading && catalog.length === 0) return <PageLoadingSkeleton theme={theme} variant="list" />;

  const singular = TABS.find((t) => t.id === tab)?.label.slice(0, -1) || "Item";

  return (
    <div className={pageShellClass(theme, "mx-auto max-w-7xl")}>
      <PageHeader
        theme={theme}
        icon={Building2}
        title="Departments, courses & sections"
        subtitle="Manage the academic catalog used during signup and enrollment."
      />

      {loadError && (
        <AdminPageError theme={theme} message={loadError} onRetry={() => load()} />
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => switchTab(item.id)}
            className={secondaryButtonSm(
              theme,
              tab === item.id ? "ring-2 ring-emerald-400/40" : ""
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className={`${panelClass(theme, "mb-6 !p-4")}`}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-semibold">
            {editingId ? `Edit ${singular}` : `Add ${singular}`}
          </h2>
          {editingId && (
            <button
              type="button"
              onClick={clearCurrentForm}
              className={iconButton(theme, "secondary")}
              aria-label="Cancel edit"
              title="Cancel edit"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <div
          className={`grid gap-3 ${
            tab === "course" ? "md:grid-cols-3" : "md:grid-cols-2"
          }`}
        >
          <input
            className={inputClass(theme)}
            placeholder="Code (e.g. CCS)"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
          />
          <input
            className={inputClass(theme)}
            placeholder="Label"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
          />
          {tab === "course" && (
            <Select
              value={form.parent_code}
              onChange={(e) => setForm({ ...form, parent_code: e.target.value })}
            >
              <option value="">Department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.code}>
                  {d.label}
                </option>
              ))}
            </Select>
          )}
        </div>
        <button type="button" onClick={handleSave} className={`${primaryButton(theme)} mt-3`}>
          <Plus size={18} />
          {editingId ? "Update item" : "Save item"}
        </button>
      </div>

      <div className={adminTableWrapClass(theme)}>
        <div className="en-inner-scroll max-h-[28rem] overflow-auto">
          <table className={`${adminTableClass(theme)} min-w-[40rem]`}>
            <thead>
              <tr>
                <th className={`${adminThClass(theme)} w-12`}>#</th>
                <th className={adminThClass(theme)}>Code</th>
                <th className={adminThClass(theme)}>Label</th>
                {tab === "course" && (
                  <th className={adminThClass(theme)}>Department</th>
                )}
                <th className={adminThClass(theme)}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!rows.length ? (
                <tr>
                  <td
                    colSpan={tab === "course" ? 5 : 4}
                    className={`${adminTdClass(theme)} py-8 text-center`}
                  >
                    No {TABS.find((t) => t.id === tab)?.label.toLowerCase()} yet.
                  </td>
                </tr>
              ) : (
                rows.map((item, index) => (
                  <tr key={item.id}>
                    <td className={`${adminTdClass(theme)} tabular-nums text-gray-500`}>
                      {index + 1}
                    </td>
                    <td className={adminTdClass(theme)}>{item.code}</td>
                    <td className={adminTdClass(theme)}>{item.label}</td>
                    {tab === "course" && (
                      <td className={adminTdClass(theme)}>
                        {item.parent_code || "—"}
                      </td>
                    )}
                    <td className={adminTdClass(theme)}>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className={iconButton(theme, "secondary")}
                          aria-label={`Edit ${item.label}`}
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          className={iconButton(theme, "danger")}
                          aria-label={`Remove ${item.label}`}
                          title="Remove"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
