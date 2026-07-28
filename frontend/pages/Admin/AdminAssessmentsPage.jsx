import { useCallback, useState } from "react";
import { ClipboardList } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import PageHeader from "../../components/ui/PageHeader";
import { PageLoadingSkeleton } from "../../components/ui/PageLoadingSkeleton";
import { usePolling } from "../../hooks/useRealtimeFetch";
import { fetchAdminAssessments } from "../../utils/adminData";
import {
  adminTableClass,
  adminTableWrapClass,
  adminTdClass,
  adminThClass,
} from "../../components/admin/adminTableStyles";
import { pageShellClass } from "../../utils/themeInputs";
import AdminPageError, { formatAdminError } from "../../components/admin/AdminPageError";

export default function AdminAssessments() {
  const { theme } = useTheme();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

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

      <div className={adminTableWrapClass(theme)}>
        <div className="overflow-x-auto">
          <table className={adminTableClass(theme)}>
            <thead>
              <tr>
                <th className={adminThClass(theme)}>Title</th>
                <th className={adminThClass(theme)}>Subject</th>
                <th className={adminThClass(theme)}>Type</th>
                <th className={adminThClass(theme)}>Category</th>
                <th className={adminThClass(theme)}>Start</th>
                <th className={adminThClass(theme)}>End</th>
                <th className={adminThClass(theme)}>Submissions</th>
              </tr>
            </thead>
            <tbody>
              {!rows.length ? (
                <tr>
                  <td colSpan={7} className={`${adminTdClass(theme)} py-8 text-center`}>
                    No assessments found.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                <tr key={row.id}>
                  <td className={adminTdClass(theme)}>{row.title}</td>
                  <td className={adminTdClass(theme)}>{row.subject_name}</td>
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
