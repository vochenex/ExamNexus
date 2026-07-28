import { useEffect, useMemo, useState } from "react";
import { X, ChevronDown, ChevronUp, Save } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import { secondaryButtonSm } from "../utils/themeButtons";
import {
  fetchStudentSubmissionReview,
  saveFacultyQuestionScores,
} from "../utils/supabaseData";
import {
  buildSubmissionReviewItems,
  computeSubmissionTotals,
  formatReviewAnswerDisplay,
} from "../utils/facultyGrading";
import { useModalDismiss } from "../hooks/useModalDismiss";
import ModalPortal from "./ui/ModalPortal";

function clampEssayScoreInput(raw, maxPoints) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return "";
  const value = Math.min(maxPoints, Math.max(0, Number.parseInt(digits, 10)));
  return String(value);
}

function PointsBadge({ earned, max, pending, theme }) {
  const label =
    earned != null
      ? `${earned}/${max} pts`
      : pending
        ? `—/${max} pts`
        : `0/${max} pts`;

  const className =
    earned != null && earned >= max
      ? theme === "dark"
        ? "bg-emerald-500/20 text-emerald-300"
        : "en-bg-skeleton text-emerald-800"
      : earned != null && earned > 0
        ? theme === "dark"
          ? "bg-amber-500/20 text-amber-300"
          : "bg-amber-100 text-amber-800"
        : earned === 0
          ? theme === "dark"
            ? "bg-red-500/20 text-red-300"
            : "bg-red-100 text-red-700"
          : theme === "dark"
            ? "bg-white/10 text-gray-300"
            : "bg-gray-100 text-gray-700";

  return (
    <span className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold ${className}`}>
      {label}
    </span>
  );
}

export default function StudentSubmissionReviewModal({
  open,
  onClose,
  examId,
  studentId,
  studentName,
  questions = [],
  examType = "multiple_choice",
  onSaved,
}) {
  const { theme } = useTheme();
  useModalDismiss(onClose, { enabled: open, closeOnEscape: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState([]);
  const [essayScores, setEssayScores] = useState({});
  const [expanded, setExpanded] = useState({});
  const [saveNotice, setSaveNotice] = useState("");

  useEffect(() => {
    if (!open || !examId || !studentId) return;

    setLoading(true);
    setError("");
    setSaveNotice("");

    fetchStudentSubmissionReview(examId, studentId)
      .then((data) => {
        setAnswers(data.answers || []);
        const items = buildSubmissionReviewItems(
          questions,
          data.answers || [],
          examType
        );
        const initialEssayScores = {};
        for (const item of items) {
          if (item.questionType === "essay") {
            initialEssayScores[item.questionId] =
              item.earnedPoints != null ? String(item.earnedPoints) : "";
          }
        }
        setEssayScores(initialEssayScores);
        setExpanded(
          Object.fromEntries(
            [...new Set(items.map((item) => item.questionType))].map((type) => [
              type,
              true,
            ])
          )
        );
      })
      .catch((err) => setError(err.message || "Failed to load submission."))
      .finally(() => setLoading(false));
    // `questions`/`examType` are read to seed essay scores but must NOT trigger a
    // refetch: their parent rebuilds a new array reference on every realtime poll,
    // which previously caused the modal to flicker/reload every few seconds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, examId, studentId]);

  const reviewItems = useMemo(
    () => buildSubmissionReviewItems(questions, answers, examType),
    [questions, answers, examType]
  );

  const answersByQuestionId = useMemo(
    () => Object.fromEntries(answers.map((row) => [row.question_id, row])),
    [answers]
  );

  const totals = useMemo(
    () => computeSubmissionTotals(questions, answersByQuestionId, examType),
    [questions, answersByQuestionId, examType]
  );

  const groupedItems = useMemo(() => {
    const groups = new Map();
    for (const item of reviewItems) {
      if (!groups.has(item.questionType)) {
        groups.set(item.questionType, {
          type: item.questionType,
          label: item.questionTypeLabel,
          items: [],
        });
      }
      groups.get(item.questionType).items.push(item);
    }
    return [...groups.values()];
  }, [reviewItems]);

  const pendingEssays = reviewItems.filter((item) => item.pendingReview);
  const hasEssays = reviewItems.some((item) => item.questionType === "essay");

  const handleSaveEssayScores = async () => {
    const questionScores = reviewItems
      .filter((item) => item.questionType === "essay")
      .map((item) => ({
        questionId: item.questionId,
        pointsAwarded: essayScores[item.questionId],
      }))
      .filter((entry) => entry.pointsAwarded !== "" && entry.pointsAwarded != null);

    if (questionScores.length === 0) {
      setError("Enter points for at least one essay question.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSaveNotice("");

      const totals = await saveFacultyQuestionScores({
        examId,
        studentId,
        questionScores,
        questions,
        examType,
      });

      const refreshed = await fetchStudentSubmissionReview(examId, studentId);
      setAnswers(refreshed.answers || []);
      const savedItems = buildSubmissionReviewItems(
        questions,
        refreshed.answers || [],
        examType
      );
      const updatedEssayScores = {};
      for (const item of savedItems) {
        if (item.questionType === "essay") {
          updatedEssayScores[item.questionId] =
            item.earnedPoints != null ? String(item.earnedPoints) : "";
        }
      }
      setEssayScores(updatedEssayScores);
      await onSaved?.();

      if (totals.isFullyGraded) {
        onClose?.();
        return;
      }

      setSaveNotice("Scores saved. Finish remaining essays or close when done.");
    } catch (err) {
      setError(err.message || "Failed to save scores.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const overlay = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={`relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border ${
          theme === "dark"
            ? "border-white/10 bg-[#0a120f]"
            : "border-emerald-200/80 en-bg-elevated shadow-xl"
        }`}
      >
        <div
          className={`flex items-start justify-between gap-4 border-b px-5 py-4 ${
            theme === "dark" ? "border-white/10" : "border-emerald-100"
          }`}
        >
          <div>
            <p
              className={`text-xs font-semibold uppercase tracking-wide ${
                theme === "dark" ? "text-emerald-400" : "text-teal-700"
              }`}
            >
              Student submission
            </p>
            <h2 className={`text-xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
              {studentName}
            </h2>
            {!loading && (
              <p className={`mt-1 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                Total:{" "}
                <span className="font-semibold">
                  {totals.score}/{totals.total} pts
                </span>
                {totals.scorePct != null && ` · ${totals.scorePct}%`}
                {totals.pendingCount > 0 &&
                  ` · ${totals.pendingCount} question${totals.pendingCount === 1 ? "" : "s"} pending review`}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-lg p-2 ${theme === "dark" ? "hover:bg-white/10" : "hover:bg-gray-100"}`}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
              Loading answers...
            </p>
          ) : error && !reviewItems.length ? (
            <p className="text-sm text-red-500">{error}</p>
          ) : (
            <div className="space-y-4">
              {groupedItems.map((group) => {
                const isOpen = expanded[group.type] !== false;

                return (
                  <div
                    key={group.type}
                    className={`overflow-hidden rounded-xl border ${
                      theme === "dark" ? "border-white/10 bg-black/20" : "border-emerald-100"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded((current) => ({
                          ...current,
                          [group.type]: !isOpen,
                        }))
                      }
                      className={`flex w-full items-center justify-between px-4 py-3 text-left ${
                        theme === "dark" ? "hover:bg-white/5" : "en-hover"
                      }`}
                    >
                      <span className="font-semibold text-sm">{group.label}</span>
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {isOpen && (
                      <div className="space-y-3 border-t px-4 py-3 border-inherit">
                        {group.items.map((item) => {
                          const question = questions.find((row) => row.id === item.questionId);

                          return (
                            <div
                              key={item.questionId}
                              className={`rounded-xl border p-4 ${
                                theme === "dark"
                                  ? "border-white/10 bg-white/[0.02]"
                                  : "border-emerald-100 en-bg-elevated"
                              }`}
                            >
                              <div className="mb-2 flex items-start justify-between gap-3">
                                <p
                                  className={`text-sm font-semibold ${
                                    theme === "dark" ? "text-white" : "text-gray-900"
                                  }`}
                                >
                                  Q{item.questionNumber}. {item.questionText}
                                </p>
                                <PointsBadge
                                  earned={item.earnedPoints}
                                  max={item.maxPoints}
                                  pending={item.pendingReview}
                                  theme={theme}
                                />
                              </div>

                              <p
                                className={`mb-2 text-xs font-medium uppercase tracking-wide ${
                                  theme === "dark" ? "text-gray-500" : "text-gray-500"
                                }`}
                              >
                                Student answer
                              </p>
                              <p
                                className={`whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                                  theme === "dark"
                                    ? "bg-white/5 text-gray-300"
                                    : "bg-emerald-50/60 text-gray-800"
                                }`}
                              >
                                {formatReviewAnswerDisplay(item, question)}
                              </p>

                              {item.questionType === "essay" && (
                                <div className="mt-3">
                                  <label
                                    htmlFor={`essay-score-${item.questionId}`}
                                    className={`mb-1 block text-xs font-medium ${
                                      theme === "dark" ? "text-gray-400" : "text-gray-600"
                                    }`}
                                  >
                                    Score this essay (max {item.maxPoints} pts)
                                  </label>
                                  <input
                                    id={`essay-score-${item.questionId}`}
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="off"
                                    value={essayScores[item.questionId] ?? ""}
                                    onChange={(event) =>
                                      setEssayScores((current) => ({
                                        ...current,
                                        [item.questionId]: clampEssayScoreInput(
                                          event.target.value,
                                          item.maxPoints
                                        ),
                                      }))
                                    }
                                    onBlur={(event) =>
                                      setEssayScores((current) => ({
                                        ...current,
                                        [item.questionId]: clampEssayScoreInput(
                                          event.target.value,
                                          item.maxPoints
                                        ),
                                      }))
                                    }
                                    placeholder={`0 – ${item.maxPoints}`}
                                    aria-label={`Essay score out of ${item.maxPoints}`}
                                    className={`w-full max-w-[140px] rounded-lg border px-3 py-2 text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
                                      theme === "dark"
                                        ? "border-white/10 bg-white/5 text-white"
                                        : "border-emerald-200/80 en-bg-elevated text-gray-900"
                                    }`}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {saveNotice && (
            <p
              className={`mt-3 text-sm ${
                theme === "dark" ? "text-emerald-400" : "text-emerald-700"
              }`}
            >
              {saveNotice}
            </p>
          )}

          {error && reviewItems.length > 0 && (
            <p className="mt-3 text-sm text-red-500">{error}</p>
          )}
        </div>

        <div
          className={`flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4 ${
            theme === "dark" ? "border-white/10" : "border-emerald-100"
          }`}
        >
          <p className={`text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
            {pendingEssays.length > 0
              ? `${pendingEssays.length} essay${pendingEssays.length === 1 ? "" : "s"} need scoring to finalize the grade.`
              : hasEssays
                ? "Essay scores can be updated below."
                : "All questions have been scored."}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={secondaryButtonSm(theme)}>
              Close
            </button>
            {hasEssays && (
              <button
                type="button"
                onClick={handleSaveEssayScores}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                <Save size={16} />
                {saving ? "Saving..." : saveNotice ? "Saved" : "Save essay scores"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return <ModalPortal>{overlay}</ModalPortal>;
}
