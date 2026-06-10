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
import { BookOpen, ArrowUpDown } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import Select from "../../components/ui/Select";
import { pageShellWithBellClass, emptyStateClass, staggerGridClass } from "../../utils/themeInputs";
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

function SubjectAssessmentGroup({ group, theme, focusId, onRetakeUpdated }) {
  return (
    <section
      className={`flex h-full flex-col rounded-2xl border p-4 md:p-5 ${
        theme === "dark"
          ? "border-white/10 bg-white/[0.03]"
          : "border-emerald-200/80 en-bg-surface-soft shadow-sm"
      }`}
    >
      <div className="mb-4 flex items-start gap-3 border-b pb-4 border-inherit">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            theme === "dark"
              ? "bg-emerald-500/10 text-emerald-300"
              : "en-bg-skeleton text-teal-700"
          }`}
        >
          <BookOpen size={18} />
        </div>
        <div className="min-w-0">
          <h2
            className={`truncate text-lg font-bold ${
              theme === "dark" ? "text-white" : "text-gray-900"
            }`}
          >
            {group.subjectName}
          </h2>
          <p
            className={`text-sm ${
              theme === "dark" ? "text-gray-400" : "text-gray-600"
            }`}
          >
            {group.assessments.length} assessment
            {group.assessments.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3">
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
      <div className="mx-auto max-w-7xl">
        <PageHeader
          theme={theme}
          icon={BookOpen}
          title="My Assessments"
          subtitle="Subjects are grouped side by side. Sort assessments within each subject by type, name, due date, or date created."
        />

        <div
          className={`mb-6 flex flex-col gap-3 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
            theme === "dark"
              ? "border-white/10 bg-white/[0.03]"
              : "border-emerald-200/80 en-bg-surface-soft"
          }`}
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
          <div className={staggerGridClass("grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3")}>
            {groupedAssessments.map((group) => (
              <SubjectAssessmentGroup
                key={group.subjectId}
                group={group}
                theme={theme}
                focusId={focusId}
                onRetakeUpdated={loadAssessments}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
