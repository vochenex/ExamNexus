import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  ClipboardCheck,
  CalendarClock,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import { primaryButtonSm, secondaryButtonSm } from "../../utils/themeButtons";
import { resolveStudentId, isAuthSessionError } from "../../utils/authUser";
import { fetchStudentAnalytics } from "../../utils/supabaseData";
import { getAssessmentCategoryLabel } from "../../utils/assessmentCategories";
import {
  AnalyticsPanel,
  DonutChart,
  HorizontalBarChart,
  ScoreTrendChart,
  StatCard,
} from "../../components/StudentAnalyticsCharts";
import StudentGradeCalculator from "../../components/StudentGradeCalculator";
import { PageLoadingSkeleton } from "../../components/ui/PageLoadingSkeleton";
import { usePolling } from "../../hooks/useRealtimeFetch";
import { staggerGridClass } from "../../utils/themeInputs";

export default function StudentDashboard() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("examnexus_user") || "{}");

  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [studentId, setStudentId] = useState(null);

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError("");

      const resolvedId = await resolveStudentId();
      if (!resolvedId) {
        localStorage.removeItem("examnexus_user");
        navigate("/auth", { replace: true });
        return;
      }

      setStudentId(resolvedId);
      const data = await fetchStudentAnalytics(resolvedId);
      setAnalytics(data);
    } catch (err) {
      console.error(err);
      if (isAuthSessionError(err)) {
        localStorage.removeItem("examnexus_user");
        navigate("/auth", { replace: true });
        return;
      }
      setError(err.message || "Failed to load dashboard analytics.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  usePolling(load, []);

  const greetingName = user.first_name || user.full_name?.split(" ")[0] || "Student";

  if (loading && !analytics) {
    return <PageLoadingSkeleton theme={theme} variant="dashboard" />;
  }

  if (error) {
    return (
      <div className={`min-h-full p-6 md:p-8 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className={`min-h-full p-6 md:p-8 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
        <p className={theme === "dark" ? "text-gray-400" : "text-gray-600"}>
          No dashboard data available yet.
        </p>
      </div>
    );
  }

  const hasResults = analytics.overallPct != null;

  const categorySegments = analytics.categoryBreakdown.map((item) => ({
    key: item.key,
    label: item.label,
    value: item.count,
    display: item.value != null ? `${item.value}%` : "—",
    color:
      item.key === "exam"
        ? "#ef4444"
        : item.key === "quiz"
          ? "#f59e0b"
          : "#3b82f6",
  }));

  const subjectBars = analytics.subjectPerformance.map((subject) => ({
    key: subject.subjectId || subject.subjectName,
    label: subject.subjectName,
    value: subject.averagePct,
    meta: subject.standing
      ? `${subject.standing.label}${subject.sectionPercentile != null ? ` · ${subject.sectionPercentile}th percentile in section` : ""}`
      : `${subject.assessmentsTaken} assessment${subject.assessmentsTaken === 1 ? "" : "s"} completed`,
  }));

  return (
    <div
      className={`min-h-full p-6 md:p-8 ${
        theme === "dark" ? "text-white" : "text-gray-900"
      }`}
    >
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className={`text-sm ${theme === "dark" ? "text-emerald-400" : "text-teal-700"}`}>
              Welcome back
            </p>
            <h1 className="mt-1 text-3xl font-bold md:text-4xl">
              {greetingName}&apos;s Dashboard
            </h1>
            <p className={`mt-2 max-w-2xl text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
              Track your class standing, major exam projections, and performance across
              subjects.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate("/student/assessments")}
              className={primaryButtonSm(theme)}
            >
              My Assessments
            </button>
            <button
              type="button"
              onClick={() => navigate("/student/results")}
              className={secondaryButtonSm(theme)}
            >
              View Results
            </button>
          </div>
        </div>

        <div className={staggerGridClass("grid gap-4 md:grid-cols-2 xl:grid-cols-4")}>
          <StatCard
            label="Enrolled Subjects"
            value={analytics.stats.enrolledSubjects}
            subtext="Active courses this term"
            icon={BookOpen}
            accent="cyan"
          />
          <StatCard
            label="Completed"
            value={analytics.stats.completedAssessments}
            subtext="Assessments submitted"
            icon={ClipboardCheck}
            accent="emerald"
          />
          <StatCard
            label="Upcoming"
            value={analytics.stats.upcomingAssessments}
            subtext="Available or scheduled"
            icon={CalendarClock}
            accent="amber"
          />
          <StatCard
            label="Overall Average"
            value={hasResults ? `${analytics.overallPct}%` : "—"}
            subtext={
              analytics.estimatedGrade
                ? `Est. GWA ${analytics.estimatedGrade.label} · ${analytics.estimatedGrade.remark}`
                : "Complete assessments to unlock"
            }
            icon={TrendingUp}
            accent="violet"
          />
        </div>

        <StudentGradeCalculator
          studentId={studentId}
          subjectGrades={analytics.subjectGrades || []}
        />

        <div className="grid gap-5 xl:grid-cols-12">
          <AnalyticsPanel
            title="Performance Mix"
            subtitle="Breakdown by assessment type"
            className="xl:col-span-4"
          >
            {categorySegments.length > 0 ? (
              <DonutChart
                segments={categorySegments}
                centerLabel="Types"
                centerValue={String(analytics.stats.completedAssessments)}
              />
            ) : (
              <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                No graded work yet.
              </p>
            )}
          </AnalyticsPanel>

          <AnalyticsPanel
            title="Quick Category Averages"
            subtitle="Exams, quizzes, and activities across all subjects"
            className="xl:col-span-8"
          >
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { key: "exam", label: "Exams", value: analytics.majorExamPct, color: "text-red-400" },
                { key: "quiz", label: "Quizzes", value: analytics.quizPct, color: "text-amber-400" },
                { key: "activity", label: "Activities", value: analytics.activityPct, color: "text-blue-400" },
              ].map((item) => (
                <div
                  key={item.key}
                  className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                    theme === "dark" ? "bg-white/5" : "en-bg-muted"
                  }`}
                >
                  <span className={`font-medium ${item.color}`}>{item.label}</span>
                  <span className={`font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                    {item.value != null ? `${item.value}%` : "—"}
                  </span>
                </div>
              ))}
            </div>
          </AnalyticsPanel>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <AnalyticsPanel
            title="Subject Performance"
            subtitle="Average score per enrolled subject"
          >
            <HorizontalBarChart items={subjectBars} />
          </AnalyticsPanel>

          <AnalyticsPanel
            title="Score Trend"
            subtitle="Your recent assessment percentages"
          >
            <ScoreTrendChart points={analytics.recentScores} />
          </AnalyticsPanel>
        </div>

        <AnalyticsPanel
          title="Due Soon"
          subtitle="Upcoming assessments to prepare for"
        >
            {analytics.dueSoon.length > 0 ? (
              <div className="space-y-3">
                {analytics.dueSoon.map((exam) => (
                  <div
                    key={exam.id}
                    className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                      theme === "dark"
                        ? "border-white/10 bg-white/[0.02]"
                        : "border-emerald-100 en-bg-elevated"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className={`truncate font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                        {exam.title}
                      </p>
                      <p className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                        {exam.subject_name} · {getAssessmentCategoryLabel(exam.assessment_category)}
                        {exam.end_datetime &&
                          ` · Due ${new Date(exam.end_datetime).toLocaleDateString("en-PH", {
                            month: "short",
                            day: "numeric",
                          })}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate("/student/assessments")}
                      className={`shrink-0 inline-flex items-center gap-1 text-sm font-semibold ${
                        theme === "dark" ? "text-emerald-400" : "text-teal-700"
                      }`}
                    >
                      Open
                      <ArrowRight size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                No upcoming deadlines right now. Check My Assessments for new tasks.
              </p>
            )}
        </AnalyticsPanel>
      </div>
    </div>
  );
}
