import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Megaphone } from "lucide-react";
import BackButton from "../../components/BackButton";
import AnnouncementCard from "../../components/AnnouncementCard";
import SubjectFacultyCard from "../../components/SubjectFacultyCard";
import PageHeader from "../../components/ui/PageHeader";
import AlertBanner from "../../components/ui/AlertBanner";
import { useTheme } from "../../layouts/ThemeContext";
import { pageShellClass, panelClass } from "../../utils/themeInputs";
import { formatSectionLabel } from "../../utils/sections";
import {
  fetchSubject,
  fetchSubjectAnnouncements,
  fetchSubjectFaculty,
  fetchStudentEnrollmentSection,
} from "../../utils/supabaseData";
import { resolveStudentId } from "../../utils/authUser";
import { PageLoadingSkeleton } from "../../components/ui/PageLoadingSkeleton";
import { usePolling } from "../../hooks/useRealtimeFetch";

export default function StudentSubjectSocial() {
  const { theme } = useTheme();
  const { subjectId } = useParams();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const openComments = searchParams.get("comments") === "1";

  const [subject, setSubject] = useState(null);
  const [faculty, setFaculty] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [mySection, setMySection] = useState("A");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPage = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError("");

      const studentId = await resolveStudentId();
      if (!studentId) {
        setError("Please log in again.");
        return;
      }

      const subjectData = await fetchSubject(subjectId);
      setSubject(subjectData);

      const [facultyData, announcementData, sectionData] = await Promise.all([
        fetchSubjectFaculty(subjectData),
        fetchSubjectAnnouncements(subjectId),
        fetchStudentEnrollmentSection(studentId, subjectId),
      ]);

      setFaculty(facultyData);
      setAnnouncements(announcementData);
      setMySection(sectionData || "A");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load announcements.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [subjectId]);

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
          title="Class Announcements"
          subtitle={
            subject
              ? `${subject.name} · ${formatSectionLabel(mySection)}`
              : undefined
          }
        />

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
          <div className={panelClass(theme)}>
            {error && <AlertBanner variant="error">{error}</AlertBanner>}

            {announcements.length === 0 ? (
              <p className={theme === "dark" ? "text-gray-400" : "text-gray-600"}>
                No announcements for your section yet.
              </p>
            ) : (
              <div className="space-y-4">
                {announcements.map((announcement) => (
                  <AnnouncementCard
                    key={announcement.id}
                    announcement={announcement}
                    allowInteract
                    highlighted={highlightId === String(announcement.id)}
                    autoExpandComments={
                      openComments && highlightId === String(announcement.id)
                    }
                    onUpdated={() => loadPage(true)}
                  />
                ))}
              </div>
            )}
          </div>

          <aside className="xl:sticky xl:top-6">
            <SubjectFacultyCard faculty={faculty} />
          </aside>
        </div>
      </div>
    </div>
  );
}
