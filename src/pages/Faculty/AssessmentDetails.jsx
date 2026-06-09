import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import BackButton from "../../components/BackButton";
import { useTheme } from "../../layouts/ThemeContext";
import { secondaryButtonSm } from "../../utils/themeButtons";
import { Pencil, Trash2 } from "lucide-react";
import AssessmentQuestionsReview from "../../components/AssessmentQuestionsReview";
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

  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const reloadAnalytics = async (questionList, examRecord, { silent = false } = {}) => {
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
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const data = await fetchExamWithQuestions(examId);
        setExam(data.exam);
        setQuestions(data.questions);

        setAnalyticsLoading(true);
        const analyticsData = await fetchExamFacultyAnalytics(
          examId,
          data.questions,
          data.exam.exam_type
        );
        setAnalytics(analyticsData);
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to load assessment.");
      } finally {
        setLoading(false);
        setAnalyticsLoading(false);
      }
    };

    load();
  }, [examId]);

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await deleteExam(examId);
      setShowDeleteModal(false);
      navigate(-1);
    } catch (err) {
      console.error(err);
      alert(err.message || "Delete failed.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen p-6 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
        Loading assessment...
      </div>
    );
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

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate(`/faculty/edit-assessment/${examId}`)}
              className={`inline-flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all hover:-translate-y-0.5 ${
                theme === "dark"
                  ? "border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/15 hover:border-cyan-400/40"
                  : "border border-cyan-300 bg-cyan-50 text-cyan-800 shadow-sm hover:bg-cyan-100"
              }`}
            >
              <Pencil size={17} strokeWidth={2.25} />
              Edit
            </button>

            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className={`inline-flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all hover:-translate-y-0.5 ${
                theme === "dark"
                  ? "border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/15"
                  : "border border-red-300 bg-red-50 text-red-700 shadow-sm hover:bg-red-100"
              }`}
            >
              <Trash2 size={17} strokeWidth={2.25} />
              Delete
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

      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md rounded-2xl border p-6 ${
              theme === "dark"
                ? "border-red-500/30 bg-slate-900"
                : "border-red-300/80 en-bg-elevated shadow-xl"
            }`}
          >
            <h2
              className={`mb-3 text-xl font-bold ${
                theme === "dark" ? "text-red-400" : "text-red-600"
              }`}
            >
              Delete Assessment
            </h2>
            <p className={`mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>
              Are you sure you want to delete:
            </p>
            <p className={`mb-4 font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
              {exam.title}
            </p>
            <p className={`mb-6 text-sm ${theme === "dark" ? "text-red-300" : "text-red-600"}`}>
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className={secondaryButtonSm(theme)}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-xl bg-red-600 px-4 py-2 font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Delete Assessment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
