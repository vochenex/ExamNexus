import { useCallback, useMemo, useState } from "react";
import { Search, UserMinus, UserPlus } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import { panelClass, inputClass } from "../utils/themeInputs";
import ProgressButton from "./ui/ProgressButton";
import ProfileAvatar from "./ProfileAvatar";
import {
  excludeStudentFromExam,
  fetchExamExclusions,
  fetchSubjectClassmates,
  includeStudentInExam,
} from "../utils/supabaseData";
import { useAppModal } from "../contexts/AppModalContext";
import { usePolling } from "../hooks/useRealtimeFetch";
import { matchesStudentSearch } from "../utils/studentSearch";

function displayName(row) {
  const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
  return name || row.email || row.school_id || "Student";
}

export default function ExamExclusionsPanel({ examId, subjectId, onUpdated }) {
  const { theme } = useTheme();
  const appModal = useAppModal();
  const [exclusions, setExclusions] = useState([]);
  const [classmates, setClassmates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(
    async (silent = false) => {
      if (!examId || !subjectId) return;
      try {
        if (!silent) setLoading(true);
        setError("");
        const [exclusionRows, classmateRows] = await Promise.all([
          fetchExamExclusions(examId),
          fetchSubjectClassmates(subjectId),
        ]);
        setExclusions(exclusionRows);
        setClassmates(classmateRows || []);
      } catch (err) {
        setError(
          err.message?.includes("exam_student_exclusions") ||
            err.message?.includes("exclude_student_from_exam") ||
            err.message?.includes("get_exam_exclusions")
            ? "Run database/exam_student_exclusions.sql in Supabase to enable exclusions."
            : err.message || "Failed to load exclusions."
        );
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [examId, subjectId]
  );

  usePolling(load, [examId, subjectId]);

  const excludedIds = useMemo(
    () => new Set(exclusions.map((row) => row.student_id)),
    [exclusions]
  );

  const searchableStudents = useMemo(() => {
    const fromClass = (classmates || []).map((row) => ({
      student_id: row.student_id || row.id,
      first_name: row.first_name,
      last_name: row.last_name,
      email: row.email,
      school_id: row.school_id,
      avatar_url: row.avatar_url,
      section: row.section,
      excluded: excludedIds.has(row.student_id || row.id),
    }));

    // Keep excluded students visible even if they left the subject roster.
    for (const row of exclusions) {
      if (!fromClass.some((entry) => entry.student_id === row.student_id)) {
        fromClass.push({
          student_id: row.student_id,
          first_name: row.first_name,
          last_name: row.last_name,
          email: row.email,
          school_id: row.school_id,
          avatar_url: row.avatar_url,
          section: null,
          excluded: true,
          score: row.score,
          total: row.total,
        });
      }
    }

    return fromClass.filter((row) => matchesStudentSearch(row, search));
  }, [classmates, exclusions, excludedIds, search]);

  const handleExclude = async (student) => {
    const confirmed = await appModal.confirm({
      title: "Exclude student from this assessment?",
      message: `${displayName(student)} will be marked Excluded, skip the exam, and receive a perfect score automatically.`,
      tone: "warning",
      confirmLabel: "Exclude & award perfect score",
    });
    if (!confirmed) return;

    try {
      setBusyId(student.student_id);
      await excludeStudentFromExam(examId, student.student_id);
      await load(true);
      onUpdated?.();
    } catch (err) {
      appModal.error(err.message || "Could not exclude student.");
    } finally {
      setBusyId(null);
    }
  };

  const handleInclude = async (student) => {
    const confirmed = await appModal.confirm({
      title: "Restore student to this assessment?",
      message: `${displayName(student)} will be removed from the exclusion list and their auto perfect score will be cleared so they can take the assessment normally.`,
      tone: "warning",
      confirmLabel: "Restore student",
    });
    if (!confirmed) return;

    try {
      setBusyId(student.student_id);
      await includeStudentInExam(examId, student.student_id);
      await load(true);
      onUpdated?.();
    } catch (err) {
      appModal.error(err.message || "Could not restore student.");
    } finally {
      setBusyId(null);
    }
  };

  if (loading && exclusions.length === 0 && classmates.length === 0) {
    return (
      <div className={`animate-pulse space-y-3 ${panelClass(theme)}`}>
        <div className={`h-5 w-48 rounded-lg ${theme === "dark" ? "bg-white/10" : "en-bg-skeleton"}`} />
        <div className={`h-10 rounded-xl ${theme === "dark" ? "bg-white/10" : "en-bg-skeleton"}`} />
        <div className={`h-16 rounded-xl ${theme === "dark" ? "bg-white/10" : "en-bg-skeleton"}`} />
      </div>
    );
  }

  return (
    <div className={panelClass(theme)}>
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <UserMinus
            size={20}
            className={theme === "dark" ? "text-slate-300" : "text-slate-700"}
          />
          <h3
            className={`text-lg font-semibold ${
              theme === "dark" ? "text-white" : "text-teal-800"
            }`}
          >
            Exclude students
          </h3>
        </div>
        <p className={`mt-1 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
          Search enrolled students. Excluded students see an <strong>Excluded</strong> badge
          instead of Completed and are awarded a perfect score automatically.
        </p>
      </div>

      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      <div className="relative mb-4">
        <Search
          size={16}
          className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${
            theme === "dark" ? "text-gray-500" : "text-gray-400"
          }`}
        />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name, school ID, or email…"
          className={`${inputClass(theme)} !pl-9`}
        />
      </div>

      <p className={`mb-3 text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
        {exclusions.length} excluded · showing {searchableStudents.length} match
        {searchableStudents.length === 1 ? "" : "es"}
      </p>

      {searchableStudents.length === 0 ? (
        <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
          No students match this search.
        </p>
      ) : (
        <ul className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
          {searchableStudents.map((student) => (
            <li
              key={student.student_id}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${
                theme === "dark"
                  ? "border-white/10 bg-black/20"
                  : "border-emerald-100 en-bg-elevated"
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <ProfileAvatar
                  src={student.avatar_url}
                  alt={displayName(student)}
                  size="sm"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{displayName(student)}</p>
                  <p
                    className={`truncate text-xs ${
                      theme === "dark" ? "text-gray-500" : "text-gray-500"
                    }`}
                  >
                    {student.school_id || student.email || "Student"}
                    {student.section ? ` · Section ${student.section}` : ""}
                    {student.excluded && student.score != null && student.total != null
                      ? ` · ${student.score}/${student.total}`
                      : ""}
                  </p>
                </div>
              </div>

              {student.excluded ? (
                <ProgressButton
                  type="button"
                  loading={busyId === student.student_id}
                  loadingLabel="Restoring"
                  onClick={() => handleInclude(student)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    theme === "dark"
                      ? "border border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                      : "border border-emerald-300 bg-emerald-50 text-emerald-900"
                  }`}
                >
                  <UserPlus size={14} />
                  Restore
                </ProgressButton>
              ) : (
                <ProgressButton
                  type="button"
                  loading={busyId === student.student_id}
                  loadingLabel="Excluding"
                  onClick={() => handleExclude(student)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    theme === "dark"
                      ? "border border-slate-400/30 bg-slate-500/10 text-slate-200"
                      : "border border-slate-300 bg-slate-100 text-slate-800"
                  }`}
                >
                  <UserMinus size={14} />
                  Exclude
                </ProgressButton>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
