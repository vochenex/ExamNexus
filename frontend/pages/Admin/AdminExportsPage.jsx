import { useCallback, useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import { useAppModal } from "../../contexts/AppModalContext";
import PageHeader from "../../components/ui/PageHeader";
import Select from "../../components/ui/Select";
import { PageLoadingSkeleton } from "../../components/ui/PageLoadingSkeleton";
import ProgressButton from "../../components/ui/ProgressButton";
import { usePolling } from "../../hooks/useRealtimeFetch";
import {
  fetchAdminAssessments,
  fetchAdminAssessmentReport,
  fetchAdminExportAssessments,
  fetchAdminExportResults,
} from "../../utils/adminData";
import { downloadCsv, downloadHtml } from "../../utils/exportCsv";
import {
  buildAssessmentReportHtml,
  slugifyFilename,
} from "../../utils/assessmentReport";
import { pageShellClass, panelClass } from "../../utils/themeInputs";
import AdminPageError, { formatAdminError } from "../../components/admin/AdminPageError";
import { iconButton, primaryButton, secondaryButton } from "../../utils/themeButtons";

async function finishExport(result, success, warning, sharedMsg, downloadMsg) {
  if (!result?.ok) {
    warning("Could not start the download.");
    return;
  }
  await success(result.shared ? sharedMsg : downloadMsg);
}

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
      const result = await downloadCsv("examnexus-assessments.csv", rows, [
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
      await finishExport(
        result,
        success,
        warning,
        "Export ready — you chose where to save the assessments CSV.",
        "Assessments CSV saved to your downloads."
      );
    } catch (err) {
      error(err.message || "Export failed.");
    } finally {
      setExporting("");
    }
  };

  const exportAssessmentReport = async (examId) => {
    if (!examId) {
      warning("Select a specific assessment first.");
      return;
    }
    try {
      setExporting(`report-${examId}`);
      const report = await fetchAdminAssessmentReport(examId);
      const html = buildAssessmentReportHtml(report);
      const filename = `examnexus-${slugifyFilename(report.title)}-report.html`;
      const result = await downloadHtml(filename, html);
      await finishExport(
        result,
        success,
        warning,
        "Report ready — you chose where to save it. Open the HTML later to Print → Save as PDF.",
        "Assessment report saved. Open the HTML file to print or save as PDF."
      );
    } catch (err) {
      error(err.message || "Export failed. If this keeps happening, run database/admin_export_assessment_report.sql in Supabase.");
    } finally {
      setExporting("");
    }
  };

  const exportResultsCsv = async (examId = null) => {
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
      const result = await downloadCsv(filename, rows, [
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
      await finishExport(
        result,
        success,
        warning,
        "Export ready — you chose where to save the results CSV.",
        "Results CSV saved to your downloads."
      );
    } catch (err) {
      error(err.message || "Export failed.");
    } finally {
      setExporting("");
    }
  };

  if (loading && assessments.length === 0) return <PageLoadingSkeleton theme={theme} variant="cards" />;

  return (
    <div className={pageShellClass(theme, "mx-auto max-w-4xl")}>
      <PageHeader
        theme={theme}
        icon={Download}
        title="Export data"
        subtitle="Export asks where to save the file — use Files, Downloads, Drive, or another app."
      />

      {loadError && (
        <AdminPageError theme={theme} message={loadError} onRetry={() => load()} />
      )}

      <div className={`${panelClass(theme)} mb-5 space-y-4`}>
        <h2 className="font-semibold">Export assessments list</h2>
        <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
          Download a CSV of all assessments across subjects.
        </p>
        <ProgressButton
          type="button"
          onClick={exportAssessments}
          loading={exporting === "assessments"}
          loadingLabel="Exporting assessments"
          iconOnly
          disabled={Boolean(exporting) && exporting !== "assessments"}
          className={iconButton(theme, "primary")}
          aria-label="Export assessments CSV"
          title="Export assessments CSV"
        >
          <Download size={18} />
        </ProgressButton>
      </div>

      <div className={`${panelClass(theme)} space-y-4`}>
        <h2 className="font-semibold">Export assessment report / results</h2>
        <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
          Pick one assessment for a full HTML report (faculty, students, scores,
          questions, pass/fail chart, and description). Or export raw results as CSV.
        </p>
        <Select value={selectedExamId} onChange={(e) => setSelectedExamId(e.target.value)}>
          <option value="">Select an assessment</option>
          {assessments.map((exam) => (
            <option key={exam.id} value={exam.id}>
              {[exam.title, exam.subject_name].filter(Boolean).join(" — ")}
            </option>
          ))}
        </Select>
        <div className="flex flex-wrap gap-3">
          <ProgressButton
            type="button"
            onClick={() => exportAssessmentReport(selectedExamId)}
            loading={exporting === `report-${selectedExamId}`}
            loadingLabel="Exporting report"
            iconOnly
            disabled={!selectedExamId || (Boolean(exporting) && exporting !== `report-${selectedExamId}`)}
            className={iconButton(theme, "primary")}
            aria-label="Export full HTML report"
            title="Export full report"
          >
            <Download size={18} />
          </ProgressButton>
          <ProgressButton
            type="button"
            onClick={() => exportResultsCsv(selectedExamId || null)}
            loading={exporting === selectedExamId}
            loadingLabel="Exporting results"
            iconOnly
            disabled={!selectedExamId || (Boolean(exporting) && exporting !== selectedExamId)}
            className={iconButton(theme, "secondary")}
            aria-label="Export selected results CSV"
            title="Export selected results CSV"
          >
            <FileSpreadsheet size={18} />
          </ProgressButton>
          <ProgressButton
            type="button"
            onClick={() => exportResultsCsv(null)}
            loading={exporting === "all-results"}
            loadingLabel="Exporting all results"
            iconOnly
            disabled={Boolean(exporting) && exporting !== "all-results"}
            className={iconButton(theme, "secondary")}
            aria-label="Export all results CSV"
            title="Export all results CSV"
          >
            <FileSpreadsheet size={18} />
          </ProgressButton>
        </div>
      </div>
    </div>
  );
}
