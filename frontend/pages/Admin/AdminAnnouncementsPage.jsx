import { useCallback, useMemo, useState } from "react";
import { Heart, Megaphone, MessageCircle, Trash2, X } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import { useAppModal } from "../../contexts/AppModalContext";
import PageHeader from "../../components/ui/PageHeader";
import Input from "../../components/ui/Input";
import Textarea from "../../components/ui/Textarea";
import Select from "../../components/ui/Select";
import ModalShell from "../../components/ui/ModalShell";
import AnnouncementCard from "../../components/AnnouncementCard";
import { PageLoadingSkeleton } from "../../components/ui/PageLoadingSkeleton";
import { usePolling } from "../../hooks/useRealtimeFetch";
import {
  createAdminBroadcast,
  deleteAdminBroadcast,
  fetchAdminBroadcasts,
} from "../../utils/adminData";
import {
  fetchPlatformAnnouncements,
  fetchAdminAnnouncementComments,
  postAdminAnnouncementComment,
  toggleAdminAnnouncementHeart,
  toggleAdminAnnouncementCommentHeart,
  updateAdminAnnouncementComment,
  deleteAdminAnnouncementComment,
} from "../../utils/supabaseData";
import {
  adminTableClass,
  adminTableWrapClass,
  adminTdClass,
  adminThClass,
  adminTableInnerClass,
} from "../../components/admin/adminTableStyles";
import AdminPageError, { formatAdminError } from "../../components/admin/AdminPageError";
import AlertBanner from "../../components/ui/AlertBanner";
import { pageShellClass, panelClass } from "../../utils/themeInputs";
import { primaryButton } from "../../utils/themeButtons";

function formatAdminPublishBanner(audience) {
  if (audience === "faculty") return "Announcement published to faculty.";
  if (audience === "students") return "Announcement published to students.";
  return "Announcement published to students & faculty.";
}

function toAnnouncementCard(row) {
  if (!row) return null;
  return {
    ...row,
    heart_count: Number(row.heart_count ?? 0),
    comment_count: Number(row.comment_count ?? 0),
    user_reacted: Boolean(row.user_reacted),
    author_first_name: row.author_first_name || "ExamNexus",
    author_last_name: row.author_last_name || "Admin",
  };
}

export default function AdminAnnouncements() {
  const { theme } = useTheme();
  const { error, confirm } = useAppModal();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [publishBanner, setPublishBanner] = useState("");
  const [form, setForm] = useState({ title: "", body: "", audience: "all" });
  const [selectedId, setSelectedId] = useState(null);

  const selectedAnnouncement = useMemo(
    () => toAnnouncementCard(rows.find((row) => row.id === selectedId)),
    [rows, selectedId]
  );

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setLoadError("");
      const [broadcasts, platform] = await Promise.all([
        fetchAdminBroadcasts(),
        fetchPlatformAnnouncements().catch(() => []),
      ]);
      const socialById = new Map(
        (platform || []).map((row) => [String(row.id), row])
      );
      setRows(
        (broadcasts || []).map((row) => {
          const social = socialById.get(String(row.id)) || {};
          return {
            ...row,
            heart_count: Number(social.heart_count ?? row.heart_count ?? 0),
            comment_count: Number(social.comment_count ?? row.comment_count ?? 0),
            user_reacted: Boolean(social.user_reacted ?? row.user_reacted),
            author_first_name:
              social.author_first_name || row.author_first_name || "ExamNexus",
            author_last_name:
              social.author_last_name || row.author_last_name || "Admin",
          };
        })
      );
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
      setPublishBanner("");
      const audience = form.audience;
      await createAdminBroadcast(form);
      setForm({ title: "", body: "", audience: "all" });
      setPublishBanner(formatAdminPublishBanner(audience));
      void load(true);
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
      setPublishBanner("");
      if (selectedId === row.id) setSelectedId(null);
      await load(true);
    } catch (err) {
      error(err.message || "Could not delete announcement.");
    }
  };

  const closeViewer = () => setSelectedId(null);

  if (loading && rows.length === 0) return <PageLoadingSkeleton theme={theme} variant="detail" />;

  return (
    <div className={pageShellClass(theme, "mx-auto max-w-5xl")}>
      <PageHeader
        theme={theme}
        icon={Megaphone}
        title="Admin announcements"
        subtitle="Broadcast messages to all users, teachers only, or students only. Open a row to view reactions and comments."
      />

      {loadError && (
        <AdminPageError theme={theme} message={loadError} onRetry={() => load()} />
      )}

      {publishBanner && (
        <AlertBanner
          variant="success"
          inline
          autoDismissMs={5000}
          onDismiss={() => setPublishBanner("")}
          className="px-4 py-2.5 text-sm"
        >
          {publishBanner}
        </AlertBanner>
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
        <div className={adminTableInnerClass()}>
          <table className={adminTableClass(theme)}>
            <thead>
              <tr>
                <th className={adminThClass(theme)}>Title</th>
                <th className={adminThClass(theme)}>Audience</th>
                <th className={adminThClass(theme)}>Activity</th>
                <th className={adminThClass(theme)}>Date</th>
                <th className={adminThClass(theme)}> </th>
              </tr>
            </thead>
            <tbody>
              {!rows.length ? (
                <tr>
                  <td colSpan={5} className={`${adminTdClass(theme)} py-8 text-center`}>
                    No announcements published yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`cursor-pointer transition ${
                      selectedId === row.id
                        ? theme === "dark"
                          ? "bg-emerald-500/10"
                          : "bg-teal-50"
                        : theme === "dark"
                          ? "hover:bg-white/5"
                          : "hover:bg-emerald-50/80"
                    }`}
                    onClick={() => setSelectedId(row.id)}
                    title="Open announcement to view comments and reactions"
                  >
                    <td className={adminTdClass(theme)}>
                      <p className="font-medium">{row.title}</p>
                      {row.body && (
                        <p
                          className={`mt-1 line-clamp-2 text-xs ${
                            theme === "dark" ? "text-gray-400" : "text-gray-600"
                          }`}
                        >
                          {row.body}
                        </p>
                      )}
                    </td>
                    <td className={adminTdClass(theme)}>{row.audience}</td>
                    <td className={adminTdClass(theme)}>
                      <div
                        className={`inline-flex items-center gap-3 text-xs ${
                          theme === "dark" ? "text-gray-300" : "text-gray-700"
                        }`}
                      >
                        <span className="inline-flex items-center gap-1">
                          <Heart size={12} className="text-red-400" />
                          {Number(row.heart_count || 0)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MessageCircle size={12} />
                          {Number(row.comment_count || 0)}
                        </span>
                      </div>
                    </td>
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

      <ModalShell open={Boolean(selectedAnnouncement)} onClose={closeViewer}>
        <div
          className={`en-scale-in relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border shadow-2xl ${
            theme === "dark"
              ? "border-white/10 bg-[#0b1220]"
              : "border-emerald-100 bg-white"
          }`}
          role="dialog"
          aria-modal="true"
          aria-label="Announcement details"
          onClick={(event) => event.stopPropagation()}
        >
          <div
            className={`flex items-center justify-between gap-3 border-b px-4 py-3 ${
              theme === "dark" ? "border-white/10" : "border-emerald-100"
            }`}
          >
            <div>
              <p
                className={`text-sm font-semibold ${
                  theme === "dark" ? "text-white" : "text-gray-900"
                }`}
              >
                Announcement activity
              </p>
              <p
                className={`text-xs ${
                  theme === "dark" ? "text-gray-400" : "text-gray-600"
                }`}
              >
                View reactions, reply to comments, and moderate discussion.
              </p>
            </div>
            <button
              type="button"
              onClick={closeViewer}
              className={`rounded-lg p-2 ${
                theme === "dark"
                  ? "text-gray-300 hover:bg-white/10"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="en-fade-in-up max-h-[min(78vh,44rem)] overflow-y-auto overscroll-contain p-4">
            {selectedAnnouncement ? (
              <AnnouncementCard
                key={selectedAnnouncement.id}
                announcement={selectedAnnouncement}
                allowInteract
                hideSections
                canDelete
                canModerateComments
                autoExpandComments
                onDeleted={() => {
                  setSelectedId(null);
                  void load(true);
                }}
                onUpdated={() => load(true)}
                fetchComments={fetchAdminAnnouncementComments}
                postComment={postAdminAnnouncementComment}
                toggleHeart={toggleAdminAnnouncementHeart}
                toggleCommentHeart={toggleAdminAnnouncementCommentHeart}
                updateComment={updateAdminAnnouncementComment}
                removeComment={deleteAdminAnnouncementComment}
                removeAnnouncement={deleteAdminBroadcast}
              />
            ) : null}
          </div>
        </div>
      </ModalShell>
    </div>
  );
}
