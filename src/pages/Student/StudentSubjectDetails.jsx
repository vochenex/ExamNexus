import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Megaphone, ClipboardCheck } from "lucide-react";
import BackButton from "../../components/BackButton";
import ClassmateCard from "../../components/ClassmateCard";
import SectionTabs from "../../components/SectionTabs";
import SubjectFacultyCard from "../../components/SubjectFacultyCard";
import Button from "../../components/ui/Button";
import PageHeader from "../../components/ui/PageHeader";
import AlertBanner from "../../components/ui/AlertBanner";
import { useTheme } from "../../layouts/ThemeContext";
import { pageShellClass, panelClass } from "../../utils/themeInputs";
import { resolveStudentId } from "../../utils/authUser";
import {
  buildSectionCounts,
  formatSectionLabel,
  getSubjectSections,
} from "../../utils/sections";
import YearLevelBadge from "../../components/YearLevelBadge";
import {
  fetchSubject,
  fetchSubjectClassmates,
  fetchSubjectFaculty,
  fetchStudentEnrollmentSection,
} from "../../utils/supabaseData";

export default function StudentSubjectDetails() {
  const { theme } = useTheme();
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const [subject, setSubject] = useState(null);
  const [faculty, setFaculty] = useState(null);
  const [classmates, setClassmates] = useState([]);
  const [mySection, setMySection] = useState("A");
  const [activeSection, setActiveSection] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const studentId = await resolveStudentId();
        if (!studentId) {
          setError("Please log in again.");
          return;
        }

        const subjectData = await fetchSubject(subjectId);
        setSubject(subjectData);

        const [facultyData, classmatesData, sectionData] = await Promise.all([
          fetchSubjectFaculty(subjectData),
          fetchSubjectClassmates(subjectId),
          fetchStudentEnrollmentSection(studentId, subjectId),
        ]);

        setFaculty(facultyData);
        setClassmates(classmatesData);
        setMySection(sectionData || "A");
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to load subject details.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [subjectId]);

  const subjectSections = useMemo(
    () => getSubjectSections(subject),
    [subject]
  );

  const sectionCounts = useMemo(
    () => buildSectionCounts(classmates, subjectSections),
    [classmates, subjectSections]
  );

  const peerCount = useMemo(
    () => classmates.filter((classmate) => !classmate.is_you).length,
    [classmates]
  );

  const filteredClassmates = useMemo(() => {
    if (activeSection === "All") return classmates;
    return classmates.filter(
      (c) => String(c.section || "A").toUpperCase() === activeSection
    );
  }, [classmates, activeSection]);

  if (loading) {
    return (
      <div className={pageShellClass(theme)}>
        <div className="mx-auto max-w-7xl animate-pulse">
          <div className={`h-10 w-64 rounded-xl ${theme === "dark" ? "bg-white/10" : "en-bg-skeleton"}`} />
        </div>
      </div>
    );
  }

  if (error || !subject) {
    return (
      <div className={pageShellClass(theme)}>
        <BackButton />
        <AlertBanner variant="error" className="mt-4">
          {error || "Subject not found."}
        </AlertBanner>
      </div>
    );
  }

  return (
    <div className={pageShellClass(theme)}>
      <div className="mx-auto max-w-7xl">
        <BackButton />

        <PageHeader
          theme={theme}
          title={subject.name}
          subtitle={
            <>
              Invite Code:{" "}
              <span className="font-mono font-semibold">{subject.invite_code}</span>
              <span className="mx-2">·</span>
              Your {formatSectionLabel(mySection)}
            </>
          }
          actions={<YearLevelBadge yearLevel={subject.year_level} />}
        />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
        <div className="lg:col-span-1">
          <SubjectFacultyCard faculty={faculty} />
        </div>

        <div className={panelClass(theme)}>
          <h2
            className={`text-lg font-semibold ${
              theme === "dark" ? "text-emerald-400" : "text-teal-700"
            }`}
          >
            Subject Information
          </h2>
          <p className={`mt-2 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
            You are enrolled in {formatSectionLabel(mySection)} with{" "}
            {peerCount} other student{peerCount === 1 ? "" : "s"} in this subject
            ({classmates.length} total).
          </p>

          <Button
            size="sm"
            className="mt-4"
            onClick={() => navigate(`/student/subject/${subjectId}/social`)}
          >
            <Megaphone size={16} />
            View Announcements
          </Button>
        </div>

        <div className={`${panelClass(theme)} flex flex-col`}>
          <h2
            className={`text-lg font-semibold ${
              theme === "dark" ? "text-emerald-400" : "text-teal-700"
            }`}
          >
            Assessments
          </h2>
          <p className={`mt-2 text-sm flex-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
            View and take assessments for this subject on My Assessments.
          </p>

          <Button size="sm" className="mt-4" onClick={() => navigate("/student/assessments")}>
            <ClipboardCheck size={16} />
            View Assessments
          </Button>
        </div>
      </div>

      <div className="mb-5">
        <h2
          className={`text-xl font-semibold mb-3 ${
            theme === "dark" ? "text-emerald-400" : "text-teal-700"
          }`}
        >
          Classmates
        </h2>
        <SectionTabs
          active={activeSection}
          onChange={setActiveSection}
          counts={sectionCounts}
          sections={subjectSections}
        />
      </div>

      {filteredClassmates.length === 0 ? (
        <p className={theme === "dark" ? "text-gray-400" : "text-gray-600"}>
          No classmates in this section yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredClassmates.map((classmate) => (
            <ClassmateCard
              key={classmate.id}
              classmate={classmate}
              highlight={classmate.is_you}
            />
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
