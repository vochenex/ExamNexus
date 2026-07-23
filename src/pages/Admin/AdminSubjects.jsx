import { useCallback, useState } from "react";
import { BookOpen, Plus, Trash2 } from "lucide-react";
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
} from "../../components/admin/adminTableStyles";
import AdminPageError, { formatAdminError } from "../../components/admin/AdminPageError";
import { pageShellClass, inputClass, panelClass } from "../../utils/themeInputs";
import { iconButton, primaryButtonSm, primaryButton } from "../../utils/themeButtons";
import { DEFAULT_SECTION_COUNT } from "../../utils/sections";
import { DEFAULT_YEAR_LEVEL } from "../../utils/yearLevels";

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
  const [form, setForm] = useState({
    name: "",
    teacherSchoolId: "",
    yearLevel: DEFAULT_YEAR_LEVEL,
    sectionCount: DEFAULT_SECTION_COUNT,
  });

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
    try {
      await adminAssignSubjectFaculty(subjectId, facultySchoolId);
      await success(
        facultySchoolId ? "Faculty assignment updated." : "Faculty unassigned."
      );
      await load(true);
    } catch (err) {
      error(err.message || "Failed to assign faculty.");
      await load(true);
    }
  };

  const handleSectionCount = async (subjectId, sectionCount) => {
    try {
      await adminUpdateSubject(subjectId, { section_count: sectionCount });
      await load(true);
    } catch (err) {
      error(err.message || "Failed to update sections.");
    }
  };

  const handleDelete = async (subject) => {
    const ok = await confirm({
      title: "Delete subject?",
      message: `Delete "${subject.name}"? Enrollments and assessments may be affected.`,
      tone: "danger",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      await adminDeleteSubject(subject.id);
      await success("Subject deleted.");
      await load(true);
    } catch (err) {
      error(err.message || "Failed to delete subject.");
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

      <div className={`${panelClass(theme)} mb-6 overflow-hidden`}>
        <div
          className={`border-b px-5 py-4 ${
            theme === "dark" ? "border-white/10 bg-white/[0.02]" : "border-emerald-100 bg-emerald-50/40"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                theme === "dark" ? "bg-emerald-500/15 text-emerald-400" : "bg-emerald-100 text-teal-700"
              }`}
            >
              <Plus size={20} />
            </div>
            <div>
              <h2 className="font-semibold">Create subject</h2>
              <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                Set up a new course and assign an approved faculty member.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-5">
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
            className={`flex justify-end border-t pt-4 ${
              theme === "dark" ? "border-white/10" : "border-emerald-100"
            }`}
          >
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating || !form.name.trim() || !form.teacherSchoolId}
              className={`${primaryButton(theme)} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <Plus size={18} />
              {creating ? "Creating..." : "Create subject"}
            </button>
          </div>
        </div>
      </div>

      <div className={adminTableWrapClass(theme)}>
        <div className="overflow-x-auto en-scroll-region">
          <table className={`${adminTableClass(theme)} min-w-[64rem]`}>
            <thead>
              <tr>
                <th className={`${adminThClass(theme)} w-12`}>#</th>
                <th className={`${adminThClass(theme)} min-w-[10rem]`}>Subject</th>
                <th className={`${adminThClass(theme)} min-w-[7rem]`}>Invite code</th>
                <th className={`${adminThClass(theme)} min-w-[16rem]`}>Assigned faculty</th>
                <th className={`${adminThClass(theme)} min-w-[9rem]`}>Sections</th>
                <th className={`${adminThClass(theme)} min-w-[5rem]`}>Enrolled</th>
                <th className={`${adminThClass(theme)} min-w-[6rem]`}>Assessments</th>
                <th className={`${adminThClass(theme)} min-w-[6rem]`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!subjects.length ? (
                <tr>
                  <td colSpan={8} className={`${adminTdClass(theme)} py-8 text-center`}>
                    No subjects yet. Create one above to get started.
                  </td>
                </tr>
              ) : (
              subjects.map((subject, index) => (
                <tr key={subject.id}>
                  <td className={`${adminTdClass(theme)} tabular-nums text-gray-500`}>
                    {index + 1}
                  </td>
                  <td className={`${adminTdClass(theme)} min-w-[10rem]`}>{subject.name}</td>
                  <td className={`${adminTdClass(theme)} min-w-[7rem] whitespace-nowrap`}>
                    {subject.invite_code}
                  </td>
                  <td className={`${adminTdClass(theme)} min-w-[16rem]`}>
                    <Select
                      value={subject.teacher_school_id || ""}
                      onChange={(e) => handleAssign(subject.id, e.target.value)}
                      className="min-w-[15rem] w-full"
                    >
                      <option value="">Unassigned</option>
                      {faculty.map((f) => (
                        <option key={f.id} value={f.school_id}>
                          {[f.first_name, f.last_name].filter(Boolean).join(" ")} ({f.school_id})
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className={`${adminTdClass(theme)} min-w-[9rem]`}>
                    <Select
                      value={String(subject.section_count || DEFAULT_SECTION_COUNT)}
                      onChange={(e) =>
                        handleSectionCount(subject.id, Number(e.target.value))
                      }
                      className="min-w-[8rem] w-full"
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
                    <button
                      type="button"
                      onClick={() => handleDelete(subject)}
                      className={iconButton(theme, "danger")}
                      aria-label={`Delete ${subject.name}`}
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
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
