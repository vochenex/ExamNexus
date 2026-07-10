import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import BackButton from "../../components/BackButton";
import {ClipboardCheck, GraduationCap, Activity, Megaphone, Pencil} from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import { useAppModal } from "../../contexts/AppModalContext";
import { primaryButton, secondaryButtonSm } from "../../utils/themeButtons";
import {
  fetchSubject,
  fetchSubjectAssessments,
  fetchSubjectClassAnalytics,
  fetchSubjectClassmates,
  fetchSubjectFaculty,
} from "../../utils/supabaseData";
import { supabase } from "../../supabaseClient";
import {
  canFacultyManageSubjects,
  FACULTY_AVATAR_REQUIRED_MESSAGE,
  isFacultyRole,
} from "../../utils/avatar";
import FacultyAvatarRequiredBanner from "../../components/FacultyAvatarRequiredBanner";
import ClassmateCard from "../../components/ClassmateCard";
import SectionTabs from "../../components/SectionTabs";
import SubjectFacultyCard from "../../components/SubjectFacultyCard";
import ModalPortal from "../../components/ui/ModalPortal";
import {
  buildSectionCounts,
  formatSubjectSectionsLabel,
  formatTargetSectionsLabel,
  getSubjectSections,
} from "../../utils/sections";
import YearLevelBadge from "../../components/YearLevelBadge";
import EditSubjectModal from "../../components/EditSubjectModal";
import ExamNexusBrand from "../../components/ExamNexusBrand";
import SubjectClassAnalyticsPanel from "../../components/SubjectClassAnalyticsPanel";
import { pageShellWithBellClass } from "../../utils/themeInputs";
import { PageLoadingSkeleton } from "../../components/ui/PageLoadingSkeleton";
import { usePolling } from "../../hooks/useRealtimeFetch";
import CollapsiblePanel from "../../components/ui/CollapsiblePanel";

function getAssessmentStatus(assessment) {
  const now = new Date();

  if (
    assessment.start_datetime &&
    now < new Date(assessment.start_datetime)
  ) {
    return "scheduled";
  }

  if (
    assessment.end_datetime &&
    now > new Date(assessment.end_datetime)
  ) {
    return "closed";
  }

  return "active";
}

export default function SubjectDetails() {
  const { theme } = useTheme();
  const { error: showError, warning: showWarning } = useAppModal();
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [showEditSubjectModal, setShowEditSubjectModal] = useState(false);
  const [subject, setSubject] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [classAnalytics, setClassAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [classmates, setClassmates] = useState([]);
  const [faculty, setFaculty] = useState(null);
  const [activeSection, setActiveSection] = useState("All");
  const cachedUser = JSON.parse(localStorage.getItem("examnexus_user") || "{}");
  const [facultyProfile, setFacultyProfile] = useState(cachedUser);
  const [loading, setLoading] = useState(true);
  const facultyCanManage = canFacultyManageSubjects(facultyProfile);

  const requireFacultyAvatar = () => {
    if (facultyCanManage) return true;
    showWarning(FACULTY_AVATAR_REQUIRED_MESSAGE, "Profile photo required");
    navigate("/faculty/profile");
    return false;
  };

  const handleAssessmentChoice = (type) => {
  if (!requireFacultyAvatar()) return;

  setShowAssessmentModal(false);

  navigate("/faculty/create-assessment", {
    state: {
      type,
      subject,
    },
  });
};
  const loadSubjectPage = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await fetchSubject(subjectId);
      setSubject(data);

      const [facultyData, classmatesData, assessmentData] = await Promise.all([
        fetchSubjectFaculty(data),
        fetchSubjectClassmates(subjectId),
        fetchSubjectAssessments(subjectId),
      ]);

      setFaculty(facultyData);
      setClassmates(classmatesData);
      setAssessments(assessmentData);
    } catch (err) {
      console.error(err);
      if (!silent) showError(err.message || "Failed to load subject");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [subjectId]);

  const loadAnalytics = useCallback(async (silent = false) => {
    if (!silent) setAnalyticsLoading(true);
    try {
      const data = await fetchSubjectClassAnalytics(subjectId);
      setClassAnalytics(data);
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setAnalyticsLoading(false);
    }
  }, [subjectId]);

  usePolling(loadSubjectPage, [subjectId]);
  usePolling(loadAnalytics, [subjectId]);

  useEffect(() => {
    const loadFacultyProfile = async () => {
      if (!cachedUser.id || !isFacultyRole(cachedUser.role)) return;

      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("id", cachedUser.id)
        .single();

      if (data) {
        setFacultyProfile(data);
        localStorage.setItem("examnexus_user", JSON.stringify(data));
      }
    };

    loadFacultyProfile();
  }, [cachedUser.id, cachedUser.role]);

  if (loading && !subject) {
    return <PageLoadingSkeleton theme={theme} variant="detail" />;
  }

  if (!subject) {
    return (
      <div className={`p-6 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
        Subject not found.
      </div>
    );
  }

  const subjectSections = getSubjectSections(subject);
  const sectionCounts = buildSectionCounts(classmates, subjectSections);

  const filteredClassmates =
    activeSection === "All"
      ? classmates
      : classmates.filter(
          (c) => String(c.section || "A").toUpperCase() === activeSection
        );

  return (
 <div className={pageShellWithBellClass(theme)}>

    <BackButton />

    <div className="mb-6">
      <ExamNexusBrand variant="compact" idSuffix="subject-faculty" className="mb-5 opacity-90" />
    </div>

    {/* HEADER */}
    <div className="mb-8">
        <div className="flex flex-wrap items-center gap-3">
        <h1
        className={`text-3xl font-bold ${
            theme === "dark"
            ? "text-emerald-400"
            : "text-teal-700"
        }`}
        >
        {subject.name}
        </h1>
        <YearLevelBadge yearLevel={subject.year_level} />
        <button
          type="button"
          onClick={() => {
            if (!requireFacultyAvatar()) return;
            setShowEditSubjectModal(true);
          }}
          disabled={!facultyCanManage}
          className={secondaryButtonSm(theme, "inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed")}
        >
          <Pencil size={16} />
          Edit Subject
        </button>
        </div>
        <p
  className={`mt-2 ${
    theme === "dark"
      ? "text-white"
      : "text-black"
  }`}
>
          Invite Code:
                    <span
            className={`
                ml-2
                font-mono
                font-semibold

                ${
                theme === "dark"
                    ? "text-emerald-400"
                    : "text-emerald-700"
                }
            `}
            >
            {subject.invite_code}
            </span>
        </p>
      </div>

      {!facultyCanManage && isFacultyRole(facultyProfile.role) && (
        <FacultyAvatarRequiredBanner user={facultyProfile} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
        <SubjectFacultyCard faculty={faculty || facultyProfile} />
        <div
          className={`lg:col-span-2 rounded-2xl p-5 border ${
            theme === "dark"
              ? "bg-white/5 border-white/10"
              : "en-bg-surface border border-emerald-300"
          }`}
        >
          <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-700"}`}>
            {classmates.length} student{classmates.length === 1 ? "" : "s"} enrolled across{" "}
            {formatSubjectSectionsLabel(subject.section_count).toLowerCase()}.
          </p>
        </div>
      </div>

      {/* CREATE ASSESSMENT + SOCIAL */}
      <div className="mb-6 flex flex-wrap gap-3">
        <button
        onClick={() => {
          if (!requireFacultyAvatar()) return;
          setShowAssessmentModal(true);
        }}
        disabled={!facultyCanManage}
        className={primaryButton(theme, "rounded-lg px-5 py-3 disabled:opacity-50 disabled:cursor-not-allowed")}
      >
        + Create Assessment
      </button>

        <button
          onClick={() => navigate(`/faculty/subject/${subjectId}/social`)}
          disabled={!facultyCanManage}
          className={primaryButton(theme, "rounded-lg px-5 py-3 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2")}
        >
          <Megaphone size={18} />
          Social / Announcements
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* STUDENTS */}
       <div
  className={`
    p-5
    rounded-2xl
    lg:col-span-1

    ${
      theme === "dark"
        ? "bg-white/5 border border-white/10"
        : "en-bg-surface border border-emerald-300"
    }
  `}
>
          <h2
  className={`font-semibold text-lg ${
    theme === "dark"
      ? "text-emerald-400"
      : "text-teal-700"
  }`}
>
  Students
</h2>

          <p className={`mt-2 text-sm mb-4 ${theme === "dark" ? "text-gray-400" : "text-gray-700"}`}>
            Enrolled students by section
          </p>

          <SectionTabs
            active={activeSection}
            onChange={setActiveSection}
            counts={sectionCounts}
            sections={subjectSections}
          />

          <div className="mt-4 space-y-2 max-h-80 overflow-y-auto">
            {filteredClassmates.length === 0 ? (
              <p className={theme === "dark" ? "text-gray-400" : "text-gray-600"}>
                No students in this section.
              </p>
            ) : (
              filteredClassmates.map((student) => (
                <ClassmateCard key={student.id} classmate={student} />
              ))
            )}
          </div>
        </div>

        {/* ASSESSMENTS */}
        <CollapsiblePanel
          title="Assessments"
          subtitle={`${assessments.length} assessment${assessments.length === 1 ? "" : "s"} for this subject`}
          defaultOpen={assessments.length > 0 && assessments.length <= 4}
          className="mb-4"
        >
          {assessments.length === 0 ? (
            <p className={theme === "dark" ? "text-white" : "text-black"}>
              No assessments yet
            </p>
          ) : (
            assessments.map((assessment) => (
              <div
                key={assessment.id}
                onClick={() => navigate(`/faculty/assessment/${assessment.id}`)}
                className={`
      mb-3
      p-4
      rounded-xl
      cursor-pointer

      ${
        theme === "dark"
          ? "bg-black/20 border border-white/5 hover:bg-white/10"
          : `
            en-bg-surface
            border border-emerald-300/80
            en-hover
            hover:border-teal-400/70
          `
      }

      hover:-translate-y-0.5
      hover:shadow-lg
      transition-all
      duration-300
    `}
              >
                <div className="flex items-center justify-between">
                  <h3
                    className={`font-semibold ${
                      theme === "dark" ? "text-emerald-400" : "text-[#0f766e]"
                    }`}
                  >
                    {assessment.title}
                  </h3>
                  {getAssessmentStatus(assessment) === "active" && (
                    <span className="text-emerald-400 font-bold text-xs font-medium">
                      🟢 Active
                    </span>
                  )}

                  {getAssessmentStatus(assessment) === "scheduled" && (
                    <span className="text-amber-500 font-bold text-xs font-medium">
                      🟡 Scheduled
                    </span>
                  )}

                  {getAssessmentStatus(assessment) === "closed" && (
                    <span className="text-red-500 font-bold text-xs font-medium">
                      🔴 Closed
                    </span>
                  )}
                </div>

                <p
                  className={`
    text-xs
    mt-1
    ${theme === "dark" ? "text-white" : "text-black"}
  `}
                >
  {assessment.exam_type}
</p>

<p
  className={`text-xs mt-1 ${
    theme === "dark" ? "text-emerald-300" : "text-teal-700"
  }`}
>
  {formatTargetSectionsLabel(assessment.target_sections, subjectSections)}
</p>

{assessment.end_datetime && (
  <p
    className={`
      text-xs
      mt-1
      ${
        theme === "dark"
          ? "text-white"
          : "text-black"
      }
    `}
  >
    Ends:{" "}
    {new Date(assessment.end_datetime).toLocaleString("en-PH", {
      dateStyle: "medium",
      timeStyle: "short",
    })}
  </p>
)}
              </div>
            ))
          )}
        </CollapsiblePanel>

        {/* ANALYTICS */}
        <SubjectClassAnalyticsPanel analytics={classAnalytics} loading={analyticsLoading} />

      </div>
      {showAssessmentModal && (
  <ModalPortal>
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4" role="presentation">
    <div
      className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      onClick={() => setShowAssessmentModal(false)}
      aria-hidden="true"
    />
    <div
  role="dialog"
  aria-modal="true"
  onClick={(event) => event.stopPropagation()}
  className={`
  relative z-10
  w-full
  max-w-[min(100%,56rem)]
  max-h-[min(90dvh,40rem)]
  overflow-y-auto

  rounded-3xl
  p-5 sm:p-8

  ${
    theme === "dark"
      ? "bg-[#031d1f]/95 border border-white/10 backdrop-blur-md"
      : "en-bg-surface border border-emerald-300"
  }

  shadow-[0_0_50px_rgba(16,185,129,0.12)]
`}
>

      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-emerald-400">
          Create Assessment
        </h2>

        <p
            className={`mt-2 ${
                theme === "dark" ? "text-white" : "text-black"
            }`}
            >
            Choose the type of assessment you want to create
            </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">

        {/* QUIZ */}
            <button
            onClick={() => handleAssessmentChoice("quiz")}
            className={`
            group
            relative
            h-48
            p-6
            rounded-2xl

            ${
                theme === "dark"
                ? `
                    bg-white/5
                    border border-white/10
                    hover:bg-white/10
                    hover:border-emerald-400/40
                    `
                : `
                    en-bg-surface
                    border border-emerald-300/80
                    en-hover
                    hover:border-emerald-500
                    `
            }

            hover:-translate-y-1
            hover:shadow-lg

            transition-all
            duration-300
            `}
        >
          <div className="flex h-full flex-col items-center justify-center text-center">

            <ClipboardCheck
              size={50}
              className="
                text-emerald-400
                mb-5

                transition-all duration-300
                group-hover:scale-110
              "
            />

            <h3 className="text-xl font-semibold">
              Quiz
            </h3>

            <p
                className={`text-sm mt-3 max-w-[180px] ${
                    theme === "dark" ? "text-white" : "text-black"
                }`}
                >
                Quick assessments and knowledge checks
                </p>

          </div>
        </button>

        {/* EXAM */}
                <button
        onClick={() => handleAssessmentChoice("exam")}
        className={`
            group
            relative
            h-48
            p-6
            rounded-2xl

            ${
                theme === "dark"
                ? `
                    bg-white/5
                    border border-white/10
                    hover:bg-white/10
                    hover:border-emerald-400/40
                    `
                : `
                    en-bg-surface
                    border border-emerald-300/80
                    en-hover
                    hover:border-emerald-500
                    `
            }

            hover:-translate-y-1
            hover:shadow-lg

            transition-all
            duration-300
            `}
        >
        <div className="flex h-full flex-col items-center justify-center text-center">
            <GraduationCap
            size={50}
            className="text-emerald-400 mb-5 group-hover:scale-110 transition-all"
            />

            <h3 className="text-xl font-semibold">
            Exam
            </h3>

            <p
            className={`text-sm mt-3 max-w-[180px] ${
                theme === "dark"
                ? "text-white"
                : "text-black"
            }`}
            >
            Long-form graded examinations
            </p>
        </div>
        </button>

        {/* ACTIVITY */}
                <button
        onClick={() => handleAssessmentChoice("activity")}
        className={`
            group
            relative
            h-48
            p-6
            rounded-2xl

            ${
                theme === "dark"
                ? `
                    bg-white/5
                    border border-white/10
                    hover:bg-white/10
                    hover:border-emerald-400/40
                    `
                : `
                    en-bg-surface
                    border border-emerald-300/80
                    en-hover
                    hover:border-emerald-500
                    `
            }

            hover:-translate-y-1
            hover:shadow-lg

            transition-all
            duration-300
            `}
        >
        <div className="flex h-full flex-col items-center justify-center text-center">
            <Activity
            size={50}
            className="text-emerald-400 mb-5 group-hover:scale-110 transition-all"
            />

            <h3 className="text-xl font-semibold">
            Activity
            </h3>

            <p
            className={`text-sm mt-3 max-w-[180px] ${
                theme === "dark"
                ? "text-white"
                : "text-black"
            }`}
            >
            Practice exercises and participation
            </p>
        </div>
        </button>

      </div>

      <button
  onClick={() => setShowAssessmentModal(false)}
  className={`mx-auto mt-6 w-40 ${secondaryButtonSm(theme)}`}
>
  Cancel
</button>

    </div>
  </div>
  </ModalPortal>
)}
      <EditSubjectModal
        subject={subject}
        classmates={classmates}
        open={showEditSubjectModal}
        onClose={() => setShowEditSubjectModal(false)}
        onSaved={(updated) => {
          setSubject(updated);
          if (
            activeSection !== "All" &&
            !getSubjectSections(updated).includes(activeSection)
          ) {
            setActiveSection("All");
          }
        }}
      />
    </div>
  );
}