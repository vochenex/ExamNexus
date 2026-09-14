import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Megaphone } from "lucide-react";
import AnnouncementCard from "../../components/AnnouncementCard";
import PageHeader from "../../components/ui/PageHeader";
import AlertBanner from "../../components/ui/AlertBanner";
import Select from "../../components/ui/Select";
import { useTheme } from "../../layouts/ThemeContext";
import { pageShellClass, panelClass } from "../../utils/themeInputs";
import { formatTargetSectionsLabel } from "../../utils/sections";
import {
  fetchStudentAnnouncementsHub,
  fetchPlatformAnnouncements,
  fetchAdminAnnouncementComments,
  postAdminAnnouncementComment,
  toggleAdminAnnouncementHeart,
  toggleAdminAnnouncementCommentHeart,
  updateAdminAnnouncementComment,
  deleteAdminAnnouncementComment,
} from "../../utils/supabaseData";
import { isAdminUser } from "../../utils/adminData";
import { resolveStudentId } from "../../utils/authUser";
import { PageLoadingSkeleton } from "../../components/ui/PageLoadingSkeleton";
import PanelContentSkeleton from "../../components/ui/PanelContentSkeleton";
import { usePolling } from "../../hooks/useRealtimeFetch";

export default function StudentAnnouncementsHubPage() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const openComments = searchParams.get("comments") === "1";
  const cachedUser = JSON.parse(localStorage.getItem("examnexus_user") || "{}");
  const canModerateComments = isAdminUser(cachedUser);

  const [subjects, setSubjects] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [platform, setPlatform] = useState([]);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError("");
      const studentId = await resolveStudentId();
      if (!studentId) {
        setError("Please log in again.");
        return;
      }

      const [{ subjects: enrolled, announcements: rows }, platformRows] = await Promise.all([
        fetchStudentAnnouncementsHub(studentId),
        fetchPlatformAnnouncements().catch(() => []),
      ]);

      setSubjects(enrolled || []);
      setAnnouncements(rows || []);
      setPlatform(Array.isArray(platformRows) ? platformRows : []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load announcements.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  usePolling(load, []);

  useEffect(() => {
    if (!highlightId || loading) return;
    const timer = setTimeout(() => {
      document
        .getElementById(`announcement-${highlightId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 350);
    return () => clearTimeout(timer);
  }, [highlightId, loading, platform.length]);

  const filtered = useMemo(() => {
    if (!subjectFilter) return announcements;
    return announcements.filter((row) => String(row.subject_id) === String(subjectFilter));
  }, [announcements, subjectFilter]);

  if (loading && announcements.length === 0 && subjects.length === 0 && platform.length === 0) {
    return <PageLoadingSkeleton theme={theme} variant="list" />;
  }

  const muted = theme === "dark" ? "text-gray-400" : "text-gray-600";

  return (
    <div className={pageShellClass(theme, "mx-auto max-w-5xl")}>
      <PageHeader
        theme={theme}
        icon={Megaphone}
        title="Announcements"
        subtitle="Faculty class announcements and messages from administrators."
      />

      {error ? (
        <AlertBanner variant="error" className="mb-4">
          {error}
        </AlertBanner>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <div className={`${panelClass(theme, "!p-3 sm:!p-4")} space-y-3`}>
          <h2 className="text-sm font-semibold sm:text-base">Admin announcements</h2>
          {loading && platform.length === 0 ? (
            <PanelContentSkeleton rows={3} variant="list" />
          ) : platform.length === 0 ? (
            <p className={`text-sm ${muted}`}>No admin announcements yet.</p>
          ) : (
            <div className="space-y-3">
              {platform.map((announcement) => (
                <AnnouncementCard
                  key={announcement.id}
                  announcement={announcement}
                  allowInteract
                  hideSections
                  canModerateComments={canModerateComments}
                  highlighted={highlightId === String(announcement.id)}
                  autoExpandComments={
                    openComments && highlightId === String(announcement.id)
                  }
                  onUpdated={() => load(true)}
                  fetchComments={fetchAdminAnnouncementComments}
                  postComment={postAdminAnnouncementComment}
                  toggleHeart={toggleAdminAnnouncementHeart}
                  toggleCommentHeart={toggleAdminAnnouncementCommentHeart}
                  updateComment={updateAdminAnnouncementComment}
                  removeComment={deleteAdminAnnouncementComment}
                />
              ))}
            </div>
          )}
        </div>

        <div className={`${panelClass(theme, "!p-3 sm:!p-4")} space-y-3`}>
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold sm:text-base">Class announcements</h2>
            <div className="w-full">
              <label
                className={`mb-1 block text-[10px] font-semibold uppercase tracking-wide ${
                  theme === "dark" ? "text-emerald-400/80" : "text-teal-700"
                }`}
              >
                Filter by subject
              </label>
              <Select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="w-full"
              >
                <option value="">All subjects</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {loading && filtered.length === 0 ? (
            <PanelContentSkeleton rows={4} variant="list" />
          ) : filtered.length === 0 ? (
            <p className={`text-sm ${muted}`}>
              {subjectFilter
                ? "No announcements for this subject yet."
                : "No class announcements yet."}
            </p>
          ) : (
            <ul className="space-y-2">
              {filtered.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/student/subject/${row.subject_id}/social?highlight=${row.id}`
                      )
                    }
                    className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                      theme === "dark"
                        ? "border-white/10 bg-white/[0.03] hover:border-emerald-500/30"
                        : "border-emerald-100 bg-emerald-50/40 hover:border-teal-300"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{row.title}</p>
                        <p
                          className={`mt-1 text-xs ${
                            theme === "dark" ? "text-emerald-300/80" : "text-teal-700"
                          }`}
                        >
                          {row.subject_name}
                          {" · "}
                          {formatTargetSectionsLabel(row.target_sections)}
                        </p>
                        {row.body ? (
                          <p className={`mt-1 line-clamp-2 text-xs ${muted}`}>{row.body}</p>
                        ) : null}
                      </div>
                      <span
                        className={`shrink-0 text-[11px] ${
                          theme === "dark" ? "text-gray-500" : "text-gray-500"
                        }`}
                      >
                        {row.created_at ? new Date(row.created_at).toLocaleString() : ""}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
