import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { RotateCcw, Trophy } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import { primaryButtonSm, secondaryButtonSm } from "../utils/themeButtons";
import {
  canStudentTakeAssessment,
  canRequestRetake,
  canStudentViewResultsFromCard,
  getStudentAssessmentStatus,
  getStudentAssessmentStatusLabel,
  getRetakeStatusLabel,
} from "../utils/assessmentStatus";
import { motion } from "../utils/motion";
import { useAppModal } from "../contexts/AppModalContext";
import { requestExamRetake } from "../utils/supabaseData";
import { formatTargetSectionsLabel } from "../utils/sections";
import {
  getAssessmentCategoryLabel,
  getAssessmentCategoryStyles,
  resolveAssessmentCategory,
} from "../utils/assessmentCategories";
import { getFormatLabel } from "../utils/questionSections";

function getStudentStatusBadgeClass(status, theme) {
  if (status === "retake_approved") {
    return theme === "dark"
      ? "bg-cyan-500/20 text-cyan-300"
      : "bg-cyan-100 text-cyan-900";
  }

  if (status === "completed") {
    return theme === "dark"
      ? "bg-emerald-500/20 text-emerald-300"
      : "en-bg-skeleton text-emerald-800";
  }

  if (status === "missed") {
    return theme === "dark"
      ? "bg-red-500/20 text-red-300"
      : "bg-red-100 text-red-700";
  }

  return theme === "dark"
    ? "bg-amber-500/20 text-amber-300"
    : "bg-amber-100 text-amber-800";
}

export default function StudentAssessmentCard({
  assessment,
  showSubject = false,
  compact = false,
  highlighted = false,
  onRetakeUpdated,
}) {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { error } = useAppModal();
  const [requesting, setRequesting] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");

  const studentStatus = getStudentAssessmentStatus(assessment);
  const studentStatusLabel = getStudentAssessmentStatusLabel(studentStatus);
  const canTake = canStudentTakeAssessment(assessment);
  const canRetake = canRequestRetake(assessment);
  const retakeLabel = getRetakeStatusLabel(assessment.retake_status);
  const category = resolveAssessmentCategory(assessment);
  const categoryStyles = getAssessmentCategoryStyles(category, theme);
  const canViewResults = canStudentViewResultsFromCard(assessment);
  const user = JSON.parse(localStorage.getItem("examnexus_user") || "{}");

  const handleRequestRetake = async () => {
    try {
      setRequesting(true);
      await requestExamRetake(assessment.id, requestMessage);
      setShowRequestForm(false);
      setRequestMessage("");
      onRetakeUpdated?.();
    } catch (err) {
      error(err.message || "Failed to submit retake request.");
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div
      id={`assessment-${assessment.id}`}
      className={`${motion.interactiveCard} rounded-2xl border border-l-4 transition ${
        compact ? "p-4" : "p-5"
      } ${categoryStyles.accent} ${categoryStyles.card} ${
        highlighted
          ? theme === "dark"
            ? "ring-2 ring-emerald-400/40 shadow-lg shadow-emerald-500/10"
            : "ring-2 ring-emerald-400 shadow-md"
          : theme === "dark"
            ? "hover:bg-white/[0.06]"
            : "hover:shadow-md"
      }`}
    >
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${categoryStyles.badge}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${categoryStyles.dot}`} />
            {getAssessmentCategoryLabel(category)}
          </span>

          <span
            className={`rounded-full px-2.5 py-1 text-xs ${
              theme === "dark"
                ? "bg-white/5 text-gray-400"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {getFormatLabel(assessment.exam_type === "mixed" ? "mixed" : assessment.exam_type) ||
              assessment.exam_type?.replace(/_/g, " ") ||
              "Assessment"}
          </span>

          <span
            className={`inline-block rounded-lg px-2 py-1 text-xs font-semibold ${getStudentStatusBadgeClass(
              studentStatus,
              theme
            )}`}
          >
            {studentStatusLabel}
          </span>

          {retakeLabel && assessment.retake_status !== "fulfilled" && (
            <span
              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold ${
                assessment.retake_status === "pending"
                  ? theme === "dark"
                    ? "bg-amber-500/15 text-amber-300"
                    : "bg-amber-100 text-amber-900"
                  : assessment.retake_status === "denied"
                    ? theme === "dark"
                      ? "bg-red-500/15 text-red-300"
                      : "bg-red-100 text-red-800"
                    : theme === "dark"
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-emerald-100 text-emerald-900"
              }`}
            >
              <RotateCcw size={12} />
              {retakeLabel}
            </span>
          )}
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {canTake && (
            <button
              type="button"
              onClick={() => navigate(`/student/take-assessment/${assessment.id}`)}
              className={primaryButtonSm(
                theme,
                "text-xs px-3 py-1.5 rounded-lg"
              )}
            >
              {assessment.retake_status === "approved" ? "Retake Assessment" : "Take Assessment"}
            </button>
          )}

          {canRetake && !showRequestForm && (
            <button
              type="button"
              onClick={() => setShowRequestForm(true)}
              className={secondaryButtonSm(theme, "text-xs px-3 py-1.5 rounded-lg")}
            >
              <RotateCcw size={14} />
              Request Retake
            </button>
          )}

          {canViewResults && user.id && (
            <button
              type="button"
              onClick={() => navigate(`/student/results/${assessment.id}/${user.id}`)}
              className={secondaryButtonSm(theme, "text-xs px-3 py-1.5 rounded-lg")}
            >
              <Trophy size={14} />
              View Results
            </button>
          )}
        </div>

        {showRequestForm && (
          <div
            className={`mb-3 rounded-xl border p-3 ${
              theme === "dark"
                ? "border-white/10 bg-white/[0.03]"
                : "border-emerald-200/80 en-bg-muted"
            }`}
          >
            <textarea
              value={requestMessage}
              onChange={(e) => setRequestMessage(e.target.value)}
              placeholder="Optional message for your instructor..."
              rows={2}
              className={`mb-2 w-full rounded-lg px-3 py-2 text-xs outline-none ${
                theme === "dark"
                  ? "border border-white/10 bg-white/5 text-white"
                  : "border border-emerald-200 en-bg-input text-gray-900"
              }`}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={requesting}
                onClick={handleRequestRetake}
                className={primaryButtonSm(theme, "text-xs px-3 py-1.5 rounded-lg")}
              >
                {requesting ? "Sending..." : "Submit request"}
              </button>
              <button
                type="button"
                disabled={requesting}
                onClick={() => {
                  setShowRequestForm(false);
                  setRequestMessage("");
                }}
                className={secondaryButtonSm(theme, "text-xs px-3 py-1.5 rounded-lg")}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {showSubject && assessment.subject_name && (
          <p
            className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
              theme === "dark" ? "text-cyan-400" : "text-teal-600"
            }`}
          >
            {assessment.subject_name}
          </p>
        )}

        <h3
          className={`font-bold truncate ${
            compact ? "text-base" : "text-xl"
          } ${theme === "dark" ? "text-white" : "text-gray-900"}`}
        >
          {assessment.title}
        </h3>

        {assessment.description && !compact && (
          <p
            className={`mt-1 text-sm line-clamp-2 ${
              theme === "dark" ? "text-gray-400" : "text-gray-600"
            }`}
          >
            {assessment.description}
          </p>
        )}

        {assessment.target_sections && (
          <p
            className={`text-xs mt-2 ${
              theme === "dark" ? "text-gray-500" : "text-gray-500"
            }`}
          >
            {formatTargetSectionsLabel(assessment.target_sections)}
          </p>
        )}

        {!compact && (
          <>
            <p className={`mt-2 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
              Start:{" "}
              {assessment.start_datetime
                ? new Date(assessment.start_datetime).toLocaleString("en-PH", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "N/A"}
            </p>
            <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
              End:{" "}
              {assessment.end_datetime
                ? new Date(assessment.end_datetime).toLocaleString("en-PH", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "N/A"}
            </p>
          </>
        )}

        {compact && assessment.end_datetime && (
          <p className={`mt-2 text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
            Due:{" "}
            {new Date(assessment.end_datetime).toLocaleString("en-PH", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        )}
      </div>
    </div>
  );
}
