import { useCallback, useState } from "react";
import { Download } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import { useAppModal } from "../../contexts/AppModalContext";
import PageHeader from "../../components/ui/PageHeader";
import Select from "../../components/ui/Select";
import { PageLoadingSkeleton } from "../../components/ui/PageLoadingSkeleton";
import { usePolling } from "../../hooks/useRealtimeFetch";
import {
  fetchAdminAssessments,
  fetchAdminExportAssessments,
  fetchAdminExportResults,
} from "../../utils/adminData";
import { downloadCsv } from "../../utils/exportCsv";
import { pageShellClass, panelClass } from "../../utils/themeInputs";
import AdminPageError, { formatAdminError } from "../../components/admin/AdminPageError";
import { primaryButton, secondaryButton } from "../../utils/themeButtons";

export default function AdminExports() {
  const { theme } = useTheme();
  const { success, error, warning } = useAppModal();
  const [assessments, setAssessments] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [exporting, setExporting] = useState("");

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setLoadError("");
      const data = await fetchAdminAssessments();
      setAssessments(data);
    } catch (err) {
      console.error(err);
      setAssessments([]);
      setLoadError(formatAdminError(err));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  usePolling(load, []);

  const exportAssessments = async () => {
    try {
      setExporting("assessments");
      const rows = await fetchAdminExportAssessments();
      if (!rows.length) {
        warning("No assessments to export.");
        return;
      }
      const ok = downloadCsv("examnexus-assessments.csv", rows, [
        { key: "assessment_id", label: "Assessment ID" },
        { key: "title", label: "Title" },
        { key: "type", label: "Type" },
        { key: "category", label: "Category" },
        { key: "subject", label: "Subject" },
        { key: "faculty_school_id", label: "Faculty School ID" },
        { key: "start", label: "Start" },
        { key: "end", label: "End" },
        { key: "submissions", label: "Submissions" },
      ]);
      if (ok) await success("Assessments exported.");
    } catch (err) {
      error(err.message || "Export failed.");
    } finally {
      setExporting("");
    }
  };

  const exportResults = async (examId = null) => {
    try {
      setExporting(examId || "all-results");
      const rows = await fetchAdminExportResults(examId || null);
      if (!rows.length) {
        warning("No results to export.");
        return;
      }
      const filename = examId
        ? `examnexus-results-${examId}.csv`
        : "examnexus-all-results.csv";
      const ok = downloadCsv(filename, rows, [
        { key: "exam_title", label: "Assessment" },
        { key: "subject", label: "Subject" },
        { key: "student_name", label: "Student" },
        { key: "student_email", label: "Email" },
        { key: "school_id", label: "School ID" },
        { key: "score", label: "Score" },
        { key: "total", label: "Total" },
        { key: "percentage", label: "Percentage" },
        { key: "submitted_at", label: "Submitted At" },
      ]);
      if (ok) await success("Results exported.");
    } catch (err) {
      error(err.message || "Export failed.");
    } finally {
      setExporting("");
    }
  };

  if (loading) return <PageLoadingSkeleton theme={theme} variant="cards" />;

  return (
    <div className={pageShellClass(theme, "mx-auto max-w-4xl")}>
      <PageHeader
        theme={theme}
        icon={Download}
        title="Export data"
        subtitle="Download assessment and results data as CSV files."
      />

      {loadError && (
        <AdminPageError theme={theme} message={loadError} onRetry={() => load()} />
      )}

      <div className={`${panelClass(theme)} mb-5 space-y-4`}>
        <h2 className="font-semibold">Export assessments</h2>
        <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
          Download a CSV of all assessments across subjects.
        </p>
        <button
          type="button"
          onClick={exportAssessments}
          disabled={Boolean(exporting)}
          className={primaryButton(theme, "disabled:opacity-60")}
        >
          <Download size={18} />
          {exporting === "assessments" ? "Exporting..." : "Export assessments CSV"}
        </button>
      </div>

      <div className={`${panelClass(theme)} space-y-4`}>
        <h2 className="font-semibold">Export results</h2>
        <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
          Export all results or filter by a specific assessment.
        </p>
        <Select value={selectedExamId} onChange={(e) => setSelectedExamId(e.target.value)}>
          <option value="">All assessments</option>
          {assessments.map((exam) => (
            <option key={exam.id} value={exam.id}>
              {exam.title} — {exam.subject_name}
            </option>
          ))}
        </Select>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => exportResults(selectedExamId || null)}
            disabled={Boolean(exporting)}
            className={primaryButton(theme, "disabled:opacity-60")}
          >
            <Download size={18} />
            {exporting && exporting !== "assessments" ? "Exporting..." : "Export results CSV"}
          </button>
          <button
            type="button"
            onClick={() => exportResults(null)}
            disabled={Boolean(exporting)}
            className={secondaryButton(theme, "disabled:opacity-60")}
          >
            Export all results
          </button>
        </div>
      </div>
    </div>
  );
}
