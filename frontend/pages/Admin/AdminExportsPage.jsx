import { useCallback, useMemo, useState } from "react";
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
  fetchAdminExportResults,
} from "../../utils/adminData";
import { downloadCsv, downloadHtml } from "../../utils/exportCsv";
import {
  buildAssessmentReportHtml,
  slugifyFilename,
} from "../../utils/assessmentReport";
import { pageShellClass, panelClass } from "../../utils/themeInputs";
import AdminPageError, { formatAdminError } from "../../components/admin/AdminPageError";
import { iconButton } from "../../utils/themeButtons";

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
  const [selectedSubject, setSelectedSubject] = useState("");
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

  const subjectOptions = useMemo(() => {
    const names = new Set();
    for (const exam of assessments) {
      const name = exam.subject_name || exam.subject || "";
      if (name) names.add(name);
    }
    return [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [assessments]);

  const filteredAssessments = useMemo(() => {
    if (!selectedSubject) return assessments;
    return assessments.filter(
      (exam) => (exam.subject_name || exam.subject || "") === selectedSubject
    );
  }, [assessments, selectedSubject]);

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
      error(
        err.message ||
          "Export failed. If this keeps happening, run database/admin_export_assessment_report.sql in Supabase."
      );
    } finally {
      setExporting("");
    }
  };

  const exportResultsCsv = async (examId = null, subjectName = null) => {
    const exportKey = examId
      ? `results-${examId}`
      : subjectName
        ? `subject-results-${subjectName}`
        : "all-results";
    try {
      setExporting(exportKey);
      const rows = await fetchAdminExportResults(examId || null);
      const scopedRows = subjectName
        ? rows.filter((row) => row.subject === subjectName)
        : rows;
      if (!scopedRows.length) {
        warning(subjectName ? "No results for that subject." : "No results to export.");
        return;
      }
      const sortedRows = [...scopedRows].sort((a, b) =>
        String(a.student_name || "").localeCompare(String(b.student_name || ""), undefined, {
          sensitivity: "base",
        })
      );
      const filename = examId
        ? `examnexus-results-${examId}.csv`
        : subjectName
          ? `examnexus-results-${slugifyFilename(subjectName)}.csv`
          : "examnexus-all-results.csv";
      const result = await downloadCsv(filename, sortedRows, [
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

  const bulkResultsExportKey = selectedSubject
    ? `subject-results-${selectedSubject}`
    : "all-results";

  if (loading && assessments.length === 0) {
    return <PageLoadingSkeleton theme={theme} variant="cards" />;
  }

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

      <div className={`${panelClass(theme)} space-y-4`}>
        <h2 className="font-semibold">Export assessment report / results</h2>
        <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
          Filter by subject, then pick an assessment for a full HTML report (faculty, students,
          scores, questions, pass/fail chart, and description). Export results for one assessment,
          for every assessment in a subject, or across all subjects.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <label
              className={`mb-1.5 block text-xs font-semibold uppercase tracking-wide ${
                theme === "dark" ? "text-emerald-400/80" : "text-teal-700"
              }`}
            >
              Subject
            </label>
            <Select
              value={selectedSubject}
              onChange={(e) => {
                setSelectedSubject(e.target.value);
                setSelectedExamId("");
              }}
            >
              <option value="">All subjects</option>
              {subjectOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-0">
            <label
              className={`mb-1.5 block text-xs font-semibold uppercase tracking-wide ${
                theme === "dark" ? "text-emerald-400/80" : "text-teal-700"
              }`}
            >
              Assessment
            </label>
            <Select value={selectedExamId} onChange={(e) => setSelectedExamId(e.target.value)}>
              <option value="">Select an assessment</option>
              {filteredAssessments.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.title}
                  {!selectedSubject && exam.subject_name ? ` — ${exam.subject_name}` : ""}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <ProgressButton
            type="button"
            onClick={() => exportAssessmentReport(selectedExamId)}
            loading={exporting === `report-${selectedExamId}`}
            loadingLabel="Exporting report"
            disabled={
              !selectedExamId ||
              (Boolean(exporting) && exporting !== `report-${selectedExamId}`)
            }
            className={iconButton(theme, "primary", "gap-2 px-3")}
            aria-label="Export full HTML report"
            title="Export full report"
          >
            <Download size={18} />
            <span className="text-sm font-semibold">Export HTML report</span>
          </ProgressButton>
          <ProgressButton
            type="button"
            onClick={() => exportResultsCsv(selectedExamId || null)}
            loading={Boolean(selectedExamId) && exporting === `results-${selectedExamId}`}
            loadingLabel="Exporting results"
            disabled={
              !selectedExamId ||
              (Boolean(exporting) && exporting !== `results-${selectedExamId}`)
            }
            className={iconButton(theme, "secondary", "gap-2 px-3")}
            aria-label="Export selected results CSV"
            title="Export selected results CSV"
          >
            <FileSpreadsheet size={18} />
            <span className="text-sm font-semibold">Export selected results CSV</span>
          </ProgressButton>
          <ProgressButton
            type="button"
            onClick={() => exportResultsCsv(null, selectedSubject || null)}
            loading={exporting === bulkResultsExportKey}
            loadingLabel="Exporting results"
            disabled={Boolean(exporting) && exporting !== bulkResultsExportKey}
            className={iconButton(theme, "secondary", "gap-2 px-3")}
            aria-label={
              selectedSubject ? "Export all results for subject CSV" : "Export all results CSV"
            }
            title={selectedSubject ? "Export all results for subject" : "Export all results CSV"}
          >
            <FileSpreadsheet size={18} />
            <span className="text-sm font-semibold">
              {selectedSubject ? "Export all subject results" : "Export all results"}
            </span>
          </ProgressButton>
        </div>
      </div>
    </div>
  );
}
