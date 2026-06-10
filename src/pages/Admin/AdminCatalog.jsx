import { useCallback, useMemo, useState } from "react";
import { Building2, Plus, Trash2 } from "lucide-react";
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
import { primaryButtonSm, secondaryButtonSm, dangerButton, primaryButton } from "../../utils/themeButtons";

const TABS = [
  { id: "department", label: "Departments" },
  { id: "course", label: "Courses" },
  { id: "section", label: "Sections" },
];

export default function AdminCatalog() {
  const { theme } = useTheme();
  const { success, error, confirm } = useAppModal();
  const [catalog, setCatalog] = useState([]);
  const [tab, setTab] = useState("department");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState({ code: "", label: "", parent_code: "" });

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

  const handleAdd = async () => {
    if (!form.code.trim() || !form.label.trim()) {
      error("Code and label are required.");
      return;
    }
    try {
      await upsertAdminCatalogItem({
        item_type: tab,
        code: form.code,
        label: form.label,
        parent_code: tab === "course" ? form.parent_code : null,
      });
      await success("Catalog item saved.");
      setForm({ code: "", label: "", parent_code: "" });
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
      await success("Item removed.");
      await load(true);
    } catch (err) {
      error(err.message || "Failed to remove item.");
    }
  };

  if (loading) return <PageLoadingSkeleton theme={theme} variant="list" />;

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
            onClick={() => setTab(item.id)}
            className={secondaryButtonSm(theme, tab === item.id ? "ring-2 ring-emerald-400/40" : "")}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className={`${panelClass(theme)} mb-6`}>
        <h2 className="mb-3 font-semibold">Add {TABS.find((t) => t.id === tab)?.label.slice(0, -1)}</h2>
        <div className="grid gap-3 md:grid-cols-3">
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
        <button type="button" onClick={handleAdd} className={`${primaryButton(theme)} mt-4`}>
          <Plus size={18} />
          Save item
        </button>
      </div>

      <div className={adminTableWrapClass(theme)}>
        <div className="overflow-x-auto">
          <table className={adminTableClass(theme)}>
            <thead>
              <tr>
                <th className={adminThClass(theme)}>Code</th>
                <th className={adminThClass(theme)}>Label</th>
                {tab === "course" && <th className={adminThClass(theme)}>Department</th>}
                <th className={adminThClass(theme)}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!rows.length ? (
                <tr>
                  <td
                    colSpan={tab === "course" ? 4 : 3}
                    className={`${adminTdClass(theme)} py-8 text-center`}
                  >
                    No {TABS.find((t) => t.id === tab)?.label.toLowerCase()} yet.
                  </td>
                </tr>
              ) : (
              rows.map((item) => (
                <tr key={item.id}>
                  <td className={adminTdClass(theme)}>{item.code}</td>
                  <td className={adminTdClass(theme)}>{item.label}</td>
                  {tab === "course" && (
                    <td className={adminTdClass(theme)}>{item.parent_code || "—"}</td>
                  )}
                  <td className={adminTdClass(theme)}>
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      className={dangerButton(theme, "text-xs px-2 py-1")}
                    >
                      <Trash2 size={14} />
                      Remove
                    </button>
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
