import { useCallback, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import BackButton from "../../components/BackButton";
import { useTheme } from "../../layouts/ThemeContext";
import { useAppModal } from "../../contexts/AppModalContext";
import {
  Archive,
  BarChart3,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Pencil,
  RotateCcw,
  Shield,
  Trash2,
} from "lucide-react";
import AssessmentQuestionsReview from "../../components/AssessmentQuestionsReview";
import QuestionBankSaveModal from "../../components/QuestionBankSaveModal";
import ExamAnalyticsPanel from "../../components/ExamAnalyticsPanel";
import ExamSubmissionAlertsPanel from "../../components/ExamSubmissionAlertsPanel";
import ExamAutoSubmittedPanel from "../../components/ExamAutoSubmittedPanel";
import ExamRetakeRequestsPanel from "../../components/ExamRetakeRequestsPanel";
import { pageShellWithBellClass, panelClass } from "../../utils/themeInputs";
import {
  deleteExam,
  fetchExamFacultyAnalytics,
  fetchExamWithQuestions,
} from "../../utils/supabaseData";
import { getAssessmentStatus } from "../../utils/assessmentStatus";
import { PageLoadingSkeleton } from "../../components/ui/PageLoadingSkeleton";
import { usePolling } from "../../hooks/useRealtimeFetch";

const TABS = [
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "integrity", label: "Integrity", icon: Shield },
  { id: "retakes", label: "Retakes", icon: RotateCcw },
  { id: "questions", label: "Questions", icon: ClipboardList },
];

const formatDate = (date) => {
  if (!date) return "Not set";
  return new Date(date).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const formatShortDate = (date) => {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
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
    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
};

function MetaChip({ children, theme }) {
  return (
    <span
      className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs ${
        theme === "dark"
          ? "border-white/10 bg-white/[0.04] text-gray-300"
          : "border-emerald-100 bg-emerald-50/80 text-gray-700"
      }`}
    >
      {children}
    </span>
  );
}

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
  const [activeTab, setActiveTab] = useState("analytics");
  const [headerOpen, setHeaderOpen] = useState(true);

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

  if (loading && !exam) {
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
  const submissionCount = analytics?.submissionCount;

  const actionButtonBase =
    "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-60 disabled:hover:translate-y-0";

  return (
    <div className={pageShellWithBellClass(theme)}>
      <BackButton />

      <div className={`${panelClass(theme)} mb-5 !p-0 overflow-hidden`}>
        <button
          type="button"
          onClick={() => setHeaderOpen((value) => !value)}
          className="flex w-full min-w-0 items-center justify-between gap-3 px-4 py-3.5 text-left sm:px-5"
        >
          <span className="min-w-0 flex-1 overflow-hidden">
            <span className="flex flex-wrap items-center gap-2">
              <span
                className={`truncate text-lg font-bold sm:text-xl ${
                  theme === "dark" ? "text-teal-400" : "text-teal-700"
                }`}
              >
                {exam.title}
              </span>
              <StatusBadge status={status} theme={theme} />
            </span>
            {!headerOpen && (
              <span
                className={`mt-1 block truncate text-xs ${
                  theme === "dark" ? "text-gray-400" : "text-gray-600"
                }`}
              >
                {questions.length} question{questions.length === 1 ? "" : "s"}
                {submissionCount != null
                  ? ` · ${submissionCount} submission${submissionCount === 1 ? "" : "s"}`
                  : ""}
                {" · "}
                Tap to expand details
              </span>
            )}
          </span>
          {headerOpen ? (
            <ChevronUp size={18} className="shrink-0 opacity-70" />
          ) : (
            <ChevronDown size={18} className="shrink-0 opacity-70" />
          )}
        </button>

        {headerOpen && (
          <div
            className={`space-y-4 border-t px-4 py-4 sm:px-5 ${
              theme === "dark" ? "border-white/10" : "border-emerald-100"
            }`}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-2">
                  <MetaChip theme={theme}>
                    From {formatShortDate(exam.start_datetime)}
                  </MetaChip>
                  <MetaChip theme={theme}>
                    Until {formatShortDate(exam.end_datetime)}
                  </MetaChip>
                  <MetaChip theme={theme}>
                    {questions.length} question{questions.length === 1 ? "" : "s"}
                  </MetaChip>
                  {submissionCount != null && (
                    <MetaChip theme={theme}>
                      {submissionCount} submission{submissionCount === 1 ? "" : "s"}
                    </MetaChip>
                  )}
                </div>

                <p
                  className={`mt-2 hidden text-xs sm:block ${
                    theme === "dark" ? "text-gray-500" : "text-gray-500"
                  }`}
                >
                  {formatDate(exam.start_datetime)} → {formatDate(exam.end_datetime)}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate(`/faculty/edit-assessment/${examId}`)}
                  className={`${actionButtonBase} ${
                    theme === "dark"
                      ? "border border-cyan-400/35 bg-cyan-500/15 text-cyan-200"
                      : "border border-cyan-600/25 bg-cyan-50 text-cyan-900"
                  }`}
                >
                  <Pencil size={14} />
                  Edit
                </button>

                <button
                  type="button"
                  onClick={() => setBankSaveOpen(true)}
                  disabled={questions.length === 0}
                  className={`${actionButtonBase} ${
                    theme === "dark"
                      ? "border border-emerald-400/35 bg-emerald-500/15 text-emerald-200"
                      : "border border-emerald-600/25 bg-emerald-50 text-teal-900"
                  }`}
                  title="Save questions to question bank"
                >
                  <Archive size={14} />
                  Bank
                </button>

                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className={`${actionButtonBase} ${
                    theme === "dark"
                      ? "border border-red-400/35 bg-red-500/15 text-red-200"
                      : "border border-red-400/40 bg-red-50 text-red-800"
                  }`}
                >
                  <Trash2 size={14} />
                  {deleting ? "…" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                isActive
                  ? theme === "dark"
                    ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/25"
                    : "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md"
                  : theme === "dark"
                    ? "border border-white/10 bg-white/5 text-gray-300 hover:border-emerald-500/30"
                    : "en-bg-elevated border border-emerald-200 text-gray-700 hover:border-emerald-400"
              }`}
            >
              <Icon size={15} />
              {label}
              {id === "questions" && (
                <span className="opacity-80">({questions.length})</span>
              )}
            </button>
          );
        })}
      </div>

      <div className={panelClass(theme)}>
        {activeTab === "analytics" && (
          <ExamAnalyticsPanel
            analytics={analytics}
            loading={analyticsLoading}
            examId={examId}
            questions={questions}
            examType={exam.exam_type}
            onScoresUpdated={(options) => reloadAnalytics(undefined, undefined, options)}
          />
        )}

        {activeTab === "integrity" && (
          <div className="space-y-4">
            <ExamAutoSubmittedPanel examId={examId} />
            <ExamSubmissionAlertsPanel examId={examId} />
          </div>
        )}

        {activeTab === "retakes" && (
          <ExamRetakeRequestsPanel
            examId={examId}
            onUpdated={() => reloadAnalytics(undefined, undefined, { silent: true })}
          />
        )}

        {activeTab === "questions" && (
          <AssessmentQuestionsReview
            questions={questions}
            examType={exam.exam_type}
            defaultExpanded={false}
          />
        )}
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
