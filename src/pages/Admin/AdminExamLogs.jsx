import { useCallback, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import PageHeader from "../../components/ui/PageHeader";
import { PageLoadingSkeleton } from "../../components/ui/PageLoadingSkeleton";
import { usePolling } from "../../hooks/useRealtimeFetch";
import { fetchAdminExamLogs } from "../../utils/adminData";
import {
  adminTableClass,
  adminTableWrapClass,
  adminTdClass,
  adminThClass,
} from "../../components/admin/adminTableStyles";
import { pageShellClass } from "../../utils/themeInputs";
import AdminPageError, { formatAdminError } from "../../components/admin/AdminPageError";

export default function AdminExamLogs() {
  const { theme } = useTheme();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setLoadError("");
      const data = await fetchAdminExamLogs(300);
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

  if (loading) return <PageLoadingSkeleton theme={theme} variant="list" />;

  return (
    <div className={pageShellClass(theme, "mx-auto max-w-7xl")}>
      <PageHeader
        theme={theme}
        icon={ShieldAlert}
        title="Exam logs"
        subtitle="Integrity and proctoring events across all assessments."
      />

      {loadError && (
        <AdminPageError theme={theme} message={loadError} onRetry={() => load()} />
      )}

      <div className={adminTableWrapClass(theme)}>
        <div className="overflow-x-auto">
          <table className={adminTableClass(theme)}>
            <thead>
              <tr>
                <th className={adminThClass(theme)}>Time</th>
                <th className={adminThClass(theme)}>Assessment</th>
                <th className={adminThClass(theme)}>Subject</th>
                <th className={adminThClass(theme)}>Student</th>
                <th className={adminThClass(theme)}>Event</th>
                <th className={adminThClass(theme)}>Details</th>
              </tr>
            </thead>
            <tbody>
              {!rows.length ? (
                <tr>
                  <td colSpan={6} className={`${adminTdClass(theme)} text-center`}>
                    No exam log events recorded yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td className={adminTdClass(theme)}>
                      {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
                    </td>
                    <td className={adminTdClass(theme)}>{row.exam_title}</td>
                    <td className={adminTdClass(theme)}>{row.subject_name}</td>
                    <td className={adminTdClass(theme)}>{row.student_name || row.student_id}</td>
                    <td className={adminTdClass(theme)}>{row.event_type}</td>
                    <td className={adminTdClass(theme)}>{row.description || "—"}</td>
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
