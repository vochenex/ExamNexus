import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import { useAppModal } from "../contexts/AppModalContext";
import Select from "./ui/Select";
import ProgressButton from "./ui/ProgressButton";
import CollapsiblePanel from "./ui/CollapsiblePanel";
import {
  fetchFacultyAssessmentReport,
  fetchFacultyExportAssessments,
  fetchFacultyExportResults,
} from "../utils/supabaseData";
import { downloadCsv, downloadHtml } from "../utils/exportCsv";
import {
  buildAssessmentReportHtml,
  slugifyFilename,
} from "../utils/assessmentReport";
import { primaryButton, secondaryButton } from "../utils/themeButtons";

async function finishExport(result, success, warning, sharedMsg, downloadMsg) {
  if (!result?.ok) {
    warning("Could not start the download.");
    return;
  }
  await success(result.shared ? sharedMsg : downloadMsg);
}

export default function FacultyExportPanel({ teacherSchoolId }) {
  const { theme } = useTheme();
  const { success, error, warning } = useAppModal();
  const [assessments, setAssessments] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState("");

  const loadAssessments = useCallback(async () => {
    if (!teacherSchoolId) return;
    try {
      setLoading(true);
      const rows = await fetchFacultyExportAssessments(teacherSchoolId);
      setAssessments(rows);
    } catch (err) {
      console.error(err);
      setAssessments([]);
    } finally {
      setLoading(false);
    }
  }, [teacherSchoolId]);

  useEffect(() => {
    loadAssessments();
  }, [loadAssessments]);

  const exportAssessments = async () => {
    try {
      setExporting("assessments");
      const rows = await fetchFacultyExportAssessments(teacherSchoolId);
      if (!rows.length) {
        warning("No assessments to export.");
        return;
      }
      const result = await downloadCsv("examnexus-my-assessments.csv", rows, [
        { key: "assessment_id", label: "Assessment ID" },
        { key: "title", label: "Title" },
        { key: "type", label: "Type" },
        { key: "subject", label: "Subject" },
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
      const report = await fetchFacultyAssessmentReport(teacherSchoolId, examId);
      const html = buildAssessmentReportHtml(report);
      const filename = `examnexus-${slugifyFilename(report.title)}-report.html`;
      const result = await downloadHtml(filename, html);
      await finishExport(
        result,
        success,
        warning,
        "Report ready — you chose where to save it.",
        "Assessment report saved."
      );
    } catch (err) {
      error(err.message || "Export failed.");
    } finally {
      setExporting("");
    }
  };

  const exportResultsCsv = async (examId = null) => {
    const exportKey = examId ? `results-${examId}` : "all-results";
    try {
      setExporting(exportKey);
      const rows = await fetchFacultyExportResults(teacherSchoolId, examId || null);
      if (!rows.length) {
        warning("No results to export.");
        return;
      }
      const filename = examId
        ? `examnexus-results-${examId}.csv`
        : "examnexus-my-results.csv";
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

  return (
    <CollapsiblePanel
      title="Export data"
      subtitle="Download CSV or HTML reports for your subjects and assessments"
      defaultOpen={false}
    >
      <div className="min-w-0 space-y-4">
        <p className={`text-sm break-words ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
          Export asks where to save the file — use Downloads, Drive, or another app.
        </p>

        <div className={`min-w-0 overflow-hidden rounded-xl border p-4 ${theme === "dark" ? "border-white/10 bg-white/[0.02]" : "border-emerald-100 bg-white/70"}`}>
          <h3 className="font-semibold">Your assessments list</h3>
          <p className={`mt-1 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
            CSV of all assessments across your subjects.
          </p>
          <ProgressButton
            type="button"
            onClick={exportAssessments}
            loading={exporting === "assessments"}
            loadingLabel="Exporting..."
            disabled={Boolean(exporting) && exporting !== "assessments"}
            className={`${primaryButton(theme, "mt-3 disabled:opacity-60")}`}
          >
            <Download size={18} />
            Export assessments CSV
          </ProgressButton>
        </div>

        <div className={`min-w-0 overflow-hidden rounded-xl border p-4 ${theme === "dark" ? "border-white/10 bg-white/[0.02]" : "border-emerald-100 bg-white/70"}`}>
          <h3 className="font-semibold">Assessment report / results</h3>
          <p className={`mt-1 text-sm break-words ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
            Pick one assessment for a full HTML report or export raw results as CSV.
          </p>
          <Select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="mt-3 w-full min-w-0 max-w-full"
            onFocus={() => {
              if (!assessments.length && !loading) loadAssessments();
            }}
          >
            <option value="">{loading ? "Loading assessments..." : "Select an assessment"}</option>
            {assessments.map((exam) => (
              <option key={exam.assessment_id} value={exam.assessment_id}>
                {[exam.title, exam.subject].filter(Boolean).join(" — ")}
              </option>
            ))}
          </Select>
          <div className="mt-3 flex flex-wrap gap-3">
            <ProgressButton
              type="button"
              onClick={() => exportAssessmentReport(selectedExamId)}
              loading={exporting === `report-${selectedExamId}`}
              loadingLabel="Exporting..."
              disabled={!selectedExamId || (Boolean(exporting) && exporting !== `report-${selectedExamId}`)}
              className={primaryButton(theme, "disabled:opacity-60")}
            >
              <Download size={18} />
              Export full report
            </ProgressButton>
            <ProgressButton
              type="button"
              onClick={() => exportResultsCsv(selectedExamId || null)}
              loading={Boolean(selectedExamId) && exporting === `results-${selectedExamId}`}
              loadingLabel="Exporting..."
              disabled={
                !selectedExamId ||
                (Boolean(exporting) && exporting !== `results-${selectedExamId}`)
              }
              className={secondaryButton(theme, "disabled:opacity-60")}
            >
              Export selected results CSV
            </ProgressButton>
            <ProgressButton
              type="button"
              onClick={() => exportResultsCsv(null)}
              loading={exporting === "all-results"}
              loadingLabel="Exporting..."
              disabled={Boolean(exporting) && exporting !== "all-results"}
              className={secondaryButton(theme, "disabled:opacity-60")}
            >
              Export all my results CSV
            </ProgressButton>
          </div>
        </div>
      </div>
    </CollapsiblePanel>
  );
}
