import { useCallback, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ShieldAlert } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import PageHeader from "../../components/ui/PageHeader";
import ProfileAvatar from "../../components/ProfileAvatar";
import { PageLoadingSkeleton } from "../../components/ui/PageLoadingSkeleton";
import { usePolling } from "../../hooks/useRealtimeFetch";
import { fetchAdminExamLogs } from "../../utils/adminData";
import {
  adminTableClass,
  adminTableWrapClass,
  adminTdClass,
  adminThClass,
  adminTableInnerClass,
} from "../../components/admin/adminTableStyles";
import {
  pageShellClass,
  panelClass,
  staggerGridClass,
} from "../../utils/themeInputs";
import AdminPageError, { formatAdminError } from "../../components/admin/AdminPageError";
import {
  formatSectionLabel,
  formatTargetSectionsLabel,
  getSectionsForCount,
  normalizeSectionCount,
} from "../../utils/sections";

function eventMatchesSection(row, section) {
  if (!section || section === "all") return true;
  const studentSection = String(row.student_section || "").trim().toUpperCase();
  if (studentSection && studentSection === section) return true;
  const targets = Array.isArray(row.target_sections) ? row.target_sections : [];
  return targets.map((item) => String(item || "").trim().toUpperCase()).includes(section);
}

function ExamLogTable({ theme, events }) {
  return (
    <div className={`${adminTableWrapClass(theme)} rounded-xl`}>
      <div className={adminTableInnerClass()}>
        <table className={`${adminTableClass(theme)} min-w-[48rem]`}>
          <thead>
            <tr>
              <th className={adminThClass(theme)}>Time</th>
              <th className={adminThClass(theme)}>Student</th>
              <th className={adminThClass(theme)}>Section</th>
              <th className={adminThClass(theme)}>Dept.</th>
              <th className={adminThClass(theme)}>Course</th>
              <th className={adminThClass(theme)}>Faculty</th>
              <th className={adminThClass(theme)}>Event</th>
              <th className={adminThClass(theme)}>Details</th>
            </tr>
          </thead>
          <tbody>
            {events.map((row) => (
              <tr key={row.id}>
                <td className={adminTdClass(theme)}>
                  {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
                </td>
                <td className={adminTdClass(theme)}>
                  {row.student_name || row.student_id}
                </td>
                <td className={adminTdClass(theme)}>
                  {row.student_section
                    ? formatSectionLabel(row.student_section)
                    : "—"}
                </td>
                <td className={adminTdClass(theme)}>
                  {row.student_department || "—"}
                </td>
                <td className={adminTdClass(theme)}>{row.student_course || "—"}</td>
                <td className={adminTdClass(theme)}>{row.faculty_name || "—"}</td>
                <td className={adminTdClass(theme)}>{row.event_type}</td>
                <td className={adminTdClass(theme)}>{row.description || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminExamLogs() {
  const { theme } = useTheme();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [sectionFilter, setSectionFilter] = useState("all");
  const [openExamKeys, setOpenExamKeys] = useState(() => new Set());

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setLoadError("");
      const data = await fetchAdminExamLogs(500);
      setRows(data);
    } catch (err) {
      console.error(err);
      setRows([]);
      setLoadError(formatAdminError(err));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  usePolling(load, []);

  const subjects = useMemo(() => {
    const map = new Map();
    for (const row of rows) {
      const key = String(row.subject_id || row.subject_name || "unknown");
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          name: row.subject_name || "Unknown subject",
          sectionCount: normalizeSectionCount(row.section_count),
          facultyName: row.faculty_name || "—",
          facultySchoolId: row.teacher_school_id || "",
          facultyAvatarUrl: row.faculty_avatar_url || "",
          events: [],
          examIds: new Set(),
        });
      }
      const subject = map.get(key);
      subject.events.push(row);
      if (row.exam_id) subject.examIds.add(row.exam_id);
      if (row.section_count != null) {
        subject.sectionCount = normalizeSectionCount(row.section_count);
      }
      if (row.faculty_name && row.faculty_name !== "—") {
        subject.facultyName = row.faculty_name;
      }
      if (row.teacher_school_id) {
        subject.facultySchoolId = row.teacher_school_id;
      }
      if (row.faculty_avatar_url) {
        subject.facultyAvatarUrl = row.faculty_avatar_url;
      }
    }

    return [...map.values()]
      .map((subject) => ({
        ...subject,
        assessmentCount: subject.examIds.size,
        eventCount: subject.events.length,
        sections: getSectionsForCount(subject.sectionCount),
      }))
      .sort((a, b) => {
        const facultyA = (a.facultyName || "").toLowerCase();
        const facultyB = (b.facultyName || "").toLowerCase();
        const unassignedA = !a.facultyName || a.facultyName === "—";
        const unassignedB = !b.facultyName || b.facultyName === "—";
        if (unassignedA !== unassignedB) return unassignedA ? 1 : -1;
        const byFaculty = facultyA.localeCompare(facultyB);
        if (byFaculty !== 0) return byFaculty;
        return a.name.localeCompare(b.name);
      });
  }, [rows]);

  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === selectedSubjectId) || null,
    [subjects, selectedSubjectId]
  );

  const filteredEvents = useMemo(() => {
    if (!selectedSubject) return [];
    return selectedSubject.events.filter((row) =>
      eventMatchesSection(row, sectionFilter)
    );
  }, [selectedSubject, sectionFilter]);

  const assessments = useMemo(() => {
    const map = new Map();
    for (const row of filteredEvents) {
      const key = String(row.exam_id || row.exam_title || "unknown");
      if (!map.has(key)) {
        map.set(key, {
          key,
          title: row.exam_title || "Assessment",
          targetSections: row.target_sections || [],
          events: [],
        });
      }
      map.get(key).events.push(row);
    }
    return [...map.values()].sort((a, b) => a.title.localeCompare(b.title));
  }, [filteredEvents]);

  const openSubject = (subjectId) => {
    setSelectedSubjectId((prev) => {
      if (prev === subjectId) {
        setSectionFilter("all");
        setOpenExamKeys(new Set());
        return null;
      }
      setSectionFilter("all");
      setOpenExamKeys(new Set());
      return subjectId;
    });
  };

  const toggleExam = (key) => {
    setOpenExamKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAllExams = () => setOpenExamKeys(new Set(assessments.map((item) => item.key)));
  const collapseAllExams = () => setOpenExamKeys(new Set());

  if (loading && rows.length === 0) {
    return <PageLoadingSkeleton theme={theme} variant="list" />;
  }

  const muted = theme === "dark" ? "text-gray-400" : "text-gray-600";
  const chipBase =
    theme === "dark"
      ? "bg-white/5 text-gray-300 ring-1 ring-white/10"
      : "bg-slate-50 text-slate-700 ring-1 ring-slate-200";
  const chipActive =
    theme === "dark"
      ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/40"
      : "bg-emerald-50 text-teal-800 ring-1 ring-emerald-200";

  return (
    <div className={pageShellClass(theme, "mx-auto max-w-7xl")}>
      <PageHeader
        theme={theme}
        icon={ShieldAlert}
        title="Exam logs"
        subtitle="Browse integrity events by subject, then review sections and assessments."
      />

      {loadError && (
        <AdminPageError theme={theme} message={loadError} onRetry={() => load()} />
      )}

      {!subjects.length ? (
        <div className={panelClass(theme)}>
          <p className={`text-sm ${muted}`}>No exam log events recorded yet.</p>
        </div>
      ) : (
        <>
          <div
            className={staggerGridClass(
              "mb-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            )}
          >
            {subjects.map((subject) => {
              const active = selectedSubjectId === subject.id;
              return (
                <button
                  key={subject.id}
                  type="button"
                  onClick={() => openSubject(subject.id)}
                  aria-pressed={active}
                  className={`en-static-panel flex h-full min-h-[4.75rem] min-w-0 flex-col gap-1.5 rounded-xl border px-3 py-2.5 text-left transition ${
                    active
                      ? theme === "dark"
                        ? "border-emerald-400/50 bg-emerald-500/10 shadow-[0_0_0_1px_rgba(16,185,129,0.35)]"
                        : "border-teal-400 bg-emerald-50/80 shadow-[0_0_0_1px_rgba(13,148,136,0.25)]"
                      : theme === "dark"
                        ? "border-white/10 bg-white/[0.04] hover:border-emerald-500/35"
                        : "border-slate-200/80 bg-white hover:border-teal-300"
                  }`}
                >
                  <div className="flex min-w-0 items-start gap-2.5">
                    <ProfileAvatar
                      src={subject.facultyAvatarUrl}
                      alt={
                        subject.facultyName !== "—"
                          ? subject.facultyName
                          : "Faculty"
                      }
                      size="xs"
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-sm font-semibold leading-snug ${
                          theme === "dark" ? "text-white" : "text-slate-900"
                        }`}
                      >
                        {subject.name}
                      </p>
                      <p className={`mt-0.5 truncate text-[11px] ${muted}`}>
                        {subject.facultyName !== "—"
                          ? subject.facultyName
                          : "Unassigned faculty"}
                        {subject.facultySchoolId
                          ? ` · ${subject.facultySchoolId}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <p className={`pl-[2.625rem] text-[11px] tabular-nums ${muted}`}>
                    {subject.assessmentCount} assessment
                    {subject.assessmentCount === 1 ? "" : "s"}
                    {" · "}
                    {subject.eventCount} event{subject.eventCount === 1 ? "" : "s"}
                    {" · "}
                    {subject.sections.length} section
                    {subject.sections.length === 1 ? "" : "s"}
                  </p>
                </button>
              );
            })}
          </div>

          {selectedSubject && (
            <div className={`${panelClass(theme)} space-y-4`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <ProfileAvatar
                    src={selectedSubject.facultyAvatarUrl}
                    alt={
                      selectedSubject.facultyName !== "—"
                        ? selectedSubject.facultyName
                        : "Faculty"
                    }
                    size="sm"
                  />
                  <div className="min-w-0">
                  <h2
                    className={`text-lg font-semibold ${
                      theme === "dark" ? "text-white" : "text-slate-900"
                    }`}
                  >
                    {selectedSubject.name}
                  </h2>
                  <p className={`mt-0.5 text-sm ${muted}`}>
                    {selectedSubject.facultyName !== "—"
                      ? selectedSubject.facultyName
                      : "Unassigned faculty"}
                    {selectedSubject.facultySchoolId
                      ? ` · ${selectedSubject.facultySchoolId}`
                      : ""}
                    {" · "}
                    {selectedSubject.eventCount} total event
                    {selectedSubject.eventCount === 1 ? "" : "s"}
                  </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openSubject(selectedSubject.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${chipBase}`}
                >
                  Close
                </button>
              </div>

              <div>
                <p
                  className={`mb-2 text-xs font-semibold uppercase tracking-wide ${
                    theme === "dark" ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  Sections
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSectionFilter("all")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      sectionFilter === "all" ? chipActive : chipBase
                    }`}
                  >
                    All sections
                  </button>
                  {selectedSubject.sections.map((section) => (
                    <button
                      key={section}
                      type="button"
                      onClick={() => setSectionFilter(section)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                        sectionFilter === section ? chipActive : chipBase
                      }`}
                    >
                      {formatSectionLabel(section)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p
                  className={`text-xs font-semibold uppercase tracking-wide ${
                    theme === "dark" ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  Assessment exam logs
                  {sectionFilter !== "all"
                    ? ` · ${formatSectionLabel(sectionFilter)}`
                    : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={expandAllExams}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${chipActive}`}
                  >
                    Expand all
                  </button>
                  <button
                    type="button"
                    onClick={collapseAllExams}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${chipBase}`}
                  >
                    Collapse all
                  </button>
                </div>
              </div>

              {!assessments.length ? (
                <p className={`text-sm ${muted}`}>
                  No exam log events
                  {sectionFilter !== "all"
                    ? ` for ${formatSectionLabel(sectionFilter)}`
                    : ""}
                  .
                </p>
              ) : (
                <div className="space-y-3">
                  {assessments.map((assessment) => {
                    const open = openExamKeys.has(assessment.key);
                    return (
                      <div
                        key={assessment.key}
                        className={`min-w-0 overflow-hidden rounded-2xl border ${
                          theme === "dark"
                            ? "border-white/10 bg-white/[0.03]"
                            : "border-emerald-100 bg-white"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleExam(assessment.key)}
                          className={`flex w-full min-w-0 items-center justify-between gap-3 px-4 py-3 text-left ${
                            theme === "dark" ? "text-emerald-300" : "text-teal-800"
                          }`}
                        >
                          <span className="min-w-0 overflow-hidden">
                            <span className="block truncate text-sm font-semibold">
                              {assessment.title}
                            </span>
                            <span className={`mt-0.5 block truncate text-xs ${muted}`}>
                              {formatTargetSectionsLabel(
                                assessment.targetSections,
                                selectedSubject.sections
                              )}
                              {" · "}
                              {assessment.events.length} event
                              {assessment.events.length === 1 ? "" : "s"}
                            </span>
                          </span>
                          {open ? (
                            <ChevronUp size={16} className="shrink-0" />
                          ) : (
                            <ChevronDown size={16} className="shrink-0" />
                          )}
                        </button>

                        {open && (
                          <div className="border-t border-inherit p-3 sm:p-4">
                            <ExamLogTable theme={theme} events={assessment.events} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
