import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import { useAppModal } from "../contexts/AppModalContext";
import Select from "./ui/Select";
import ProgressButton from "./ui/ProgressButton";
import CollapsiblePanel from "./ui/CollapsiblePanel";
import PanelContentSkeleton from "./ui/PanelContentSkeleton";
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
import { iconButton } from "../utils/themeButtons";

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
  const [selectedSubject, setSelectedSubject] = useState("");
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

  const subjectOptions = useMemo(() => {
    const map = new Map();
    for (const exam of assessments) {
      const key = exam.subject_id || exam.subject || "";
      const label = exam.subject || "Untitled subject";
      if (key && !map.has(key)) map.set(key, label);
    }
    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
  }, [assessments]);

  const filteredAssessments = useMemo(() => {
    if (!selectedSubject) return assessments;
    return assessments.filter(
      (exam) =>
        String(exam.subject_id) === String(selectedSubject) ||
        exam.subject === selectedSubject
    );
  }, [assessments, selectedSubject]);

  useEffect(() => {
    if (!selectedExamId) return;
    const stillVisible = filteredAssessments.some(
      (exam) => String(exam.assessment_id) === String(selectedExamId)
    );
    if (!stillVisible) setSelectedExamId("");
  }, [filteredAssessments, selectedExamId]);

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

  const exportResultsCsv = async (examId = null, subjectId = null) => {
    const exportKey = examId
      ? `results-${examId}`
      : subjectId
        ? `subject-results-${subjectId}`
        : "all-results";
    try {
      setExporting(exportKey);
      const rows = await fetchFacultyExportResults(teacherSchoolId, examId || null);
      const subjectLabel = subjectOptions.find((option) => option.value === subjectId)?.label;
      const scopedRows = subjectLabel
        ? rows.filter((row) => row.subject === subjectLabel)
        : rows;
      if (!scopedRows.length) {
        warning(subjectLabel ? "No results for that subject." : "No results to export.");
        return;
      }
      const sortedRows = [...scopedRows].sort((a, b) =>
        String(a.student_name || "").localeCompare(String(b.student_name || ""), undefined, {
          sensitivity: "base",
        })
      );
      const filename = examId
        ? `examnexus-results-${examId}.csv`
        : subjectLabel
          ? `examnexus-results-${slugifyFilename(subjectLabel)}.csv`
          : "examnexus-my-results.csv";
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

  return (
    <CollapsiblePanel
      title="Export data"
      subtitle="Download CSV or HTML reports for your subjects and assessments"
      defaultOpen
    >
      <div className="min-w-0 space-y-4">
        <p className={`text-sm break-words ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
          Export asks where to save the file — use Downloads, Drive, or another app.
        </p>

        <div className={`min-w-0 overflow-hidden rounded-xl border p-4 ${theme === "dark" ? "border-white/10 bg-white/[0.02]" : "border-emerald-100 bg-white/70"}`}>
          <h3 className="font-semibold">Assessment report / results</h3>
          <p className={`mt-1 text-sm break-words ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
            Filter by subject, then pick an assessment for a full HTML report or results CSV.
            Export results for one assessment, for every assessment in a subject, or across all subjects.
          </p>
          {loading && assessments.length === 0 ? (
            <div className="mt-3">
              <PanelContentSkeleton rows={3} variant="list" />
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="min-w-0">
                <label className={`mb-1.5 block text-xs font-semibold uppercase tracking-wide ${
                  theme === "dark" ? "text-emerald-400/80" : "text-teal-700"
                }`}>
                  Subject
                </label>
                <Select
                  value={selectedSubject}
                  onChange={(e) => {
                    setSelectedSubject(e.target.value);
                    setSelectedExamId("");
                  }}
                  className="w-full min-w-0 max-w-full"
                >
                  <option value="">All subjects</option>
                  {subjectOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="min-w-0">
                <label className={`mb-1.5 block text-xs font-semibold uppercase tracking-wide ${
                  theme === "dark" ? "text-emerald-400/80" : "text-teal-700"
                }`}>
                  Assessment
                </label>
                <Select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="w-full min-w-0 max-w-full"
                  onFocus={() => {
                    if (!assessments.length && !loading) loadAssessments();
                  }}
                >
                  <option value="">
                    {loading ? "Loading assessments..." : "Select an assessment"}
                  </option>
                  {filteredAssessments.map((exam) => (
                    <option key={exam.assessment_id} value={exam.assessment_id}>
                      {exam.title}
                      {!selectedSubject && exam.subject ? ` — ${exam.subject}` : ""}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-3">
            <ProgressButton
              type="button"
              onClick={() => exportAssessmentReport(selectedExamId)}
              loading={exporting === `report-${selectedExamId}`}
              loadingLabel="Exporting report"
              disabled={!selectedExamId || (Boolean(exporting) && exporting !== `report-${selectedExamId}`)}
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
    </CollapsiblePanel>
  );
}
