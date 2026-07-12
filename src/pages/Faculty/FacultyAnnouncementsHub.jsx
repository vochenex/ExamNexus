import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Megaphone } from "lucide-react";
import BackButton from "../../components/BackButton";
import SectionPicker from "../../components/SectionPicker";
import PageHeader from "../../components/ui/PageHeader";
import AlertBanner from "../../components/ui/AlertBanner";
import Input from "../../components/ui/Input";
import Textarea from "../../components/ui/Textarea";
import ChipToggle from "../../components/ui/ChipToggle";
import { useTheme } from "../../layouts/ThemeContext";
import { useAppModal } from "../../contexts/AppModalContext";
import { pageShellClass, panelClass } from "../../utils/themeInputs";
import { getSectionsForSubjects, normalizeTargetSections } from "../../utils/sections";
import {
  createFacultyAnnouncements,
  fetchFacultyAnnouncements,
  fetchTeacherSubjects,
} from "../../utils/supabaseData";
import {
  canFacultyManageSubjects,
  FACULTY_AVATAR_REQUIRED_MESSAGE,
  isFacultyRole,
} from "../../utils/avatar";
import { PageLoadingSkeleton } from "../../components/ui/PageLoadingSkeleton";
import { usePolling } from "../../hooks/useRealtimeFetch";
import {
  adminTableClass,
  adminTableWrapClass,
  adminTdClass,
  adminThClass,
} from "../../components/admin/adminTableStyles";
import { primaryButton } from "../../utils/themeButtons";

export default function FacultyAnnouncementsHub() {
  const { theme } = useTheme();
  const { warning: showWarning } = useAppModal();
  const navigate = useNavigate();
  const cachedUser = JSON.parse(localStorage.getItem("examnexus_user") || "{}");

  const [subjects, setSubjects] = useState([]);
  const [posted, setPosted] = useState([]);
  const [scope, setScope] = useState("all");
  const [selectedSubjectIds, setSelectedSubjectIds] = useState([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetSections, setTargetSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const facultyCanManage = canFacultyManageSubjects(cachedUser);

  const announcementSections = useMemo(() => {
    if (scope === "specific" && selectedSubjectIds.length > 0) {
      return getSectionsForSubjects(
        subjects.filter((subject) => selectedSubjectIds.includes(subject.id))
      );
    }
    return getSectionsForSubjects(subjects);
  }, [scope, selectedSubjectIds, subjects]);

  useEffect(() => {
    setTargetSections((prev) =>
      normalizeTargetSections(prev, announcementSections)
    );
  }, [announcementSections]);

  useEffect(() => {
    if (isFacultyRole(cachedUser.role) && !facultyCanManage) {
      showWarning(FACULTY_AVATAR_REQUIRED_MESSAGE, "Profile photo required");
      navigate("/faculty/profile");
    }
  }, [cachedUser.role, facultyCanManage, navigate, showWarning]);

  const load = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true);
        const [rows, announcementRows] = await Promise.all([
          fetchTeacherSubjects(cachedUser.school_id),
          fetchFacultyAnnouncements(40, cachedUser.school_id),
        ]);
        setSubjects(rows || []);
        setPosted(announcementRows || []);
      } catch (err) {
        setError(err.message || "Failed to load announcements.");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [cachedUser.school_id]
  );

  usePolling(load, [cachedUser.school_id]);

  const toggleSubject = (subjectId) => {
    setSelectedSubjectIds((prev) =>
      prev.includes(subjectId)
        ? prev.filter((id) => id !== subjectId)
        : [...prev, subjectId]
    );
  };

  const handlePost = async (event) => {
    event.preventDefault();

    if (!facultyCanManage) {
      showWarning(FACULTY_AVATAR_REQUIRED_MESSAGE, "Profile photo required");
      return;
    }

    if (scope === "specific" && selectedSubjectIds.length === 0) {
      setError("Select at least one subject.");
      return;
    }

    try {
      setPosting(true);
      setError("");
      setSuccess("");

      const result = await createFacultyAnnouncements({
        subjectIds: scope === "all" ? null : selectedSubjectIds,
        title,
        body,
        targetSections,
      });

      const count = result?.count ?? result ?? 0;
      const createdRows = Array.isArray(result?.rows) ? result.rows : [];

      setTitle("");
      setBody("");
      setTargetSections([...announcementSections]);
      setSelectedSubjectIds([]);
      setSuccess(
        `Announcement posted to ${count} subject${count === 1 ? "" : "s"}. Students will see it in notifications.`
      );

      if (createdRows.length) {
        const subjectNameById = Object.fromEntries(
          subjects.map((subject) => [subject.id, subject.name || "Subject"])
        );
        setPosted((prev) => {
          const mapped = createdRows.map((row) => ({
            ...row,
            subject_name: subjectNameById[row.subject_id] || "Subject",
          }));
          const seen = new Set(mapped.map((row) => row.id));
          return [...mapped, ...prev.filter((row) => !seen.has(row.id))];
        });
      }

      await load(true);
    } catch (err) {
      setError(err.message || "Failed to post announcement.");
    } finally {
      setPosting(false);
    }
  };

  if (loading && subjects.length === 0 && posted.length === 0) {
    return <PageLoadingSkeleton theme={theme} variant="detail" />;
  }

  return (
    <div className={pageShellClass(theme, "mx-auto max-w-5xl")}>
      <BackButton />

      <PageHeader
        theme={theme}
        icon={Megaphone}
        title="Faculty announcements"
        subtitle="Notify students across all subjects, one subject, or specific sections."
      />

      <form onSubmit={handlePost} className={`${panelClass(theme)} mb-6 space-y-4`}>
        {error && <AlertBanner variant="error">{error}</AlertBanner>}
        {success && <AlertBanner variant="success">{success}</AlertBanner>}

        <div>
          <label
            className={`mb-1.5 block text-sm font-medium ${
              theme === "dark" ? "text-gray-300" : "text-gray-700"
            }`}
          >
            Title
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Announcement title"
            required
          />
        </div>

        <div>
          <label
            className={`mb-1.5 block text-sm font-medium ${
              theme === "dark" ? "text-gray-300" : "text-gray-700"
            }`}
          >
            Message
          </label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Announcement message..."
            rows={4}
            required
          />
        </div>

        <div>
          <label
            className={`mb-1.5 block text-sm font-medium ${
              theme === "dark" ? "text-gray-300" : "text-gray-700"
            }`}
          >
            Subject scope
          </label>
          <div className="flex flex-wrap gap-2">
            <ChipToggle active={scope === "all"} onClick={() => setScope("all")}>
              All my subjects ({subjects.length})
            </ChipToggle>
            <ChipToggle active={scope === "specific"} onClick={() => setScope("specific")}>
              Specific subject(s)
            </ChipToggle>
          </div>
          {scope === "specific" && (
            <div className="mt-2 flex flex-wrap gap-2">
              {subjects.map((subject) => (
                <ChipToggle
                  key={subject.id}
                  active={selectedSubjectIds.includes(subject.id)}
                  onClick={() => toggleSubject(subject.id)}
                >
                  {subject.name}
                </ChipToggle>
              ))}
            </div>
          )}
        </div>

        <SectionPicker
          value={targetSections}
          onChange={setTargetSections}
          sections={announcementSections}
          label="Audience (sections)"
          hint="Only students in these sections will receive the announcement."
        />

        <button
          type="submit"
          disabled={posting}
          className={primaryButton(theme, "disabled:opacity-60")}
        >
          {posting ? "Publishing..." : "Publish announcement"}
        </button>
      </form>

      <div className={adminTableWrapClass(theme)}>
        <div className="en-inner-scroll max-h-[28rem] overflow-auto">
          <table className={adminTableClass(theme)}>
            <thead>
              <tr>
                <th className={adminThClass(theme)}>Title</th>
                <th className={adminThClass(theme)}>Subject</th>
                <th className={adminThClass(theme)}>Audience</th>
                <th className={adminThClass(theme)}>Date</th>
              </tr>
            </thead>
            <tbody>
              {!posted.length ? (
                <tr>
                  <td colSpan={4} className={`${adminTdClass(theme)} whitespace-normal break-words py-8 text-center`}>
                    No announcements published yet.
                  </td>
                </tr>
              ) : (
                posted.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer"
                    onClick={() =>
                      navigate(
                        `/faculty/subject/${row.subject_id}/social?highlight=${row.id}`
                      )
                    }
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
                    <td className={adminTdClass(theme)}>{row.subject_name}</td>
                    <td className={adminTdClass(theme)}>
                      {Array.isArray(row.target_sections) && row.target_sections.length
                        ? row.target_sections.join(", ")
                        : "All sections"}
                    </td>
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
