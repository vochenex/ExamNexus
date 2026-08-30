import { useCallback, useMemo, useState } from "react";
import { ClipboardList, Search } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import PageHeader from "../../components/ui/PageHeader";
import Select from "../../components/ui/Select";
import { PageLoadingSkeleton } from "../../components/ui/PageLoadingSkeleton";
import { usePolling } from "../../hooks/useRealtimeFetch";
import { fetchAdminAssessments } from "../../utils/adminData";
import {
  adminTableClass,
  adminTableWrapClass,
  adminTdClass,
  adminThClass,
  adminTableInnerClass,
  adminToolbarClass,
  adminSearchWrapClass,
  adminToolbarActionsClass,
  adminFilterSelectClass,
} from "../../components/admin/adminTableStyles";
import { pageShellClass, inputClass } from "../../utils/themeInputs";
import AdminPageError, { formatAdminError } from "../../components/admin/AdminPageError";

export default function AdminAssessments() {
  const { theme } = useTheme();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setLoadError("");
      const data = await fetchAdminAssessments();
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

  const subjectOptions = useMemo(() => {
    const names = new Set();
    for (const row of rows) {
      if (row.subject_name) names.add(row.subject_name);
    }
    return [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [rows]);

  const teacherOptions = useMemo(() => {
    const names = new Set();
    for (const row of rows) {
      if (row.faculty_name && row.faculty_name !== "—") names.add(row.faculty_name);
    }
    return [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [rows]);

  const departmentOptions = useMemo(() => {
    const names = new Set();
    for (const row of rows) {
      if (row.faculty_department && row.faculty_department !== "—") {
        names.add(row.faculty_department);
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [rows]);

  const visibleRows = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    return rows.filter((row) => {
      if (subjectFilter && row.subject_name !== subjectFilter) return false;
      if (teacherFilter && row.faculty_name !== teacherFilter) return false;
      if (departmentFilter && row.faculty_department !== departmentFilter) return false;
      if (!trimmed) return true;
      const haystack = [
        row.title,
        row.subject_name,
        row.faculty_name,
        row.faculty_department,
        row.exam_type,
        row.assessment_category,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(trimmed);
    });
  }, [rows, searchQuery, subjectFilter, teacherFilter, departmentFilter]);

  if (loading && rows.length === 0) return <PageLoadingSkeleton theme={theme} variant="list" />;

  return (
    <div className={pageShellClass(theme, "mx-auto max-w-7xl")}>
      <PageHeader
        theme={theme}
        icon={ClipboardList}
        title="Manage assessments"
        subtitle="System-wide view of exams, quizzes, and activities."
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
            placeholder="Search assessments…"
            className={inputClass(theme, "w-full min-w-0 py-2.5 pl-9 pr-3")}
            aria-label="Search assessments"
          />
        </div>
        <div className={adminToolbarActionsClass()}>
          <Select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className={adminFilterSelectClass()}
            aria-label="Filter by subject"
          >
            <option value="">All subjects</option>
            {subjectOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
          <Select
            value={teacherFilter}
            onChange={(e) => setTeacherFilter(e.target.value)}
            className={adminFilterSelectClass()}
            aria-label="Filter by teacher"
          >
            <option value="">All teachers</option>
            {teacherOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
          <Select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className={adminFilterSelectClass()}
            aria-label="Filter by department"
          >
            <option value="">All departments</option>
            {departmentOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className={adminTableWrapClass(theme)}>
        <div className={adminTableInnerClass()}>
          <table className={adminTableClass(theme)}>
            <thead>
              <tr>
                <th className={adminThClass(theme)}>Title</th>
                <th className={adminThClass(theme)}>Subject</th>
                <th className={adminThClass(theme)}>Teacher</th>
                <th className={adminThClass(theme)}>Department</th>
                <th className={adminThClass(theme)}>Type</th>
                <th className={adminThClass(theme)}>Category</th>
                <th className={adminThClass(theme)}>Start</th>
                <th className={adminThClass(theme)}>End</th>
                <th className={adminThClass(theme)}>Submissions</th>
              </tr>
            </thead>
            <tbody>
              {!visibleRows.length ? (
                <tr>
                  <td colSpan={9} className={`${adminTdClass(theme)} py-8 text-center`}>
                    No assessments found.
                  </td>
                </tr>
              ) : (
                visibleRows.map((row) => (
                  <tr key={row.id}>
                    <td className={adminTdClass(theme)}>{row.title}</td>
                    <td className={adminTdClass(theme)}>{row.subject_name}</td>
                    <td className={adminTdClass(theme)}>{row.faculty_name || "—"}</td>
                    <td className={adminTdClass(theme)}>{row.faculty_department || "—"}</td>
                    <td className={adminTdClass(theme)}>{row.exam_type}</td>
                    <td className={adminTdClass(theme)}>{row.assessment_category || "—"}</td>
                    <td className={adminTdClass(theme)}>
                      {row.start_datetime
                        ? new Date(row.start_datetime).toLocaleString()
                        : "—"}
                    </td>
                    <td className={adminTdClass(theme)}>
                      {row.end_datetime ? new Date(row.end_datetime).toLocaleString() : "—"}
                    </td>
                    <td className={adminTdClass(theme)}>{row.result_count ?? 0}</td>
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
