import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import BackButton from "../../components/BackButton";
import { useTheme } from "../../layouts/ThemeContext";
import { useAppModal } from "../../contexts/AppModalContext";
import { Archive, Pencil, Trash2 } from "lucide-react";
import AssessmentQuestionsReview from "../../components/AssessmentQuestionsReview";
import QuestionBankSaveModal from "../../components/QuestionBankSaveModal";
import ExamAnalyticsPanel from "../../components/ExamAnalyticsPanel";
import ExamSubmissionAlertsPanel from "../../components/ExamSubmissionAlertsPanel";
import ExamRetakeRequestsPanel from "../../components/ExamRetakeRequestsPanel";
import ExamNexusBrand from "../../components/ExamNexusBrand";
import { pageShellWithBellClass } from "../../utils/themeInputs";
import {
  deleteExam,
  fetchExamFacultyAnalytics,
  fetchExamWithQuestions,
} from "../../utils/supabaseData";
import { getAssessmentStatus } from "../../utils/assessmentStatus";
import { PageLoadingSkeleton } from "../../components/ui/PageLoadingSkeleton";
import { usePolling } from "../../hooks/useRealtimeFetch";

const formatDate = (date) => {
  if (!date) return "Not set";
  return new Date(date).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const StatusBadge = ({ status, theme }) => {
  const styles = {
    scheduled:
      theme === "dark"
        ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
        : "bg-amber-100 text-amber-800 border-amber-300",
    active:
      theme === "dark"
        ? "bg-green-500/20 text-green-400 border-green-500/30"
        : "bg-green-100 text-green-800 border-green-300",
    closed:
      theme === "dark"
        ? "bg-red-500/20 text-red-400 border-red-500/30"
        : "bg-red-100 text-red-800 border-red-300",
  };

  const labels = {
    scheduled: "Scheduled",
    active: "Active",
    closed: "Closed",
  };

  return (
    <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
};

export default function AssessmentDetails() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { error: showError, success: showSuccess, confirm } = useAppModal();

  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [bankSaveOpen, setBankSaveOpen] = useState(false);

  const reloadAnalytics = useCallback(
    async (questionList, examRecord, { silent = false } = {}) => {
      if (!silent) setAnalyticsLoading(true);
      try {
        const analyticsData = await fetchExamFacultyAnalytics(
          examId,
          questionList || questions,
          (examRecord || exam)?.exam_type
        );
        setAnalytics(analyticsData);
      } catch (err) {
        console.error(err);
      } finally {
        if (!silent) setAnalyticsLoading(false);
      }
    },
    [exam, examId, questions]
  );

  const load = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true);
        setError("");

        const data = await fetchExamWithQuestions(examId);
        setExam(data.exam);
        setQuestions(data.questions);
        await reloadAnalytics(data.questions, data.exam, { silent: true });
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to load assessment.");
      } finally {
        if (!silent) {
          setLoading(false);
          setAnalyticsLoading(false);
        }
      }
    },
    [examId, reloadAnalytics]
  );

  usePolling(load, [examId]);

  const handleDelete = async () => {
    const ok = await confirm({
      title: "Delete Assessment",
      message: `Are you sure you want to delete "${exam.title}"?\n\nThis action cannot be undone.`,
      tone: "danger",
      confirmLabel: "Delete Assessment",
    });
    if (!ok) return;

    try {
      setDeleting(true);
      await deleteExam(examId);
      navigate(-1);
    } catch (err) {
      console.error(err);
      showError(err.message || "Delete failed.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <PageLoadingSkeleton theme={theme} variant="detail" />;
  }

  if (error || !exam) {
    return (
      <div className={`min-h-screen p-6 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
        <BackButton />
        <p className="mt-4 text-red-500">{error || "Assessment not found."}</p>
      </div>
    );
  }

  const status = getAssessmentStatus(exam);

  const actionButtonBase =
    "group inline-flex items-center gap-2.5 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-60 disabled:hover:translate-y-0";

  return (
    <div className={pageShellWithBellClass(theme)}>
      <BackButton />

      <ExamNexusBrand
        variant="compact"
        idSuffix="assessment-details"
        className="mb-6 opacity-90"
        showTagline={false}
      />

      <div className="mb-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1
              className={`text-3xl font-bold ${
                theme === "dark" ? "text-teal-400" : "text-teal-700"
              }`}
            >
              {exam.title}
            </h1>
            <div className="mt-3">
              <StatusBadge status={status} theme={theme} />
            </div>
            <div
              className={`mt-5 space-y-1 text-sm ${
                theme === "dark" ? "text-gray-400" : "text-gray-700"
              }`}
            >
              <p>
                Available from:{" "}
                <span className={theme === "dark" ? "text-teal-400" : "text-teal-700"}>
                  {formatDate(exam.start_datetime)}
                </span>
              </p>
              <p>
                Available until:{" "}
                <span className={theme === "dark" ? "text-teal-400" : "text-teal-700"}>
                  {formatDate(exam.end_datetime)}
                </span>
              </p>
              <p>
                {questions.length} question{questions.length === 1 ? "" : "s"}
                {analytics?.submissionCount != null &&
                  ` · ${analytics.submissionCount} submission${analytics.submissionCount === 1 ? "" : "s"}`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate(`/faculty/edit-assessment/${examId}`)}
              className={`${actionButtonBase} ${
                theme === "dark"
                  ? "border border-cyan-400/35 bg-gradient-to-br from-cyan-500/20 to-teal-500/10 text-cyan-200 shadow-[0_8px_24px_rgba(34,211,238,0.12)] hover:border-cyan-300/50 hover:shadow-[0_10px_28px_rgba(34,211,238,0.18)]"
                  : "border border-cyan-600/25 bg-gradient-to-br from-cyan-100 to-teal-50 text-cyan-900 en-panel-glow hover:border-cyan-500/40"
              }`}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                  theme === "dark" ? "bg-cyan-500/20" : "bg-white/70"
                }`}
              >
                <Pencil size={16} strokeWidth={2.25} />
              </span>
              Edit assessment
            </button>

            <button
              type="button"
              onClick={() => setBankSaveOpen(true)}
              disabled={questions.length === 0}
              className={`${actionButtonBase} ${
                theme === "dark"
                  ? "border border-emerald-400/35 bg-gradient-to-br from-emerald-500/20 to-teal-500/10 text-emerald-200 shadow-[0_8px_24px_rgba(16,185,129,0.12)] hover:border-emerald-300/50 hover:shadow-[0_10px_28px_rgba(16,185,129,0.18)]"
                  : "border border-emerald-600/25 bg-gradient-to-br from-emerald-100 to-teal-50 text-teal-900 en-panel-glow hover:border-emerald-500/40"
              }`}
              title="Save questions to question bank"
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                  theme === "dark" ? "bg-emerald-500/20" : "bg-white/70"
                }`}
              >
                <Archive size={16} strokeWidth={2.25} />
              </span>
              Save to bank
            </button>

            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className={`${actionButtonBase} ${
                theme === "dark"
                  ? "border border-red-400/35 bg-gradient-to-br from-red-500/20 to-rose-500/10 text-red-200 shadow-[0_8px_24px_rgba(239,68,68,0.1)] hover:border-red-300/50 hover:shadow-[0_10px_28px_rgba(239,68,68,0.16)]"
                  : "border border-red-400/40 bg-gradient-to-br from-red-50 to-rose-100/80 text-red-800 en-panel-glow hover:border-red-500/45"
              }`}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                  theme === "dark" ? "bg-red-500/20" : "bg-white/70"
                }`}
              >
                <Trash2 size={16} strokeWidth={2.25} />
              </span>
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </div>

      <div className="mb-10">
        <h2
          className={`mb-4 text-xl font-semibold ${
            theme === "dark" ? "text-white" : "text-teal-700"
          }`}
        >
          Questions
        </h2>
        <AssessmentQuestionsReview questions={questions} examType={exam.exam_type} />
      </div>

      <div className="mb-10">
        <h2
          className={`mb-4 text-xl font-semibold ${
            theme === "dark" ? "text-white" : "text-teal-700"
          }`}
        >
          Analytics
        </h2>
        <ExamAnalyticsPanel
          analytics={analytics}
          loading={analyticsLoading}
          examId={examId}
          questions={questions}
          examType={exam.exam_type}
          onScoresUpdated={(options) => reloadAnalytics(undefined, undefined, options)}
        />
      </div>

      <div className="mb-10">
        <ExamRetakeRequestsPanel
          examId={examId}
          onUpdated={() => reloadAnalytics(undefined, undefined, { silent: true })}
        />
      </div>

      <div className="mb-10">
        <ExamSubmissionAlertsPanel examId={examId} />
      </div>

      <QuestionBankSaveModal
        open={bankSaveOpen}
        onClose={() => setBankSaveOpen(false)}
        questions={questions}
        examType={exam.exam_type}
        onSaved={(count) =>
          showSuccess(
            `${count} question${count === 1 ? "" : "s"} saved to your question bank.`
          )
        }
      />
    </div>
  );
}
