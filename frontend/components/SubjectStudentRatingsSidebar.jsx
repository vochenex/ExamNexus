import { useMemo, useState } from "react";
import { X, BarChart3, Search } from "lucide-react";
import ModalPortal from "./ui/ModalPortal";
import ProfileAvatar from "./ProfileAvatar";
import SectionTabs from "./SectionTabs";
import { useTheme } from "../layouts/ThemeContext";
import { buildSectionCounts, getSubjectSections } from "../utils/sections";
import { getCourseLabel, getDepartmentLabel } from "../utils/academicOptions";
import { matchesStudentSearch } from "../utils/studentSearch";
import { inputClass } from "../utils/themeInputs";

function toneClass(theme, tone) {
  const map = {
    emerald: theme === "dark" ? "from-emerald-500 to-teal-400" : "from-emerald-500 to-teal-500",
    teal: theme === "dark" ? "from-teal-500 to-cyan-400" : "from-teal-500 to-cyan-500",
    cyan: theme === "dark" ? "from-cyan-500 to-sky-400" : "from-cyan-500 to-sky-500",
    amber: theme === "dark" ? "from-amber-500 to-orange-400" : "from-amber-500 to-orange-500",
    orange: theme === "dark" ? "from-orange-500 to-red-400" : "from-orange-500 to-red-500",
  };
  return map[tone] || map.emerald;
}

function RatingBar({ label, value, theme, compact = false }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const width = pct > 0 ? Math.max(4, pct) : 0;

  return (
    <div className={compact ? "space-y-1" : "space-y-1.5"}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className={`min-w-0 break-words ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>
          {label}
        </span>
        <span className={`shrink-0 font-semibold ${theme === "dark" ? "text-emerald-300" : "text-teal-700"}`}>
          {pct}%
        </span>
      </div>
      <div
        className={`h-2 overflow-hidden rounded-full ${
          theme === "dark" ? "bg-white/10" : "en-skeleton-bone"
        }`}
      >
        <div
          className={`h-full rounded-full bg-gradient-to-r ${
            theme === "dark" ? "from-emerald-500 to-teal-400" : "from-emerald-500 to-teal-500"
          } transition-all duration-500`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

export default function SubjectStudentRatingsSidebar({
  open,
  onClose,
  subject,
  students = [],
  loading = false,
}) {
  const { theme } = useTheme();
  const [activeSection, setActiveSection] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const subjectSections = getSubjectSections(subject);
  const sectionCounts = buildSectionCounts(students, subjectSections);
  const initialLoading = loading && students.length === 0;

  const filteredStudents = useMemo(() => {
    let rows = students;
    if (activeSection !== "All") {
      rows = rows.filter(
        (student) => String(student.section || "A").toUpperCase() === activeSection
      );
    }
    if (searchQuery.trim()) {
      rows = rows.filter((student) => matchesStudentSearch(student, searchQuery));
    }
    return rows;
  }, [students, activeSection, searchQuery]);

  if (!open) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[160] flex justify-end" role="presentation">
        <button
          type="button"
          aria-label="Close student ratings"
          className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
          onClick={onClose}
        />
        <aside
          className={`
            en-student-ratings-sidebar
            relative z-10 flex h-full w-full max-w-full flex-col border-l shadow-2xl
            sm:max-w-md
            ${
              theme === "dark"
                ? "border-white/10 bg-[#071316]/92 backdrop-blur-xl"
                : "border-emerald-200/80 bg-white/92 backdrop-blur-xl"
            }
          `}
          role="dialog"
          aria-modal="true"
          aria-labelledby="student-ratings-title"
        >
          <div
            className={`flex items-start justify-between gap-3 border-b px-4 py-4 sm:px-5 ${
              theme === "dark" ? "border-white/10" : "border-emerald-100"
            }`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <BarChart3 size={18} className="text-emerald-400" />
                <h2
                  id="student-ratings-title"
                  className={`text-lg font-bold ${theme === "dark" ? "text-white" : "text-slate-900"}`}
                >
                  Student ratings
                </h2>
              </div>
              <p className={`mt-1 break-words text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                {subject?.name || "Subject"} — overall scores from submitted assessments
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className={`rounded-lg p-2 transition ${
                theme === "dark"
                  ? "text-gray-400 hover:bg-white/10 hover:text-white"
                  : "text-gray-500 hover:bg-emerald-50 hover:text-teal-800"
              }`}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-5">
            <div className="relative mb-4 min-w-0">
              <Search
                size={16}
                className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${
                  theme === "dark" ? "text-gray-500" : "text-gray-400"
                }`}
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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

            {initialLoading ? (
              <p className={`mt-4 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                Loading student ratings...
              </p>
            ) : filteredStudents.length === 0 ? (
              <p className={`mt-4 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                {searchQuery.trim()
                  ? "No students match your search."
                  : "No students in this section yet."}
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                {filteredStudents.map((student) => {
                  const name =
                    `${student.first_name || ""} ${student.last_name || ""}`.trim() || "Student";
                  const overall = student.overallRating ?? 0;
                  const tier = student.tier || { label: "No data", tone: "amber" };

                  return (
                    <div
                      key={student.id}
                      className={`min-w-0 overflow-hidden rounded-2xl border p-4 ${
                        theme === "dark"
                          ? "border-white/10 bg-white/[0.03]"
                          : "border-emerald-100 bg-emerald-50/40"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <ProfileAvatar src={student.avatar_url} alt={name} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p
                            className={`break-words text-sm font-semibold ${
                              theme === "dark" ? "text-white" : "text-slate-900"
                            }`}
                          >
                            {name}
                          </p>
                          <p className={`text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-600"}`}>
                            {student.school_id ? `ID: ${student.school_id}` : "Student"} · Section{" "}
                            {student.section || "A"}
                          </p>
                          {(student.department || student.course) && (
                            <p
                              className={`mt-1 break-words text-[11px] leading-snug ${
                                theme === "dark" ? "text-gray-400" : "text-gray-600"
                              }`}
                            >
                              {[getDepartmentLabel(student.department), getCourseLabel(student.department, student.course)]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className={`text-lg font-bold tabular-nums ${theme === "dark" ? "text-emerald-300" : "text-teal-700"}`}>
                            {student.overallRating != null ? `${student.overallRating}%` : "—"}
                          </p>
                          <p className={`text-[11px] font-semibold ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                            {tier.label}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        <RatingBar
                          label="Overall subject rating"
                          value={overall}
                          theme={theme}
                        />
                        {student.majorExamPct != null && (
                          <RatingBar
                            label="Major exams"
                            value={student.majorExamPct}
                            theme={theme}
                            compact
                          />
                        )}
                        {student.classStandingPct != null && (
                          <RatingBar
                            label="Class standing"
                            value={student.classStandingPct}
                            theme={theme}
                            compact
                          />
                        )}
                      </div>

                      {student.sectionScores?.length > 0 && (
                        <div className="mt-4 space-y-2 border-t border-inherit pt-3">
                          <p
                            className={`text-[11px] font-semibold uppercase tracking-wide ${
                              theme === "dark" ? "text-emerald-400/80" : "text-teal-700"
                            }`}
                          >
                            Assessment sections
                          </p>
                          {student.sectionScores.map((item) => (
                            <RatingBar
                              key={item.key}
                              label={item.label}
                              value={item.value}
                              theme={theme}
                              compact
                            />
                          ))}
                        </div>
                      )}

                      <div
                        className={`mt-3 h-1.5 overflow-hidden rounded-full ${
                          theme === "dark" ? "bg-white/10" : "en-skeleton-bone"
                        }`}
                      >
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${toneClass(theme, tier.tone)} transition-all duration-700`}
                          style={{ width: `${Math.max(0, Math.min(100, overall))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>
    </ModalPortal>
  );
}
