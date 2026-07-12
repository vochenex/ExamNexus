import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Megaphone } from "lucide-react";
import BackButton from "../../components/BackButton";
import SectionPicker from "../../components/SectionPicker";
import AnnouncementCard from "../../components/AnnouncementCard";
import SubjectFacultyCard from "../../components/SubjectFacultyCard";
import PageHeader from "../../components/ui/PageHeader";
import AlertBanner from "../../components/ui/AlertBanner";
import Input from "../../components/ui/Input";
import Textarea from "../../components/ui/Textarea";
import Button from "../../components/ui/Button";
import { useTheme } from "../../layouts/ThemeContext";
import { useAppModal } from "../../contexts/AppModalContext";
import { pageShellClass, panelClass } from "../../utils/themeInputs";
import { getSubjectSections } from "../../utils/sections";
import {
  createAnnouncement,
  fetchSubject,
  fetchSubjectAnnouncements,
  fetchSubjectFaculty,
} from "../../utils/supabaseData";
import {
  canFacultyManageSubjects,
  FACULTY_AVATAR_REQUIRED_MESSAGE,
  isFacultyRole,
} from "../../utils/avatar";
import { PageLoadingSkeleton } from "../../components/ui/PageLoadingSkeleton";
import { usePolling } from "../../hooks/useRealtimeFetch";

export default function FacultySubjectSocial() {
  const { theme } = useTheme();
  const { warning: showWarning } = useAppModal();
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const openComments = searchParams.get("comments") === "1";
  const cachedUser = JSON.parse(localStorage.getItem("examnexus_user") || "{}");

  const [subject, setSubject] = useState(null);
  const [faculty, setFaculty] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetSections, setTargetSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  const facultyCanManage = canFacultyManageSubjects(cachedUser);

  const loadPage = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError("");

      const subjectData = await fetchSubject(subjectId);
      setSubject(subjectData);
      const sections = getSubjectSections(subjectData);
      setTargetSections([...sections]);

      const [facultyData, announcementData] = await Promise.all([
        fetchSubjectFaculty(subjectData),
        fetchSubjectAnnouncements(subjectId),
      ]);

      setFaculty(facultyData);
      setAnnouncements(announcementData);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load social page.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [subjectId]);

  useEffect(() => {
    if (isFacultyRole(cachedUser.role) && !facultyCanManage) {
      showWarning(FACULTY_AVATAR_REQUIRED_MESSAGE, "Profile photo required");
      navigate("/faculty/profile");
    }
  }, [cachedUser.role, facultyCanManage, navigate]);

  usePolling(loadPage, [subjectId]);

  useEffect(() => {
    if (!highlightId || loading) return;

    const timer = setTimeout(() => {
      document
        .getElementById(`announcement-${highlightId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 350);

    return () => clearTimeout(timer);
  }, [highlightId, loading, announcements.length]);

  const handlePost = async (event) => {
    event.preventDefault();

    if (!facultyCanManage) {
      showWarning(FACULTY_AVATAR_REQUIRED_MESSAGE, "Profile photo required");
      return;
    }

    try {
      setPosting(true);
      setError("");

      await createAnnouncement({
        subjectId,
        title,
        body,
        targetSections,
        createdBy: cachedUser.id,
      });

      setTitle("");
      setBody("");
      setTargetSections([...getSubjectSections(subject)]);
      await loadPage();
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to post announcement.");
    } finally {
      setPosting(false);
    }
  };

  const handleDeleteLocal = (announcementId) => {
    setAnnouncements((prev) => prev.filter((item) => item.id !== announcementId));
  };

  if (loading) {
    return <PageLoadingSkeleton theme={theme} variant="list" />;
  }

  return (
    <div className={pageShellClass(theme)}>
      <div className="mx-auto max-w-7xl">
        <BackButton />

        <PageHeader
          theme={theme}
          icon={Megaphone}
          title="Subject Social"
          subtitle={
            subject
              ? `${subject.name} · Post announcements for your class sections`
              : undefined
          }
          actions={
            <Button variant="secondary" size="sm" onClick={() => navigate("/faculty/announcements")}>
              Post to all / multiple subjects
            </Button>
          }
        />

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
          <div className="space-y-6">
            <form onSubmit={handlePost} className={panelClass(theme)}>
              <h2
                className={`text-lg font-semibold mb-4 ${
                  theme === "dark" ? "text-emerald-400" : "text-teal-700"
                }`}
              >
                New Announcement
              </h2>

              {error && <AlertBanner variant="error">{error}</AlertBanner>}

              <Input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Announcement title"
                required
              />

              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your announcement..."
                rows={5}
                className="mt-3"
                required
              />

              <div className="mt-3">
                <SectionPicker
                  value={targetSections}
                  onChange={setTargetSections}
                  sections={getSubjectSections(subject)}
                  label="Visible to sections"
                  hint="Only students in the selected sections will see this announcement."
                />
              </div>

              <Button type="submit" disabled={posting} size="sm" className="mt-4">
                {posting ? "Posting..." : "Post Announcement"}
              </Button>
            </form>

            <div className={panelClass(theme)}>
              <h2
                className={`text-lg font-semibold mb-4 ${
                  theme === "dark" ? "text-emerald-400" : "text-teal-700"
                }`}
              >
                Announcements ({announcements.length})
              </h2>

              {announcements.length === 0 ? (
                <p className={theme === "dark" ? "text-gray-400" : "text-gray-600"}>
                  No announcements yet. Post one for your students.
                </p>
              ) : (
                <div className="space-y-4">
                  {announcements.map((announcement) => (
                    <AnnouncementCard
                      key={announcement.id}
                      announcement={announcement}
                      canDelete
                      allowInteract
                      highlighted={highlightId === String(announcement.id)}
                      autoExpandComments={
                        openComments && highlightId === String(announcement.id)
                      }
                      onDeleted={handleDeleteLocal}
                      onUpdated={() => loadPage(true)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-6">
            <SubjectFacultyCard faculty={faculty || cachedUser} />
            <div
              className={`rounded-2xl p-4 border text-sm ${
                theme === "dark"
                  ? "bg-white/5 border-white/10 text-gray-400"
                  : "en-bg-elevated border-emerald-200 text-gray-600"
              }`}
            >
              Use this page to share reminders, schedule changes, and updates with
              specific sections before releasing assessments.
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
