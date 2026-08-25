import { useCallback, useEffect, useMemo, useState } from "react";
import { Filter, Medal, Trophy } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import FacultyStudentCard from "./FacultyStudentCard";
import CollapsiblePanel from "./ui/CollapsiblePanel";
import Select from "./ui/Select";
import PanelContentSkeleton from "./ui/PanelContentSkeleton";
import { usePolling } from "../hooks/useRealtimeFetch";
import {
  fetchSubjectStudentAnalytics,
  fetchTeacherSubjects,
} from "../utils/supabaseData";
import { getSubjectSections } from "../utils/sections";
import { secondaryButtonSm } from "../utils/themeButtons";

function panelClass(theme) {
  return theme === "dark"
    ? "border-emerald-500/20 bg-gradient-to-br from-[#173a2e] via-[#123027] to-[#0d211b]"
    : "border-emerald-200/80 en-bg-elevated shadow-sm";
}

function FilterSelect({ theme, label, value, onChange, options, disabled = false }) {
  const id = `faculty-rank-${label.toLowerCase().replace(/\s+/g, "-")}`;
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
        disabled={disabled}
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

function rankBadgeClass(rank, theme) {
  if (rank === 1) {
    return theme === "dark"
      ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/40"
      : "bg-amber-100 text-amber-800 ring-1 ring-amber-300";
  }
  if (rank === 2) {
    return theme === "dark"
      ? "bg-slate-400/20 text-slate-200 ring-1 ring-slate-300/40"
      : "bg-slate-100 text-slate-700 ring-1 ring-slate-300";
  }
  if (rank === 3) {
    return theme === "dark"
      ? "bg-orange-500/20 text-orange-300 ring-1 ring-orange-400/40"
      : "bg-orange-100 text-orange-800 ring-1 ring-orange-300";
  }
  return theme === "dark"
    ? "bg-white/10 text-gray-300"
    : "bg-emerald-50 text-teal-800";
}

function tierToneClass(theme, tone) {
  const map = {
    emerald: theme === "dark" ? "text-emerald-300" : "text-emerald-700",
    teal: theme === "dark" ? "text-teal-300" : "text-teal-700",
    cyan: theme === "dark" ? "text-cyan-300" : "text-cyan-700",
    amber: theme === "dark" ? "text-amber-300" : "text-amber-700",
    orange: theme === "dark" ? "text-orange-300" : "text-orange-700",
  };
  return map[tone] || map.emerald;
}

/**
 * Faculty dashboard: rank enrolled students by overall class performance
 * (weighted major exams + class standing) for a subject/section.
 */
export default function FacultyStudentRankingPanel({ teacherSchoolId }) {
  const { theme } = useTheme();
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState("");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [rows, setRows] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [loadingRanks, setLoadingRanks] = useState(false);
  const [error, setError] = useState("");

  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === subjectId) || null,
    [subjects, subjectId]
  );

  const sectionOptions = useMemo(() => {
    const sections = getSubjectSections(selectedSubject);
    return [
      { value: "all", label: "All sections" },
      ...sections.map((section) => ({
        value: section,
        label: `Section ${section}`,
      })),
    ];
  }, [selectedSubject]);

  const subjectOptions = useMemo(
    () => [
      { value: "", label: "Select a subject" },
      ...subjects.map((subject) => ({
        value: subject.id,
        label: subject.name || "Untitled subject",
      })),
    ],
    [subjects]
  );

  const loadSubjects = useCallback(
    async (silent = false) => {
      if (!teacherSchoolId) {
        setSubjects([]);
        if (!silent) setLoadingSubjects(false);
        return;
      }

      try {
        if (!silent) setLoadingSubjects(true);
        const data = await fetchTeacherSubjects(teacherSchoolId);
        setSubjects(data || []);
        setSubjectId((current) => {
          if (current && (data || []).some((row) => row.id === current)) {
            return current;
          }
          return "";
        });
      } catch (err) {
        console.error("Faculty student ranking subjects:", err);
        setError(err?.message || "Could not load subjects.");
        setSubjects([]);
      } finally {
        if (!silent) setLoadingSubjects(false);
      }
    },
    [teacherSchoolId]
  );

  usePolling(loadSubjects, [teacherSchoolId]);

  useEffect(() => {
    if (!selectedSubject) {
      setSectionFilter("all");
      return;
    }
    const allowed = new Set(getSubjectSections(selectedSubject));
    setSectionFilter((current) =>
      current === "all" || allowed.has(current) ? current : "all"
    );
  }, [selectedSubject]);

  const loadRanks = useCallback(
    async (silent = false) => {
      if (!subjectId) {
        setRows([]);
        setError("");
        if (!silent) setLoadingRanks(false);
        return;
      }

      try {
        if (!silent) setLoadingRanks(true);
        setError("");
        const data = await fetchSubjectStudentAnalytics(subjectId, {
          sectionFilter: sectionFilter === "all" ? null : sectionFilter,
        });
        setRows(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Faculty student ranking:", err);
        setRows([]);
        setError(err?.message || "Could not load student rankings.");
      } finally {
        if (!silent) setLoadingRanks(false);
      }
    },
    [subjectId, sectionFilter]
  );

  usePolling(loadRanks, [subjectId, sectionFilter]);

  const ranked = useMemo(() => {
    const list = Array.isArray(rows) ? rows : [];
    return list.map((student) => {
      if (student.overallRating == null) {
        return { ...student, rank: null };
      }
      const higher = list.filter(
        (other) =>
          other.overallRating != null &&
          other.overallRating > student.overallRating
      ).length;
      return { ...student, rank: higher + 1 };
    });
  }, [rows]);

  const muted = theme === "dark" ? "text-gray-400" : "text-gray-600";
  const scoredCount = ranked.filter((row) => row.overallRating != null).length;

  const resetFilters = () => {
    setSubjectId("");
    setSectionFilter("all");
    setRows([]);
    setError("");
  };

  return (
    <CollapsiblePanel
      title="Student ranking"
      subtitle="Best overall class performance by subject and section"
      defaultOpen
      className={panelClass(theme)}
    >
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
              {subjectId
                ? `${scoredCount} ranked · ${ranked.length} enrolled`
                : "Pick a subject"}
            </span>
            {(subjectId || sectionFilter !== "all") && (
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
              value={subjectId}
              onChange={setSubjectId}
              options={subjectOptions}
              disabled={loadingSubjects && subjects.length === 0}
            />
            <FilterSelect
              theme={theme}
              label="Section"
              value={sectionFilter}
              onChange={setSectionFilter}
              options={sectionOptions}
              disabled={!selectedSubject}
            />
          </div>
        </div>

        {error ? (
          <p className={`text-sm ${theme === "dark" ? "text-red-300" : "text-red-600"}`}>
            {error}
          </p>
        ) : null}

        {!subjectId ? (
          <div
            className={`flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-10 text-center ${
              theme === "dark"
                ? "border-white/10 text-gray-400"
                : "border-emerald-200 text-gray-600"
            }`}
          >
            <Trophy size={28} className="text-emerald-400 opacity-80" />
            <p className="text-sm">
              Select a subject to rank students by overall class performance.
            </p>
          </div>
        ) : loadingRanks && ranked.length === 0 ? (
          <PanelContentSkeleton theme={theme} rows={4} />
        ) : ranked.length === 0 ? (
          <p className={`text-sm ${muted}`}>
            No enrolled students in this subject
            {sectionFilter !== "all" ? ` · Section ${sectionFilter}` : ""}.
          </p>
        ) : (
          <ul className="space-y-2">
            {ranked.map((student) => (
              <li
                key={student.id}
                className="flex min-w-0 items-stretch gap-2 sm:gap-3"
              >
                <div
                  className={`flex h-auto w-10 shrink-0 items-center justify-center self-stretch rounded-xl text-sm font-bold tabular-nums ${rankBadgeClass(
                    student.rank,
                    theme
                  )}`}
                  title={
                    student.rank != null
                      ? `Rank #${student.rank}`
                      : "No scored assessments yet"
                  }
                >
                  {student.rank != null ? (
                    student.rank <= 3 ? (
                      <span className="flex flex-col items-center gap-0.5">
                        <Medal size={16} />
                        <span className="text-[10px]">#{student.rank}</span>
                      </span>
                    ) : (
                      `#${student.rank}`
                    )
                  ) : (
                    "—"
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <FacultyStudentCard student={student} />
                </div>

                <div
                  className={`flex w-[4.75rem] shrink-0 flex-col items-end justify-center rounded-xl border px-2 py-2 sm:w-24 ${
                    theme === "dark"
                      ? "border-white/10 bg-black/20"
                      : "border-emerald-100 bg-white"
                  }`}
                >
                  <p
                    className={`text-sm font-bold tabular-nums ${
                      theme === "dark" ? "text-emerald-300" : "text-teal-700"
                    }`}
                  >
                    {student.grade}
                  </p>
                  <p
                    className={`truncate text-[10px] ${
                      student.tier
                        ? tierToneClass(theme, student.tier.tone)
                        : muted
                    }`}
                  >
                    {student.tier?.label ||
                      (student.submissions
                        ? `${student.submissions} submitted`
                        : "No scores")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </CollapsiblePanel>
  );
}
