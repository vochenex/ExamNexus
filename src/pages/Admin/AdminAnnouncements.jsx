import { useCallback, useState } from "react";
import { Megaphone, Trash2 } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import { useAppModal } from "../../contexts/AppModalContext";
import PageHeader from "../../components/ui/PageHeader";
import Input from "../../components/ui/Input";
import Textarea from "../../components/ui/Textarea";
import Select from "../../components/ui/Select";
import { PageLoadingSkeleton } from "../../components/ui/PageLoadingSkeleton";
import { usePolling } from "../../hooks/useRealtimeFetch";
import {
  createAdminBroadcast,
  deleteAdminBroadcast,
  fetchAdminBroadcasts,
} from "../../utils/adminData";
import {
  adminTableClass,
  adminTableWrapClass,
  adminTdClass,
  adminThClass,
} from "../../components/admin/adminTableStyles";
import AdminPageError, { formatAdminError } from "../../components/admin/AdminPageError";
import { pageShellClass, panelClass } from "../../utils/themeInputs";
import { primaryButton } from "../../utils/themeButtons";

export default function AdminAnnouncements() {
  const { theme } = useTheme();
  const { success, error, confirm } = useAppModal();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", audience: "all" });

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setLoadError("");
      const data = await fetchAdminBroadcasts();
      setRows(data);
    } catch (err) {
      console.error(err);
      setRows([]);
      setLoadError(formatAdminError(err));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  usePolling(load, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      error("Title is required.");
      return;
    }
    try {
      setSaving(true);
      await createAdminBroadcast(form);
      await success("Announcement published.");
      setForm({ title: "", body: "", audience: "all" });
      await load(true);
    } catch (err) {
      error(err.message || "Failed to publish announcement.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRow = async (row) => {
    const ok = await confirm({
      title: "Delete announcement?",
      message: `"${row.title}" will be permanently removed.`,
      tone: "danger",
      confirmLabel: "Delete",
      cancelLabel: "Keep",
    });
    if (!ok) return;
    try {
      await deleteAdminBroadcast(row.id);
      await success("Announcement deleted.");
      await load(true);
    } catch (err) {
      error(err.message || "Could not delete announcement.");
    }
  };

  if (loading && rows.length === 0) return <PageLoadingSkeleton theme={theme} variant="detail" />;

  return (
    <div className={pageShellClass(theme, "mx-auto max-w-5xl")}>
      <PageHeader
        theme={theme}
        icon={Megaphone}
        title="Admin announcements"
        subtitle="Broadcast messages to all users, teachers only, or students only. Tap a row to delete."
      />

      {loadError && (
        <AdminPageError theme={theme} message={loadError} onRetry={() => load()} />
      )}

      <form onSubmit={handleSubmit} className={`${panelClass(theme)} mb-6 space-y-4`}>
        <div>
          <label className={`mb-1.5 block text-sm font-medium ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>
            Title
          </label>
          <Input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>
        <div>
          <label className={`mb-1.5 block text-sm font-medium ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>
            Message
          </label>
          <Textarea
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            rows={4}
          />
        </div>
        <div>
          <label className={`mb-1.5 block text-sm font-medium ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>
            Audience
          </label>
          <Select
            value={form.audience}
            onChange={(e) => setForm({ ...form, audience: e.target.value })}
          >
            <option value="all">Everyone (teachers & students)</option>
            <option value="faculty">Teachers only</option>
            <option value="students">Students only</option>
          </Select>
        </div>
        <button type="submit" disabled={saving} className={primaryButton(theme, "disabled:opacity-60")}>
          {saving ? "Publishing..." : "Publish announcement"}
        </button>
      </form>

      <div className={adminTableWrapClass(theme)}>
        <div className="en-inner-scroll max-h-[28rem] overflow-auto">
          <table className={adminTableClass(theme)}>
            <thead>
              <tr>
                <th className={adminThClass(theme)}>Title</th>
                <th className={adminThClass(theme)}>Audience</th>
                <th className={adminThClass(theme)}>Date</th>
                <th className={adminThClass(theme)}> </th>
              </tr>
            </thead>
            <tbody>
              {!rows.length ? (
                <tr>
                  <td colSpan={4} className={`${adminTdClass(theme)} py-8 text-center`}>
                    No announcements published yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                <tr
                  key={row.id}
                  className={`cursor-pointer transition ${
                    theme === "dark" ? "hover:bg-white/5" : "hover:bg-emerald-50/80"
                  }`}
                  onClick={() => handleDeleteRow(row)}
                  title="Click to delete this announcement"
                >
                  <td className={adminTdClass(theme)}>
                    <p className="font-medium">{row.title}</p>
                    {row.body && (
                      <p className={`mt-1 text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                        {row.body}
                      </p>
                    )}
                  </td>
                  <td className={adminTdClass(theme)}>{row.audience}</td>
                  <td className={adminTdClass(theme)}>
                    {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
                  </td>
                  <td className={adminTdClass(theme)}>
                    <button
                      type="button"
                      className={`inline-flex rounded-lg p-2 ${
                        theme === "dark"
                          ? "text-red-400 hover:bg-red-500/20"
                          : "text-red-600 hover:bg-red-50"
                      }`}
                      aria-label={`Delete ${row.title}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDeleteRow(row);
                      }}
                    >
                      <Trash2 size={16} />
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
