import { BarChart3, TrendingUp } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import { HorizontalBarChart } from "./StudentAnalyticsCharts";
import { formatSectionLabel } from "../utils/sections";
import PanelContentSkeleton from "./ui/PanelContentSkeleton";

export default function SubjectClassAnalyticsPanel({
  analytics,
  loading,
  sectionLabel = null,
  sections = [],
  activeSection = "All",
  onSectionChange,
  sectionCounts = null,
}) {
  const { theme } = useTheme();

  const panelClass = `rounded-2xl border p-5 h-full flex flex-col ${
    theme === "dark"
      ? "bg-white/[0.03] border-white/10"
      : "en-bg-surface border-emerald-200/80 shadow-sm"
  }`;

  if (loading && !analytics) {
    return (
      <div className={panelClass}>
        <PanelContentSkeleton variant="chart" />
      </div>
    );
  }

  const hasData =
    analytics?.majorExamPct != null ||
    analytics?.classStandingPct != null ||
    analytics?.majorExamChart?.length > 0;

  const showSectionFilter = typeof onSectionChange === "function" && sections.length > 0;

  return (
    <div className={panelClass}>
      <div className="mb-4 flex items-start gap-3">
        <div
          className={`rounded-xl p-2.5 ${
            theme === "dark" ? "bg-emerald-500/10 text-emerald-300" : "en-bg-muted text-teal-700"
          }`}
        >
          <BarChart3 size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <h2
            className={`font-semibold text-lg ${
              theme === "dark" ? "text-emerald-400" : "text-teal-700"
            }`}
          >
            Class Performance
          </h2>
          <p className={`text-xs mt-0.5 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
            {sectionLabel
              ? `Major exams and class standing for ${sectionLabel}`
              : "Major exams and class standing for this subject"}
          </p>
        </div>
      </div>

      {showSectionFilter && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onSectionChange("All")}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
              activeSection === "All"
                ? theme === "dark"
                  ? "bg-emerald-500 text-black"
                  : "bg-teal-600 text-white"
                : theme === "dark"
                  ? "border border-white/10 bg-white/5 text-gray-300 hover:border-emerald-500/30"
                  : "border border-emerald-200 en-bg-elevated text-gray-700 hover:border-teal-400"
            }`}
          >
            All sections
            {sectionCounts?.all != null ? ` (${sectionCounts.all})` : ""}
          </button>
          {sections.map((section) => {
            const selected = activeSection === section;
            const count = sectionCounts?.[section];
            return (
              <button
                key={section}
                type="button"
                onClick={() => onSectionChange(section)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                  selected
                    ? theme === "dark"
                      ? "bg-emerald-500 text-black"
                      : "bg-teal-600 text-white"
                    : theme === "dark"
                      ? "border border-white/10 bg-white/5 text-gray-300 hover:border-emerald-500/30"
                      : "border border-emerald-200 en-bg-elevated text-gray-700 hover:border-teal-400"
                }`}
              >
                {formatSectionLabel(section)}
                {count != null ? ` (${count})` : ""}
              </button>
            );
          })}
        </div>
      )}

      {!hasData ? (
        <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
          {activeSection !== "All"
            ? `No graded submissions yet for ${formatSectionLabel(activeSection)}.`
            : "No graded submissions yet. Performance charts appear after students complete assessments."}
        </p>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3">
            <div
              className={`rounded-xl border px-3 py-3 ${
                theme === "dark"
                  ? "border-red-500/20 bg-red-500/5"
                  : "border-red-200/80 bg-red-50/60"
              }`}
            >
              <p className={`text-[11px] font-semibold uppercase tracking-wide ${theme === "dark" ? "text-red-300" : "text-red-700"}`}>
                Major Exams
              </p>
              <p className={`mt-1 text-2xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                {analytics.majorExamPct != null ? `${analytics.majorExamPct}%` : "—"}
              </p>
              <p className={`text-[11px] mt-1 ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
                {analytics.majorExamCount || 0} exam{(analytics.majorExamCount || 0) === 1 ? "" : "s"} graded
              </p>
            </div>

            <div
              className={`rounded-xl border px-3 py-3 ${
                theme === "dark"
                  ? "border-cyan-500/20 bg-cyan-500/5"
                  : "border-cyan-200/80 bg-cyan-50/60"
              }`}
            >
              <p className={`text-[11px] font-semibold uppercase tracking-wide ${theme === "dark" ? "text-cyan-300" : "text-cyan-800"}`}>
                Class Standing
              </p>
              <p className={`mt-1 text-2xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                {analytics.classStandingPct != null ? `${analytics.classStandingPct}%` : "—"}
              </p>
              <p className={`text-[11px] mt-1 ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
                Quizzes & activities
              </p>
            </div>
          </div>

          {analytics.majorExamChart?.length > 0 && (
            <div className="flex-1">
              <div className="mb-3 flex items-center gap-2">
                <TrendingUp
                  size={16}
                  className={theme === "dark" ? "text-emerald-400" : "text-teal-600"}
                />
                <p className={`text-sm font-semibold ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}>
                  Major exam averages
                  {sectionLabel ? ` · ${sectionLabel}` : ""}
                </p>
              </div>
              <HorizontalBarChart items={analytics.majorExamChart} maxValue={100} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
