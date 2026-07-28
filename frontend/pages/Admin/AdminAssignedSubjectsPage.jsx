import { useCallback, useState } from "react";
import { Link2 } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import PageHeader from "../../components/ui/PageHeader";
import { PageLoadingSkeleton } from "../../components/ui/PageLoadingSkeleton";
import { usePolling } from "../../hooks/useRealtimeFetch";
import { fetchAdminSubjectsWithFaculty } from "../../utils/adminData";
import {
  adminTableClass,
  adminTableWrapClass,
  adminTdClass,
  adminThClass,
} from "../../components/admin/adminTableStyles";
import { pageShellClass } from "../../utils/themeInputs";
import AdminPageError, { formatAdminError } from "../../components/admin/AdminPageError";

export default function AdminAssignedSubjects() {
  const { theme } = useTheme();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setLoadError("");
      const rows = await fetchAdminSubjectsWithFaculty();
      setSubjects(rows.filter((s) => s.teacher_school_id));
    } catch (err) {
      console.error(err);
      setSubjects([]);
      setLoadError(formatAdminError(err));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  usePolling(load, []);

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

      <div className={adminTableWrapClass(theme)}>
        <div className="overflow-x-auto">
          <table className={adminTableClass(theme)}>
            <thead>
              <tr>
                <th className={adminThClass(theme)}>Subject</th>
                <th className={adminThClass(theme)}>Faculty</th>
                <th className={adminThClass(theme)}>School ID</th>
                <th className={adminThClass(theme)}>Email</th>
                <th className={adminThClass(theme)}>Students</th>
                <th className={adminThClass(theme)}>Assessments</th>
              </tr>
            </thead>
            <tbody>
              {!subjects.length ? (
                <tr>
                  <td colSpan={6} className={`${adminTdClass(theme)} text-center`}>
                    No faculty assignments yet.
                  </td>
                </tr>
              ) : (
                subjects.map((subject) => (
                  <tr key={subject.id}>
                    <td className={adminTdClass(theme)}>{subject.name}</td>
                    <td className={adminTdClass(theme)}>
                      {[subject.faculty_first_name, subject.faculty_last_name]
                        .filter(Boolean)
                        .join(" ") || "—"}
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
