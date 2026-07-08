import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, CalendarDays, Filter, Users } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import { AdminVerticalBarChart } from "./admin/AdminBarChart";
import { PageLoadingSkeleton } from "./ui/PageLoadingSkeleton";
import { usePolling } from "../hooks/useRealtimeFetch";
import { fetchFacultyDashboardAnalytics } from "../utils/supabaseData";
import { normalizeYearLevel, YEAR_LEVEL_LABELS } from "../utils/yearLevels";
import { secondaryButtonSm } from "../utils/themeButtons";
import CollapsiblePanel from "./ui/CollapsiblePanel";
import Select from "./ui/Select";

function panelClass(theme) {
  return theme === "dark"
    ? "border-emerald-500/20 bg-gradient-to-br from-[#173a2e] via-[#123027] to-[#0d211b]"
    : "border-emerald-200/80 en-bg-elevated shadow-sm";
}

function formatAssessmentDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function buildLast14DayBuckets() {
  const buckets = [];
  const today = new Date();
  for (let offset = 13; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - offset);
    const key = day.toISOString().slice(0, 10);
    buckets.push({
      key,
      label: new Date(`${key}T12:00:00`).toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
      }),
    });
  }
  return buckets;
}

const ALL = "all";

function FilterSelect({ theme, label, value, onChange, options }) {
  const id = `faculty-filter-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <label htmlFor={id} className="flex min-w-0 flex-1 flex-col gap-1">
      <span
        className={`text-[11px] font-semibold uppercase tracking-wide ${
          theme === "dark" ? "text-gray-400" : "text-gray-500"
        }`}
      >
        {label}
      </span>
      <Select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="!py-2"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </label>
  );
}

export default function FacultyDashboardAnalyticsPanel({ teacherSchoolId }) {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  const [subjectFilter, setSubjectFilter] = useState(ALL);
  const [yearFilter, setYearFilter] = useState(ALL);
  const [sectionFilter, setSectionFilter] = useState(ALL);

  const load = useCallback(
    async (silent = false) => {
      if (!teacherSchoolId) {
        setAnalytics(null);
        if (!silent) setLoading(false);
        return;
      }

      try {
        if (!silent) setLoading(true);
        const data = await fetchFacultyDashboardAnalytics(teacherSchoolId);
        setAnalytics(data);
      } catch (err) {
        console.error("Faculty dashboard analytics:", err);
        setAnalytics(null);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [teacherSchoolId]
  );

  usePolling(load, [teacherSchoolId]);

  const submissions = analytics?.submissions ?? [];
  const assessments = analytics?.assessments ?? [];

  const filteredSubmissions = useMemo(
    () =>
      submissions.filter((row) => {
        if (subjectFilter !== ALL && row.subjectId !== subjectFilter) return false;
        if (yearFilter !== ALL && normalizeYearLevel(row.yearLevel) !== yearFilter)
          return false;
        if (sectionFilter !== ALL && row.section !== sectionFilter) return false;
        return true;
      }),
    [submissions, subjectFilter, yearFilter, sectionFilter]
  );

  const submissionsByDate = useMemo(() => {
    const counts = {};
    for (const row of filteredSubmissions) {
      counts[row.dateKey] = (counts[row.dateKey] || 0) + 1;
    }
    return buildLast14DayBuckets().map((bucket) => ({
      ...bucket,
      value: counts[bucket.key] || 0,
    }));
  }, [filteredSubmissions]);

  const submissionsBySection = useMemo(() => {
    const counts = {};
    for (const row of filteredSubmissions) {
      const key = row.section || "—";
      counts[key] = (counts[key] || 0) + 1;
    }
    return Object.entries(counts)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([label, value]) => ({
        key: label,
        label: label === "—" ? "Unknown" : `Sec ${label}`,
        value,
      }));
  }, [filteredSubmissions]);

  const filteredAssessments = useMemo(() => {
    const submittedPerExam = {};
    for (const row of filteredSubmissions) {
      submittedPerExam[row.examId] = (submittedPerExam[row.examId] || 0) + 1;
    }

    return assessments
      .filter((row) => {
        if (subjectFilter !== ALL && row.subjectId !== subjectFilter) return false;
        if (yearFilter !== ALL && normalizeYearLevel(row.yearLevel) !== yearFilter)
          return false;
        return true;
      })
      .map((row) => {
        const submitted = submittedPerExam[row.examId] || 0;
        const enrolled =
          sectionFilter === ALL
            ? row.enrolled
            : row.enrolledBySection?.[sectionFilter] || 0;
        return { ...row, submitted, enrolled, value: submitted };
      })
      .slice(0, 8);
  }, [assessments, filteredSubmissions, subjectFilter, yearFilter, sectionFilter]);

  const subjectOptions = useMemo(() => {
    const base = [{ value: ALL, label: "All subjects" }];
    for (const subject of analytics?.subjects ?? []) {
      base.push({ value: subject.id, label: subject.name });
    }
    return base;
  }, [analytics]);

  const yearOptions = useMemo(() => {
    const present = new Set(
      (analytics?.subjects ?? []).map((subject) =>
        normalizeYearLevel(subject.yearLevel)
      )
    );
    const base = [{ value: ALL, label: "All year levels" }];
    for (const [value, label] of Object.entries(YEAR_LEVEL_LABELS)) {
      if (present.has(value)) base.push({ value, label });
    }
    return base;
  }, [analytics]);

  const sectionOptions = useMemo(() => {
    const base = [{ value: ALL, label: "All sections" }];
    for (const section of analytics?.sections ?? []) {
      base.push({ value: section, label: `Section ${section}` });
    }
    return base;
  }, [analytics]);

  const hasActiveFilter =
    subjectFilter !== ALL || yearFilter !== ALL || sectionFilter !== ALL;

  const resetFilters = () => {
    setSubjectFilter(ALL);
    setYearFilter(ALL);
    setSectionFilter(ALL);
  };

  if (loading && !analytics) {
    return <PageLoadingSkeleton theme={theme} variant="list" className="!min-h-0 p-0" />;
  }

  if (!analytics) {
    return (
      <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
        Analytics will appear once you have subjects and student submissions.
      </p>
    );
  }

  const muted = theme === "dark" ? "text-gray-400" : "text-gray-600";
  const filteredTotal = filteredSubmissions.length;

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border p-3 sm:p-4 ${panelClass(theme)}`}>
        <div className="mb-2 flex items-center gap-2">
          <Filter size={15} className="text-emerald-400" />
          <h3
            className={`text-xs font-semibold uppercase tracking-wide ${
              theme === "dark" ? "text-gray-300" : "text-teal-800"
            }`}
          >
            Filters
          </h3>
          <span className={`ml-auto text-xs ${muted}`}>
            {filteredTotal} submission{filteredTotal === 1 ? "" : "s"}
          </span>
          {hasActiveFilter && (
            <button
              type="button"
              onClick={resetFilters}
              className={secondaryButtonSm(theme, "!px-2.5 !py-1 text-xs")}
            >
              Reset
            </button>
          )}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <FilterSelect
            theme={theme}
            label="Subject"
            value={subjectFilter}
            onChange={setSubjectFilter}
            options={subjectOptions}
          />
          <FilterSelect
            theme={theme}
            label="Year level"
            value={yearFilter}
            onChange={setYearFilter}
            options={yearOptions}
          />
          <FilterSelect
            theme={theme}
            label="Section"
            value={sectionFilter}
            onChange={setSectionFilter}
            options={sectionOptions}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className={`rounded-2xl border p-4 ${panelClass(theme)}`}>
          <div className="mb-3 flex items-center gap-2">
            <CalendarDays size={16} className="text-emerald-400" />
            <h3 className={`text-sm font-semibold ${theme === "dark" ? "text-white" : "text-teal-800"}`}>
              Submissions by date
            </h3>
            <span className={`ml-auto text-xs ${muted}`}>Last 14 days</span>
          </div>
          <AdminVerticalBarChart
            items={submissionsByDate}
            emptyMessage="No submissions in the last two weeks."
          />
        </div>

        <div className={`rounded-2xl border p-4 ${panelClass(theme)}`}>
          <div className="mb-3 flex items-center gap-2">
            <Users size={16} className="text-emerald-400" />
            <h3 className={`text-sm font-semibold ${theme === "dark" ? "text-white" : "text-teal-800"}`}>
              Submissions by section
            </h3>
          </div>
          <AdminVerticalBarChart
            items={submissionsBySection}
            emptyMessage="No section breakdown yet."
          />
        </div>

        <div className={`rounded-2xl border p-4 md:col-span-2 xl:col-span-1 ${panelClass(theme)}`}>
          <div className="mb-3 flex items-center gap-2">
            <BarChart3 size={16} className="text-emerald-400" />
            <h3 className={`text-sm font-semibold ${theme === "dark" ? "text-white" : "text-teal-800"}`}>
              Recent assessment volume
            </h3>
          </div>
          <AdminVerticalBarChart
            items={filteredAssessments}
            emptyMessage="No submission data for recent assessments."
          />
        </div>
      </div>

      <CollapsiblePanel
        title="Submissions per assessment"
        subtitle="How many students submitted on each recent assessment"
        defaultOpen
        className={panelClass(theme)}
      >
        {filteredAssessments.length === 0 ? (
          <p className={`text-sm ${muted}`}>No assessments match these filters.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {filteredAssessments.map((row) => {
              const rate =
                row.enrolled > 0 ? Math.round((row.submitted / row.enrolled) * 100) : 0;

              return (
                <button
                  key={row.key}
                  type="button"
                  onClick={() => navigate(`/faculty/assessment/${row.examId}`)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition hover:opacity-95 ${
                    theme === "dark"
                      ? "border-white/10 bg-black/20 hover:border-emerald-500/25"
                      : "border-emerald-100 bg-white hover:border-teal-300"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                      {row.fullTitle}
                    </p>
                    <p className={`mt-0.5 text-xs ${muted}`}>
                      {row.subjectName} · {formatAssessmentDate(row.date)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-sm font-bold tabular-nums ${theme === "dark" ? "text-emerald-300" : "text-teal-700"}`}>
                      {row.submitted}/{row.enrolled}
                    </p>
                    <p className={`text-[10px] ${muted}`}>{rate}% submitted</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CollapsiblePanel>
    </div>
  );
}
