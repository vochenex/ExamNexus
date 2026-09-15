import { useCallback, useMemo, useState } from "react";
import { BookOpen, Plus, Search, Trash2 } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import { useAppModal } from "../../contexts/AppModalContext";
import PageHeader from "../../components/ui/PageHeader";
import Select from "../../components/ui/Select";
import { YearLevelSelect } from "../../components/YearLevelBadge";
import { PageLoadingSkeleton } from "../../components/ui/PageLoadingSkeleton";
import { usePolling } from "../../hooks/useRealtimeFetch";
import {
  adminAssignSubjectFaculty,
  adminCreateSubject,
  adminDeleteSubject,
  adminUpdateSubject,
  fetchAdminFaculty,
  fetchAdminSubjectsWithFaculty,
} from "../../utils/adminData";
import {
  adminTableClass,
  adminTableWrapClass,
  adminTdClass,
  adminThClass,
  adminTableInnerClass,
} from "../../components/admin/adminTableStyles";
import AdminPageError, { formatAdminError } from "../../components/admin/AdminPageError";
import { pageShellClass, inputClass, panelClass } from "../../utils/themeInputs";
import { iconButton, primaryButton } from "../../utils/themeButtons";
import ProgressButton from "../../components/ui/ProgressButton";
import { DEFAULT_SECTION_COUNT } from "../../utils/sections";
import { DEFAULT_YEAR_LEVEL } from "../../utils/yearLevels";

function facultyLabel(subject, facultyRows) {
  const schoolId = subject?.teacher_school_id;
  if (!schoolId) return "";
  const match = facultyRows.find((f) => f.school_id === schoolId);
  if (!match) return String(schoolId);
  return [[match.first_name, match.last_name].filter(Boolean).join(" "), match.school_id]
    .filter(Boolean)
    .join(" ");
}

function FieldLabel({ theme, children, htmlFor }) {
  return (
    <label
      htmlFor={htmlFor}
      className={`mb-1.5 block text-xs font-semibold uppercase tracking-wide ${
        theme === "dark" ? "text-gray-400" : "text-gray-500"
      }`}
    >
      {children}
    </label>
  );
}

export default function AdminSubjects() {
  const { theme } = useTheme();
  const { success, error, confirm } = useAppModal();
  const [subjects, setSubjects] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [busySubjectId, setBusySubjectId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [form, setForm] = useState({
    name: "",
    teacherSchoolId: "",
    yearLevel: DEFAULT_YEAR_LEVEL,
    sectionCount: DEFAULT_SECTION_COUNT,
  });

  const visibleSubjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter((subject) => {
      const name = String(subject.name || "").toLowerCase();
      const assigned = facultyLabel(subject, faculty).toLowerCase();
      return name.includes(q) || assigned.includes(q);
    });
  }, [subjects, faculty, searchQuery]);

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setLoadError("");
      const [subjectRows, facultyRows] = await Promise.all([
        fetchAdminSubjectsWithFaculty(),
        fetchAdminFaculty(),
      ]);
      setSubjects(subjectRows);
      setFaculty(facultyRows);
    } catch (err) {
      console.error(err);
      setSubjects([]);
      setFaculty([]);
      setLoadError(formatAdminError(err));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  usePolling(load, []);

  const handleCreate = async () => {
    if (creating) return;
    if (!form.name.trim() || !form.teacherSchoolId) {
      error("Subject name and assigned faculty are required.");
      return;
    }
    try {
      setCreating(true);
      await adminCreateSubject({
        name: form.name,
        teacherSchoolId: form.teacherSchoolId,
        yearLevel: form.yearLevel,
        sectionCount: form.sectionCount,
      });
      await success("Subject created.");
      setForm({
        name: "",
        teacherSchoolId: "",
        yearLevel: DEFAULT_YEAR_LEVEL,
        sectionCount: DEFAULT_SECTION_COUNT,
      });
      await load(true);
    } catch (err) {
      error(err.message || "Failed to create subject.");
    } finally {
      setCreating(false);
    }
  };

  const handleAssign = async (subjectId, facultySchoolId) => {
    if (busySubjectId || deletingId) return;
    try {
      setBusySubjectId(subjectId);
      await adminAssignSubjectFaculty(subjectId, facultySchoolId);
      await success(
        facultySchoolId ? "Faculty assignment updated." : "Faculty unassigned."
      );
      await load(true);
    } catch (err) {
      error(err.message || "Failed to assign faculty.");
      await load(true);
    } finally {
      setBusySubjectId(null);
    }
  };

  const handleSectionCount = async (subjectId, sectionCount) => {
    if (busySubjectId || deletingId) return;
    try {
      setBusySubjectId(subjectId);
      await adminUpdateSubject(subjectId, { section_count: sectionCount });
      await load(true);
    } catch (err) {
      error(err.message || "Failed to update sections.");
    } finally {
      setBusySubjectId(null);
    }
  };

  const handleDelete = async (subject) => {
    if (deletingId || creating || busySubjectId) return;
    const ok = await confirm({
      title: "Delete subject?",
      message: `Delete "${subject.name}"? Enrollments and assessments may be affected.`,
      tone: "danger",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      setDeletingId(subject.id);
      await adminDeleteSubject(subject.id);
      await success("Subject deleted.");
      await load(true);
    } catch (err) {
      error(err.message || "Failed to delete subject.");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading && subjects.length === 0) return <PageLoadingSkeleton theme={theme} variant="list" />;

  return (
    <div className={pageShellClass(theme, "mx-auto max-w-7xl")}>
      <PageHeader
        theme={theme}
        icon={BookOpen}
        title="Manage subjects"
        subtitle="Create subjects, set section counts, and assign faculty instructors."
      />

      {loadError && (
        <AdminPageError theme={theme} message={loadError} onRetry={() => load()} />
      )}

      <div className={`${panelClass(theme)} mb-6`}>
        <div
          className={`border-b px-4 py-3 sm:px-5 ${
            theme === "dark" ? "border-white/10" : "border-emerald-100"
          }`}
        >
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Plus
              size={18}
              className={theme === "dark" ? "text-emerald-400" : "text-teal-700"}
            />
            Create subject
          </h2>
          <p className={`mt-0.5 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
            Set up a new course and assign an approved faculty member.
          </p>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          <div>
            <FieldLabel theme={theme} htmlFor="admin-subject-name">
              Subject name
            </FieldLabel>
            <input
              id="admin-subject-name"
              className={inputClass(theme)}
              placeholder="e.g. Programming 1"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <FieldLabel theme={theme}>Assign faculty</FieldLabel>
              <Select
                value={form.teacherSchoolId}
                onChange={(e) => setForm({ ...form, teacherSchoolId: e.target.value })}
              >
                <option value="">Select faculty</option>
                {faculty.map((f) => (
                  <option key={f.id} value={f.school_id}>
                    {[f.first_name, f.last_name].filter(Boolean).join(" ")} ({f.school_id})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <FieldLabel theme={theme}>Year level</FieldLabel>
              <YearLevelSelect
                value={form.yearLevel}
                onChange={(value) => setForm({ ...form, yearLevel: value })}
              />
            </div>
            <div>
              <FieldLabel theme={theme}>Class sections</FieldLabel>
              <Select
                value={String(form.sectionCount)}
                onChange={(e) =>
                  setForm({ ...form, sectionCount: Number(e.target.value) })
                }
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n} section{n === 1 ? "" : "s"}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div
            className={`flex justify-stretch border-t pt-4 sm:justify-end ${
              theme === "dark" ? "border-white/10" : "border-emerald-100"
            }`}
          >
            <ProgressButton
              type="button"
              onClick={handleCreate}
              loading={creating}
              loadingLabel="Creating…"
              disabled={!form.name.trim() || !form.teacherSchoolId || Boolean(deletingId)}
              className={`${primaryButton(theme)} w-full sm:w-auto disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <Plus size={18} />
              Create subject
            </ProgressButton>
          </div>
        </div>
      </div>

      <div className={adminTableWrapClass(theme)}>
        <div
          className={`border-b px-3 py-3 sm:px-4 ${
            theme === "dark" ? "border-white/10" : "border-slate-100"
          }`}
        >
          <div className="relative min-w-0 w-full max-w-md">
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
              placeholder="Search subjects…"
              className={inputClass(theme, "w-full min-w-0 py-2.5 pl-9 pr-3")}
              aria-label="Search subjects by name or assigned faculty"
            />
          </div>
        </div>
        <div className={adminTableInnerClass()}>
          <table className={`${adminTableClass(theme)} min-w-[36rem] sm:min-w-[48rem]`}>
            <thead>
              <tr>
                <th className={`${adminThClass(theme)} w-10 sm:w-12`}>#</th>
                <th className={`${adminThClass(theme)} min-w-[8rem] sm:min-w-[10rem]`}>Subject</th>
                <th className={`${adminThClass(theme)} min-w-[10rem] sm:min-w-[14rem]`}>Assigned faculty</th>
                <th className={`${adminThClass(theme)} min-w-[7rem] sm:min-w-[9rem]`}>Sections</th>
                <th className={`${adminThClass(theme)} min-w-[4.5rem]`}>Enrolled</th>
                <th className={`${adminThClass(theme)} min-w-[5.5rem]`}>Assessments</th>
                <th className={`${adminThClass(theme)} min-w-[4.5rem]`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!subjects.length ? (
                <tr>
                  <td colSpan={7} className={`${adminTdClass(theme)} py-8 text-center`}>
                    No subjects yet. Create one above to get started.
                  </td>
                </tr>
              ) : !visibleSubjects.length ? (
                <tr>
                  <td colSpan={7} className={`${adminTdClass(theme)} py-8 text-center`}>
                    No subjects match “{searchQuery.trim()}”.
                  </td>
                </tr>
              ) : (
              visibleSubjects.map((subject, index) => (
                <tr key={subject.id}>
                  <td className={`${adminTdClass(theme)} tabular-nums text-gray-500`}>
                    {index + 1}
                  </td>
                  <td
                    className={`${adminTdClass(theme)} min-w-[8rem] sm:min-w-[10rem] font-medium`}
                    title={subject.name}
                  >
                    <span className="line-clamp-2 break-words">{subject.name}</span>
                  </td>
                  <td className={`${adminTdClass(theme)} min-w-[10rem] sm:min-w-[14rem]`}>
                    <Select
                      value={subject.teacher_school_id || ""}
                      onChange={(e) => handleAssign(subject.id, e.target.value)}
                      disabled={busySubjectId === subject.id || deletingId === subject.id}
                      className="w-full min-w-0 max-w-full"
                    >
                      <option value="">Unassigned</option>
                      {faculty.map((f) => (
                        <option key={f.id} value={f.school_id}>
                          {[f.first_name, f.last_name].filter(Boolean).join(" ")} ({f.school_id})
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className={`${adminTdClass(theme)} min-w-[7rem] sm:min-w-[9rem]`}>
                    <Select
                      value={String(subject.section_count || DEFAULT_SECTION_COUNT)}
                      onChange={(e) =>
                        handleSectionCount(subject.id, Number(e.target.value))
                      }
                      disabled={busySubjectId === subject.id || deletingId === subject.id}
                      className="w-full min-w-0 max-w-full"
                    >
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>
                          {n} section{n === 1 ? "" : "s"}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className={adminTdClass(theme)}>{subject.enrolled_count ?? 0}</td>
                  <td className={adminTdClass(theme)}>{subject.assessment_count ?? 0}</td>
                  <td className={adminTdClass(theme)}>
                    <ProgressButton
                      type="button"
                      onClick={() => handleDelete(subject)}
                      loading={deletingId === subject.id}
                      loadingLabel="Deleting…"
                      iconOnly
                      disabled={Boolean(deletingId) || Boolean(busySubjectId) || creating}
                      className={iconButton(theme, "danger")}
                      aria-label={`Delete ${subject.name}`}
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </ProgressButton>
                  </td>
                </tr>
              ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
