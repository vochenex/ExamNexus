import { useEffect, useState, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useTheme } from "../../layouts/ThemeContext";
import { resolveStudentId } from "../../utils/authUser";
import { fetchStudentAssessments } from "../../utils/supabaseData";
import StudentAssessmentCard from "../../components/StudentAssessmentCard";
import {
  groupAssessmentsBySubject,
  getAssessmentCategoryLabel,
  getAssessmentCategoryStyles,
} from "../../utils/assessmentCategories";
import { ASSESSMENT_SORT_OPTIONS } from "../../utils/assessmentStatus";
import { BookOpen, ArrowUpDown, ChevronDown, ChevronUp } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import Select from "../../components/ui/Select";
import {
  pageShellWithBellClass,
  emptyStateClass,
  panelClass,
} from "../../utils/themeInputs";
import { PageLoadingSkeleton } from "../../components/ui/PageLoadingSkeleton";
import { usePolling } from "../../hooks/useRealtimeFetch";

function CategoryLegend({ theme }) {
  const categories = ["exam", "quiz", "activity"];

  return (
    <div className="mb-6 flex flex-wrap gap-3">
      {categories.map((category) => {
        const styles = getAssessmentCategoryStyles(category, theme);
        return (
          <span
            key={category}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${styles.badge}`}
          >
            <span className={`h-2 w-2 rounded-full ${styles.dot}`} />
            {getAssessmentCategoryLabel(category)}
          </span>
        );
      })}
    </div>
  );
}

function SubjectAssessmentGroup({
  group,
  theme,
  focusId,
  onRetakeUpdated,
  defaultOpen = false,
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (!focusId) return;
    const hasFocus = group.assessments.some(
      (assessment) => String(assessment.id) === String(focusId)
    );
    if (hasFocus) setOpen(true);
  }, [focusId, group.assessments]);

  return (
    <section className={`${panelClass(theme)} !p-0 overflow-hidden`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`flex w-full min-w-0 items-center justify-between gap-3 px-4 py-3.5 text-left ${
          theme === "dark" ? "text-emerald-300" : "text-teal-800"
        }`}
      >
        <span className="flex min-w-0 items-start gap-3">
          <span
            className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              theme === "dark"
                ? "bg-emerald-500/10 text-emerald-300"
                : "en-bg-skeleton text-teal-700"
            }`}
          >
            <BookOpen size={18} />
          </span>
          <span className="min-w-0 overflow-hidden">
            <span
              className={`block truncate text-base font-bold ${
                theme === "dark" ? "text-white" : "text-gray-900"
              }`}
            >
              {group.subjectName}
            </span>
            <span
              className={`mt-0.5 block truncate text-xs ${
                theme === "dark" ? "text-gray-400" : "text-gray-600"
              }`}
            >
              {group.assessments.length} assessment
              {group.assessments.length === 1 ? "" : "s"}
              {group.sectionLabel ? ` · ${group.sectionLabel}` : ""}
              {group.courseName ? ` · ${group.courseName}` : ""}
            </span>
          </span>
        </span>
        {open ? (
          <ChevronUp size={18} className="shrink-0" />
        ) : (
          <ChevronDown size={18} className="shrink-0" />
        )}
      </button>

      {open && (
        <div
          className={`space-y-3 border-t px-3 py-3 sm:px-4 sm:py-4 ${
            theme === "dark" ? "border-white/10" : "border-emerald-100"
          }`}
        >
          {group.assessments.map((assessment) => (
            <StudentAssessmentCard
              key={assessment.id}
              assessment={assessment}
              showSubject={false}
              compact
              highlighted={focusId === String(assessment.id)}
              onRetakeUpdated={onRetakeUpdated}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default function StudentAssessments() {
  const { theme } = useTheme();
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get("focus");
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("hierarchy");

  const loadAssessments = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const studentId = await resolveStudentId();
      if (!studentId) {
        setAssessments([]);
        return;
      }

      const exams = await fetchStudentAssessments(studentId);
      setAssessments(exams);
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  usePolling(loadAssessments, []);

  const groupedAssessments = useMemo(
    () => groupAssessmentsBySubject(assessments, sortBy),
    [assessments, sortBy]
  );

  useEffect(() => {
    if (!focusId || loading) return;

    const timer = setTimeout(() => {
      document
        .getElementById(`assessment-${focusId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 350);

    return () => clearTimeout(timer);
  }, [focusId, loading, assessments.length]);

  if (loading) {
    return <PageLoadingSkeleton theme={theme} variant="cards" />;
  }

  return (
    <div className={pageShellWithBellClass(theme)}>
      <div className="mx-auto w-full max-w-7xl min-w-0">
        <PageHeader
          theme={theme}
          icon={BookOpen}
          title="My Assessments"
          subtitle="Subjects are grouped and collapsible. Sort assessments within each subject by type, name, due date, or date created."
        />

        <div
          className={`${panelClass(theme)} mb-6 flex flex-col gap-3 !py-3 sm:flex-row sm:items-center sm:justify-between`}
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <ArrowUpDown
              size={16}
              className={theme === "dark" ? "text-emerald-400" : "text-teal-600"}
            />
            Sort within each subject
          </div>
          <div className="w-full sm:max-w-xs">
            <Select
              id="assessment-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              {ASSESSMENT_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <CategoryLegend theme={theme} />

        {groupedAssessments.length === 0 ? (
          <div className={emptyStateClass(theme)}>No assessments available.</div>
        ) : (
          <div className="flex w-full min-w-0 flex-col gap-3">
            {groupedAssessments.map((group, index) => (
              <SubjectAssessmentGroup
                key={group.subjectId}
                group={group}
                theme={theme}
                focusId={focusId}
                onRetakeUpdated={loadAssessments}
                defaultOpen={index === 0 || Boolean(focusId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
