import { useCallback, useMemo, useState } from "react";
import { Link2, Search } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import PageHeader from "../../components/ui/PageHeader";
import Select from "../../components/ui/Select";
import { PageLoadingSkeleton } from "../../components/ui/PageLoadingSkeleton";
import { usePolling } from "../../hooks/useRealtimeFetch";
import { fetchAdminFaculty, fetchAdminSubjectsWithFaculty } from "../../utils/adminData";
import {
  adminTableClass,
  adminTableWrapClass,
  adminTdClass,
  adminThClass,
  adminToolbarClass,
  adminSearchWrapClass,
  adminToolbarActionsClass,
  adminTableInnerClass,
} from "../../components/admin/adminTableStyles";
import { pageShellClass, inputClass } from "../../utils/themeInputs";
import { DEPARTMENTS, getDepartmentLabel } from "../../utils/academicOptions";
import AdminPageError, { formatAdminError } from "../../components/admin/AdminPageError";

function facultySortKey(subject) {
  const last = String(subject.faculty_last_name || "").trim().toLowerCase();
  const first = String(subject.faculty_first_name || "").trim().toLowerCase();
  return `${last}\0${first}\0${String(subject.name || "").toLowerCase()}`;
}

export default function AdminAssignedSubjects() {
  const { theme } = useTheme();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setLoadError("");
      const [subjectRows, facultyRows] = await Promise.all([
        fetchAdminSubjectsWithFaculty(),
        fetchAdminFaculty(),
      ]);
      const departmentBySchoolId = new Map(
        facultyRows.map((row) => [String(row.school_id || ""), row.department || ""])
      );
      const assigned = subjectRows
        .filter((subject) => subject.teacher_school_id)
        .map((subject) => ({
          ...subject,
          faculty_department:
            departmentBySchoolId.get(String(subject.teacher_school_id || "")) || "",
        }))
        .sort((a, b) => facultySortKey(a).localeCompare(facultySortKey(b)));
      setSubjects(assigned);
    } catch (err) {
      console.error(err);
      setSubjects([]);
      setLoadError(formatAdminError(err));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  usePolling(load, []);

  const visibleSubjects = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    return subjects.filter((subject) => {
      if (departmentFilter && subject.faculty_department !== departmentFilter) return false;
      if (!trimmed) return true;
      const facultyName = [subject.faculty_first_name, subject.faculty_last_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const subjectName = String(subject.name || "").toLowerCase();
      const department = getDepartmentLabel(subject.faculty_department).toLowerCase();
      return (
        subjectName.includes(trimmed) ||
        facultyName.includes(trimmed) ||
        department.includes(trimmed) ||
        String(subject.teacher_school_id || "").toLowerCase().includes(trimmed)
      );
    });
  }, [subjects, searchQuery, departmentFilter]);

  if (loading && subjects.length === 0) return <PageLoadingSkeleton theme={theme} variant="list" />;

  return (
    <div className={pageShellClass(theme, "mx-auto max-w-7xl")}>
      <PageHeader
        theme={theme}
        icon={Link2}
        title="Assigned subjects"
        subtitle="View which faculty member is responsible for each subject."
      />

      {loadError && (
        <AdminPageError theme={theme} message={loadError} onRetry={() => load()} />
      )}

      <div className={adminToolbarClass(theme)}>
        <div className={adminSearchWrapClass()}>
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
            placeholder="Search subject or faculty…"
            className={inputClass(theme, "w-full min-w-0 py-2.5 pl-9 pr-3")}
            aria-label="Search assigned subjects by subject name or faculty"
          />
        </div>
        <div className={adminToolbarActionsClass()}>
          <Select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="w-full min-w-[9rem] sm:w-auto sm:max-w-[14rem]"
          >
            <option value="">All departments</option>
            {DEPARTMENTS.map((dept) => (
              <option key={dept.value} value={dept.value}>
                {dept.shortLabel}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className={adminTableWrapClass(theme)}>
        <div className={adminTableInnerClass()}>
          <table className={`${adminTableClass(theme)} min-w-[52rem]`}>
            <thead>
              <tr>
                <th className={adminThClass(theme)}>Subject</th>
                <th className={adminThClass(theme)}>Faculty</th>
                <th className={adminThClass(theme)}>Department</th>
                <th className={adminThClass(theme)}>School ID</th>
                <th className={adminThClass(theme)}>Email</th>
                <th className={adminThClass(theme)}>Students</th>
                <th className={adminThClass(theme)}>Assessments</th>
              </tr>
            </thead>
            <tbody>
              {!visibleSubjects.length ? (
                <tr>
                  <td colSpan={7} className={`${adminTdClass(theme)} py-8 text-center`}>
                    {subjects.length
                      ? "No assignments match the current filters."
                      : "No faculty assignments yet."}
                  </td>
                </tr>
              ) : (
                visibleSubjects.map((subject) => (
                  <tr key={subject.id}>
                    <td className={adminTdClass(theme)}>{subject.name}</td>
                    <td className={adminTdClass(theme)}>
                      {[subject.faculty_first_name, subject.faculty_last_name]
                        .filter(Boolean)
                        .join(" ") || "—"}
                    </td>
                    <td className={adminTdClass(theme)}>
                      {getDepartmentLabel(subject.faculty_department) || "—"}
                    </td>
                    <td className={adminTdClass(theme)}>{subject.teacher_school_id}</td>
                    <td className={adminTdClass(theme)}>{subject.faculty_email || "—"}</td>
                    <td className={adminTdClass(theme)}>{subject.enrolled_count ?? 0}</td>
                    <td className={adminTdClass(theme)}>{subject.assessment_count ?? 0}</td>
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
