import { useCallback, useState } from "react";
import { Megaphone } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import { useAppModal } from "../../contexts/AppModalContext";
import PageHeader from "../../components/ui/PageHeader";
import Select from "../../components/ui/Select";
import Textarea from "../../components/ui/Textarea";
import Input from "../../components/ui/Input";
import { PageLoadingSkeleton } from "../../components/ui/PageLoadingSkeleton";
import { usePolling } from "../../hooks/useRealtimeFetch";
import { createAdminBroadcast, fetchAdminBroadcasts } from "../../utils/adminData";
import { adminTdClass, adminThClass, adminTableClass, adminTableWrapClass } from "../../components/admin/adminTableStyles";
import { pageShellClass, panelClass } from "../../utils/themeInputs";
import AdminPageError, { formatAdminError } from "../../components/admin/AdminPageError";
import { primaryButton } from "../../utils/themeButtons";

export default function AdminAnnouncements() {
  const { theme } = useTheme();
  const { success, error } = useAppModal();
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

  if (loading) return <PageLoadingSkeleton theme={theme} variant="detail" />;

  return (
    <div className={pageShellClass(theme, "mx-auto max-w-5xl")}>
      <PageHeader
        theme={theme}
        icon={Megaphone}
        title="Admin announcements"
        subtitle="Broadcast messages to all users, teachers only, or students only."
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
              </tr>
            </thead>
            <tbody>
              {!rows.length ? (
                <tr>
                  <td colSpan={3} className={`${adminTdClass(theme)} py-8 text-center`}>
                    No announcements published yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                <tr key={row.id}>
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
