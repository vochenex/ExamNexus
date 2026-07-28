import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Megaphone, ClipboardCheck } from "lucide-react";
import BackButton from "../../components/BackButton";
import ClassmateCard from "../../components/ClassmateCard";
import SubjectFacultyCard from "../../components/SubjectFacultyCard";
import Button from "../../components/ui/Button";
import PageHeader from "../../components/ui/PageHeader";
import AlertBanner from "../../components/ui/AlertBanner";
import { useTheme } from "../../layouts/ThemeContext";
import { pageShellClass, panelClass } from "../../utils/themeInputs";
import { resolveStudentId } from "../../utils/authUser";
import { formatSectionLabel } from "../../utils/sections";
import YearLevelBadge from "../../components/YearLevelBadge";
import {
  fetchSubject,
  fetchSubjectClassmates,
  fetchSubjectFaculty,
  fetchStudentEnrollmentSection,
} from "../../utils/supabaseData";
import { PageLoadingSkeleton } from "../../components/ui/PageLoadingSkeleton";
import { usePolling } from "../../hooks/useRealtimeFetch";

export default function StudentSubjectDetails() {
  const { theme } = useTheme();
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const [subject, setSubject] = useState(null);
  const [faculty, setFaculty] = useState(null);
  const [classmates, setClassmates] = useState([]);
  const [mySection, setMySection] = useState("A");
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

      const subjectData = await fetchSubject(subjectId);
      setSubject(subjectData);

      const sectionData = await fetchStudentEnrollmentSection(studentId, subjectId);
      const resolvedSection = sectionData || "A";
      setMySection(resolvedSection);

      const [facultyData, classmatesData] = await Promise.all([
        fetchSubjectFaculty(subjectData),
        fetchSubjectClassmates(subjectId, { sectionFilter: resolvedSection }),
      ]);

      setFaculty(facultyData);
      setClassmates(classmatesData);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load subject details.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [subjectId]);

  usePolling(load, [subjectId]);

  const peerCount = useMemo(
    () => classmates.filter((classmate) => !classmate.is_you).length,
    [classmates]
  );

  if (loading && !subject) {
    return <PageLoadingSkeleton theme={theme} variant="detail" />;
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
              You are in {formatSectionLabel(mySection)} with {peerCount} classmate
              {peerCount === 1 ? "" : "s"}. Students in other sections are not shown.
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
            className={`text-xl font-semibold mb-1 ${
              theme === "dark" ? "text-emerald-400" : "text-teal-700"
            }`}
          >
            Classmates in {formatSectionLabel(mySection)}
          </h2>
          <p className={`text-sm ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
            Only students enrolled in your section appear here.
          </p>
        </div>

        {classmates.length === 0 ? (
          <p className={theme === "dark" ? "text-gray-400" : "text-gray-600"}>
            No classmates in your section yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {classmates.map((classmate) => (
              <ClassmateCard
                key={classmate.id}
                classmate={classmate}
                highlight={classmate.is_you}
              />
            ))}
          </div>
        )}
    </div>
  );
}
