import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Megaphone } from "lucide-react";
import BackButton from "../../components/BackButton";
import SectionPicker from "../../components/SectionPicker";
import PageHeader from "../../components/ui/PageHeader";
import AlertBanner from "../../components/ui/AlertBanner";
import Input from "../../components/ui/Input";
import Textarea from "../../components/ui/Textarea";
import Button from "../../components/ui/Button";
import ChipToggle from "../../components/ui/ChipToggle";
import { useTheme } from "../../layouts/ThemeContext";
import { useAppModal } from "../../contexts/AppModalContext";
import { pageShellClass, panelClass } from "../../utils/themeInputs";
import { getSectionsForSubjects, normalizeTargetSections } from "../../utils/sections";
import {
  createFacultyAnnouncements,
  fetchTeacherSubjects,
} from "../../utils/supabaseData";
import {
  canFacultyManageSubjects,
  FACULTY_AVATAR_REQUIRED_MESSAGE,
  isFacultyRole,
} from "../../utils/avatar";
import { PageLoadingSkeleton } from "../../components/ui/PageLoadingSkeleton";
import { usePolling } from "../../hooks/useRealtimeFetch";

export default function FacultyAnnouncementsHub() {
  const { theme } = useTheme();
  const { warning: showWarning } = useAppModal();
  const navigate = useNavigate();
  const cachedUser = JSON.parse(localStorage.getItem("examnexus_user") || "{}");

  const [subjects, setSubjects] = useState([]);
  const [scope, setScope] = useState("all");
  const [selectedSubjectIds, setSelectedSubjectIds] = useState([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetSections, setTargetSections] = useState([]);

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

  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const facultyCanManage = canFacultyManageSubjects(cachedUser);

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const rows = await fetchTeacherSubjects(cachedUser.school_id);
      setSubjects(rows || []);
    } catch (err) {
      setError(err.message || "Failed to load subjects.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [cachedUser.school_id]);

  useEffect(() => {
    if (isFacultyRole(cachedUser.role) && !facultyCanManage) {
      showWarning(FACULTY_AVATAR_REQUIRED_MESSAGE, "Profile photo required");
      navigate("/faculty/profile");
    }
  }, [cachedUser.role, facultyCanManage, navigate]);

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

      const count = await createFacultyAnnouncements({
        subjectIds: scope === "all" ? null : selectedSubjectIds,
        title,
        body,
        targetSections,
      });

      setTitle("");
      setBody("");
      setTargetSections([...announcementSections]);
      setSelectedSubjectIds([]);
      setSuccess(
        `Announcement posted to ${count} subject${count === 1 ? "" : "s"}. Students will see it in notifications.`
      );
    } catch (err) {
      setError(err.message || "Failed to post announcement.");
    } finally {
      setPosting(false);
    }
  };

  if (loading) {
    return <PageLoadingSkeleton theme={theme} variant="list" />;
  }

  return (
    <div className={pageShellClass(theme)}>
      <div className="mx-auto max-w-3xl">
        <BackButton />

        <PageHeader
          theme={theme}
          icon={Megaphone}
          title="Make Announcement"
          subtitle="Notify students across all subjects, one subject, or specific sections."
        />

        <form onSubmit={handlePost} className={panelClass(theme)}>
          {error && <AlertBanner variant="error">{error}</AlertBanner>}
          {success && <AlertBanner variant="success">{success}</AlertBanner>}

          <div className="mb-4">
            <p
              className={`text-sm font-medium mb-2 ${
                theme === "dark" ? "text-emerald-400" : "text-teal-700"
              }`}
            >
              Subject scope
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              <ChipToggle active={scope === "all"} onClick={() => setScope("all")}>
                All my subjects ({subjects.length})
              </ChipToggle>
              <ChipToggle active={scope === "specific"} onClick={() => setScope("specific")}>
                Specific subject(s)
              </ChipToggle>
            </div>

            {scope === "specific" && (
              <div className="flex flex-wrap gap-2">
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
            label="Notify sections"
            hint="Only students in these sections will receive the announcement."
          />

          <Input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Announcement title"
            required
            className="mt-4"
          />

          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Announcement message..."
            rows={5}
            className="mt-3"
            required
          />

          <Button type="submit" disabled={posting} size="sm" className="mt-4">
            {posting ? "Posting..." : "Post Announcement"}
          </Button>
        </form>
      </div>
    </div>
  );
}
