import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Megaphone } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import AlertBanner from "../../components/ui/AlertBanner";
import Select from "../../components/ui/Select";
import { useTheme } from "../../layouts/ThemeContext";
import { pageShellClass, panelClass } from "../../utils/themeInputs";
import { formatTargetSectionsLabel } from "../../utils/sections";
import { fetchStudentAnnouncementsHub, fetchPlatformAnnouncements } from "../../utils/supabaseData";
import { resolveStudentId } from "../../utils/authUser";
import { PageLoadingSkeleton } from "../../components/ui/PageLoadingSkeleton";
import PanelContentSkeleton from "../../components/ui/PanelContentSkeleton";
import { usePolling } from "../../hooks/useRealtimeFetch";

export default function StudentAnnouncementsHubPage() {
  const { theme } = useTheme();
  const navigate = useNavigate();
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
      setPlatform(Array.isArray(platformRows) ? platformRows.slice(0, 8) : []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load announcements.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  usePolling(load, []);

  const filtered = useMemo(() => {
    if (!subjectFilter) return announcements;
    return announcements.filter((row) => String(row.subject_id) === String(subjectFilter));
  }, [announcements, subjectFilter]);

  if (loading && announcements.length === 0 && subjects.length === 0) {
    return <PageLoadingSkeleton theme={theme} variant="list" />;
  }

  return (
    <div className={pageShellClass(theme, "mx-auto max-w-4xl")}>
      <PageHeader
        theme={theme}
        icon={Megaphone}
        title="Announcements"
        subtitle="Read-only class and platform updates for your enrolled subjects."
      />

      {error ? (
        <AlertBanner variant="error" className="mb-4">
          {error}
        </AlertBanner>
      ) : null}

      <div className={`${panelClass(theme)} mb-5 space-y-3`}>
        <label
          className={`block text-xs font-semibold uppercase tracking-wide ${
            theme === "dark" ? "text-emerald-400/80" : "text-teal-700"
          }`}
        >
          Filter by subject
        </label>
        <Select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          className="w-full max-w-md"
        >
          <option value="">All subjects</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
        </Select>
      </div>

      {!subjectFilter && platform.length > 0 ? (
        <div className={`${panelClass(theme)} mb-5 space-y-3`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Platform announcements</h2>
            <button
              type="button"
              onClick={() => navigate("/student/platform-announcements")}
              className={`text-xs font-semibold underline-offset-2 hover:underline ${
                theme === "dark" ? "text-emerald-300" : "text-teal-700"
              }`}
            >
              View all
            </button>
          </div>
          <ul className="space-y-2">
            {platform.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/student/platform-announcements?highlight=${item.id}`)
                  }
                  className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                    theme === "dark"
                      ? "border-white/10 bg-white/[0.03] hover:border-emerald-500/30"
                      : "border-emerald-100 bg-emerald-50/40 hover:border-teal-300"
                  }`}
                >
                  <p className="text-sm font-semibold">{item.title}</p>
                  {item.body ? (
                    <p
                      className={`mt-1 line-clamp-2 text-xs ${
                        theme === "dark" ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      {item.body}
                    </p>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className={`${panelClass(theme)} space-y-3`}>
        <h2 className="font-semibold">Class announcements</h2>
        {loading ? (
          <PanelContentSkeleton rows={4} variant="list" />
        ) : filtered.length === 0 ? (
          <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
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
                    navigate(`/student/subject/${row.subject_id}/social?highlight=${row.id}`)
                  }
                  className={`w-full rounded-xl border px-4 py-3 text-left transition ${
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
                        <p
                          className={`mt-1 line-clamp-2 text-xs ${
                            theme === "dark" ? "text-gray-400" : "text-gray-600"
                          }`}
                        >
                          {row.body}
                        </p>
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
  );
}
