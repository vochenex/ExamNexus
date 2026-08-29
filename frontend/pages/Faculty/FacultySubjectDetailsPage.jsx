import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {ClipboardCheck, GraduationCap, Activity, Megaphone, Pencil, BarChart3, Search, Plus, ClipboardList} from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import { useAppModal } from "../../contexts/AppModalContext";
import { iconButton, secondaryButtonSm } from "../../utils/themeButtons";
import {
  facultyUnenrollStudentFromSubject,
  fetchSubject,
  fetchSubjectAssessments,
  fetchSubjectClassAnalytics,
  fetchSubjectClassmates,
  fetchSubjectFaculty,
  fetchSubjectStudentAnalytics,
  fetchPendingRetakeCountsByExamIds,
} from "../../utils/supabaseData";
import { supabase } from "../../supabaseClient";
import {
  canFacultyManageSubjects,
  FACULTY_AVATAR_REQUIRED_MESSAGE,
  isFacultyRole,
} from "../../utils/avatar";
import FacultyAvatarRequiredBanner from "../../components/FacultyAvatarRequiredBanner";
import FacultyStudentCard from "../../components/FacultyStudentCard";
import SubjectStudentRatingsSidebar from "../../components/SubjectStudentRatingsSidebar";
import SectionTabs from "../../components/SectionTabs";
import SubjectFacultyCard from "../../components/SubjectFacultyCard";
import ModalPortal from "../../components/ui/ModalPortal";
import ActionDialog from "../../components/ui/ActionDialog";
import {
  buildSectionCounts,
  formatSubjectSectionsLabel,
  formatTargetSectionsLabel,
  getSubjectSections,
  isVisibleToSection,
} from "../../utils/sections";
import YearLevelBadge from "../../components/YearLevelBadge";
import EditSubjectModal from "../../components/EditSubjectModal";
import SubjectSectionInviteCodes from "../../components/SubjectSectionInviteCodes";
import SubjectClassAnalyticsPanel from "../../components/SubjectClassAnalyticsPanel";
import SectionAssessmentsModal from "../../components/SectionAssessmentsModal";
import PanelContentSkeleton from "../../components/ui/PanelContentSkeleton";
import AlertBanner from "../../components/ui/AlertBanner";
import { pageShellWithBellClass, inputClass } from "../../utils/themeInputs";
import { usePolling } from "../../hooks/useRealtimeFetch";
import { matchesStudentSearch } from "../../utils/studentSearch";

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
  const location = useLocation();
  const [flashNotice, setFlashNotice] = useState(null);
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [sectionAssessmentsOpen, setSectionAssessmentsOpen] = useState(false);
  const [showEditSubjectModal, setShowEditSubjectModal] = useState(false);
  const [subject, setSubject] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [classAnalytics, setClassAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [classmates, setClassmates] = useState([]);
  const [studentRatings, setStudentRatings] = useState([]);
  const [ratingsLoading, setRatingsLoading] = useState(false);
  const [ratingsOpen, setRatingsOpen] = useState(false);
  const [faculty, setFaculty] = useState(null);
  const [activeSection, setActiveSection] = useState("All");
  const [performanceSection, setPerformanceSection] = useState("All");
  const [studentSearch, setStudentSearch] = useState("");
  const [unenrollTarget, setUnenrollTarget] = useState(null);
  const [unenrolling, setUnenrolling] = useState(false);
  const cachedUser = JSON.parse(localStorage.getItem("examnexus_user") || "{}");
  const [facultyProfile, setFacultyProfile] = useState(cachedUser);
  const [loading, setLoading] = useState(true);
  const [pendingRetakeCounts, setPendingRetakeCounts] = useState({});
  const facultyCanManage = canFacultyManageSubjects(facultyProfile);

  useEffect(() => {
    const notice = location.state?.notice;
    if (!notice?.message) return;

    setFlashNotice(notice);
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, navigate]);

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

      try {
        const counts = await fetchPendingRetakeCountsByExamIds(
          (assessmentData || []).map((row) => row.id)
        );
        setPendingRetakeCounts(counts);
      } catch {
        setPendingRetakeCounts({});
      }
    } catch (err) {
      console.error(err);
      if (!silent) showError(err.message || "Failed to load subject");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [subjectId, showError]);

  const loadAnalytics = useCallback(async (silent = false) => {
    if (!silent) setAnalyticsLoading(true);
    try {
      const data = await fetchSubjectClassAnalytics(subjectId, {
        sectionFilter: performanceSection === "All" ? null : performanceSection,
      });
      setClassAnalytics(data);
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setAnalyticsLoading(false);
    }
  }, [subjectId, performanceSection]);

  usePolling(loadSubjectPage, [subjectId]);
  usePolling(loadAnalytics, [subjectId, performanceSection]);

  const loadStudentRatings = useCallback(async (silent = false) => {
    if (!silent) setRatingsLoading(true);
    try {
      const rows = await fetchSubjectStudentAnalytics(subjectId);
      setStudentRatings(rows);
    } catch (err) {
      console.error(err);
      if (!silent) setStudentRatings([]);
    } finally {
      if (!silent) setRatingsLoading(false);
    }
  }, [subjectId]);

  usePolling(loadStudentRatings, [subjectId]);

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
    const shellCard = `min-w-0 overflow-hidden rounded-2xl border p-5 ${
      theme === "dark"
        ? "border-white/10 bg-white/5"
        : "en-bg-surface border border-emerald-300"
    }`;
    return (
      <div className={pageShellWithBellClass(theme)}>
        <div className="mb-8 space-y-3" aria-hidden="true">
          <div
            className={`h-9 w-64 max-w-full rounded-xl ${
              theme === "dark" ? "animate-pulse bg-white/10" : "en-skeleton-bone"
            }`}
          />
          <div
            className={`h-4 w-80 max-w-full rounded-lg ${
              theme === "dark" ? "animate-pulse bg-white/10" : "en-skeleton-bone"
            }`}
          />
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className={`${shellCard} lg:col-span-1`}>
            <h2
              className={`mb-4 text-lg font-semibold ${
                theme === "dark" ? "text-emerald-400" : "text-teal-700"
              }`}
            >
              Students
            </h2>
            <PanelContentSkeleton rows={5} variant="list" />
          </div>
          <div className={shellCard}>
            <h2
              className={`mb-4 text-lg font-semibold ${
                theme === "dark" ? "text-emerald-400" : "text-teal-700"
              }`}
            >
              Assessments
            </h2>
            <PanelContentSkeleton rows={4} variant="cards" />
          </div>
          <div className={shellCard}>
            <h2
              className={`mb-4 text-lg font-semibold ${
                theme === "dark" ? "text-emerald-400" : "text-teal-700"
              }`}
            >
              Class Performance
            </h2>
            <PanelContentSkeleton variant="chart" />
          </div>
        </div>
      </div>
    );
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

  const sortedClassmates = [...classmates].sort((a, b) => {
    const aName = `${a.first_name || ""} ${a.last_name || ""}`.trim().toLowerCase();
    const bName = `${b.first_name || ""} ${b.last_name || ""}`.trim().toLowerCase();
    return (
      aName.localeCompare(bName) ||
      String(a.school_id || "").localeCompare(String(b.school_id || ""))
    );
  });

  const filteredClassmates =
    activeSection === "All"
      ? sortedClassmates
      : sortedClassmates.filter(
          (c) => String(c.section || "A").toUpperCase() === activeSection
        );

  const visibleClassmates = filteredClassmates.filter((student) =>
    matchesStudentSearch(student, studentSearch)
  );

  const visibleAssessments =
    activeSection === "All"
      ? assessments
      : assessments.filter((assessment) =>
          isVisibleToSection(assessment.target_sections, activeSection, subjectSections)
        );

  const handleConfirmUnenroll = async () => {
    if (!unenrollTarget) return;
    try {
      setUnenrolling(true);
      await facultyUnenrollStudentFromSubject(subjectId, unenrollTarget.id);
      setClassmates((prev) => prev.filter((row) => row.id !== unenrollTarget.id));
      setStudentRatings((prev) => prev.filter((row) => row.id !== unenrollTarget.id));
      setUnenrollTarget(null);
      loadAnalytics(true);
    } catch (err) {
      showError(err.message || "Failed to unenroll student.");
    } finally {
      setUnenrolling(false);
    }
  };

  return (
 <div className={pageShellWithBellClass(theme)}>

    {flashNotice?.message && (
      <AlertBanner
        variant={flashNotice.variant || "success"}
        className="mb-6"
        scrollIntoView={false}
        autoDismissMs={4500}
        onDismiss={() => setFlashNotice(null)}
      >
        {flashNotice.message}
      </AlertBanner>
    )}

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
          className={iconButton(theme, "secondary", "disabled:opacity-50 disabled:cursor-not-allowed")}
          aria-label="Edit subject"
          title="Edit subject"
        >
          <Pencil size={16} />
        </button>
        </div>
        <p
  className={`mt-2 ${
    theme === "dark"
      ? "text-white"
      : "text-black"
  }`}
>
          Each section has its own invitation code. Share the matching code with students for that section.
        </p>
      </div>

      {!facultyCanManage && isFacultyRole(facultyProfile.role) && (
        <FacultyAvatarRequiredBanner user={facultyProfile} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
        <SubjectFacultyCard faculty={faculty || facultyProfile} />
        <div
          className={`lg:col-span-2 rounded-2xl p-5 border min-w-0 ${
            theme === "dark"
              ? "bg-white/5 border-white/10"
              : "en-bg-surface border border-emerald-300"
          }`}
        >
          <p className={`mb-3 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-700"}`}>
            {classmates.length} student{classmates.length === 1 ? "" : "s"} enrolled across{" "}
            {formatSubjectSectionsLabel(subject.section_count).toLowerCase()}.
          </p>
          <SubjectSectionInviteCodes
            subject={subject}
            sectionInvites={subject.section_invites}
            defaultOpen
            layout="grid"
          />
        </div>
      </div>

      {/* CREATE ASSESSMENT + SOCIAL */}
      <div className="mb-6 flex flex-wrap items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={() => {
            if (!requireFacultyAvatar()) return;
            setShowAssessmentModal(true);
          }}
          disabled={!facultyCanManage}
          className={iconButton(
            theme,
            "primary",
            "gap-2 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          title="Create assessment"
        >
          <Plus size={18} />
          <span className="text-sm font-semibold">Create Assessment</span>
        </button>

        <button
          type="button"
          onClick={() => setSectionAssessmentsOpen(true)}
          className={iconButton(theme, "primary", "gap-2 px-3")}
          aria-label="Section assessments"
          title="Section assessments"
        >
          <ClipboardList size={18} />
          <span className="text-sm font-semibold">Section assessments</span>
        </button>

        <button
          type="button"
          onClick={() => navigate(`/faculty/subject/${subjectId}/social`)}
          disabled={!facultyCanManage}
          className={iconButton(
            theme,
            "primary",
            "gap-2 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          aria-label="Announcements"
          title="Announcements"
        >
          <Megaphone size={18} />
          <span className="text-sm font-semibold">Announcements</span>
        </button>

        <button
          type="button"
          onClick={() => setRatingsOpen(true)}
          className={iconButton(theme, "primary", "gap-2 px-3")}
          aria-label="Student ratings"
          title="Student ratings"
        >
          <BarChart3 size={18} />
          <span className="text-sm font-semibold">Student ratings</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* STUDENTS */}
       <div
  className={`
    min-w-0 overflow-hidden
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

          <div className="relative mb-4 min-w-0">
            <Search
              size={16}
              className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${
                theme === "dark" ? "text-gray-500" : "text-gray-400"
              }`}
            />
            <input
              type="search"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="Search by name or school ID…"
              className={inputClass(theme, "w-full min-w-0 py-2.5 pl-9 pr-3")}
              aria-label="Search students by name or school ID"
            />
          </div>

          <SectionTabs
            active={activeSection}
            onChange={setActiveSection}
            counts={sectionCounts}
            sections={subjectSections}
          />

          <div className="mt-4 h-[min(28rem,60vh)] min-h-[12rem] min-w-0 space-y-2 overflow-y-auto overscroll-contain pr-1">
            {loading ? (
              <PanelContentSkeleton rows={5} variant="list" />
            ) : visibleClassmates.length === 0 ? (
              <p className={theme === "dark" ? "text-gray-400" : "text-gray-600"}>
                {studentSearch.trim()
                  ? "No students match your search."
                  : "No students in this section."}
              </p>
            ) : (
              visibleClassmates.map((student) => (
                <FacultyStudentCard
                  key={student.id}
                  student={student}
                  canUnenroll={facultyCanManage}
                  onUnenroll={
                    facultyCanManage
                      ? () => setUnenrollTarget(student)
                      : undefined
                  }
                />
              ))
            )}
          </div>
        </div>

        {/* ASSESSMENTS */}
        <div
          className={`mb-4 rounded-2xl border p-5 ${
            theme === "dark"
              ? "bg-white/5 border border-white/10"
              : "en-bg-surface border border-emerald-300"
          }`}
        >
          <div className="mb-4">
            <h2
              className={`font-semibold text-lg ${
                theme === "dark" ? "text-emerald-400" : "text-teal-700"
              }`}
            >
              Assessments
            </h2>
            <p className={`mt-1 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-700"}`}>
              {activeSection === "All"
                ? `${assessments.length} assessment${assessments.length === 1 ? "" : "s"} for this subject`
                : `${visibleAssessments.length} assessment${visibleAssessments.length === 1 ? "" : "s"} for Section ${activeSection} · tap All Sections to see every post`}
            </p>
          </div>

          {loading ? (
            <PanelContentSkeleton rows={4} variant="cards" />
          ) : visibleAssessments.length === 0 ? (
            <p className={theme === "dark" ? "text-white" : "text-black"}>
              {assessments.length === 0
                ? "No assessments yet"
                : `No assessments posted for Section ${activeSection}.`}
            </p>
          ) : (
            visibleAssessments.map((assessment) => (
              <div
                key={assessment.id}
                onClick={() =>
                  navigate(
                    pendingRetakeCounts[assessment.id]
                      ? `/faculty/assessment/${assessment.id}?tab=retakes`
                      : `/faculty/assessment/${assessment.id}`
                  )
                }
                className={`
      mb-3 last:mb-0
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
                <div className="flex items-center justify-between gap-3">
                  <h3
                    className={`font-semibold ${
                      theme === "dark" ? "text-emerald-400" : "text-[#0f766e]"
                    }`}
                  >
                    {assessment.title}
                  </h3>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    {pendingRetakeCounts[assessment.id] > 0 && (
                      <span
                        className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${
                          theme === "dark"
                            ? "bg-amber-500/15 text-amber-300"
                            : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        {pendingRetakeCounts[assessment.id]} retake
                        {pendingRetakeCounts[assessment.id] === 1 ? "" : "s"}
                      </span>
                    )}
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
        </div>

        {/* ANALYTICS */}
        <SubjectClassAnalyticsPanel
          analytics={classAnalytics}
          loading={analyticsLoading}
          sectionLabel={
            performanceSection === "All" ? null : `Section ${performanceSection}`
          }
          sections={subjectSections}
          activeSection={performanceSection}
          onSectionChange={setPerformanceSection}
          sectionCounts={sectionCounts}
        />

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
      <SectionAssessmentsModal
        open={sectionAssessmentsOpen}
        onClose={() => setSectionAssessmentsOpen(false)}
        subject={subject}
        assessments={assessments}
        loading={loading && assessments.length === 0}
        onSelectAssessment={(assessment) => {
          setSectionAssessmentsOpen(false);
          navigate(`/faculty/assessment/${assessment.id}`);
        }}
      />

      <SubjectStudentRatingsSidebar
        open={ratingsOpen}
        onClose={() => setRatingsOpen(false)}
        subject={subject}
        students={studentRatings}
        loading={ratingsLoading}
      />
      <EditSubjectModal
        subject={subject}
        classmates={classmates}
        open={showEditSubjectModal}
        onClose={() => setShowEditSubjectModal(false)}
        onSaved={(updated) => {
          setSubject(updated);
          const nextSections = getSubjectSections(updated);
          if (
            activeSection !== "All" &&
            !nextSections.includes(activeSection)
          ) {
            setActiveSection("All");
          }
          if (
            performanceSection !== "All" &&
            !nextSections.includes(performanceSection)
          ) {
            setPerformanceSection("All");
          }
        }}
      />
      <ActionDialog
        open={Boolean(unenrollTarget)}
        title="Unenroll student?"
        confirmLabel="Unenroll"
        cancelLabel="Keep enrolled"
        tone="danger"
        loading={unenrolling}
        onConfirm={handleConfirmUnenroll}
        onCancel={() => setUnenrollTarget(null)}
      >
        {unenrollTarget
          ? `Remove ${`${unenrollTarget.first_name || ""} ${unenrollTarget.last_name || ""}`.trim() || "this student"} from ${subject?.name || "this subject"}? They can re-enroll later with the invite code.`
          : null}
      </ActionDialog>
    </div>
  );
}