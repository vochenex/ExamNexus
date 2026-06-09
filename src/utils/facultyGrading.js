import { normalizeGradingOptions, getQuestionType } from "./questionGrading";
import { parseStoredAnswer } from "./assessmentQuestions";
import { getFormatLabel } from "./questionSections";

export function getQuestionMaxPoints(question, examType = "multiple_choice") {
  const grading = normalizeGradingOptions(
    question?.grading_options || question?.grading
  );
  return Number(grading.points) > 0 ? Number(grading.points) : 1;
}

export function resolveAnswerPoints(answer, maxPoints) {
  if (answer?.points_awarded != null && answer.points_awarded !== "") {
    const parsed = Number(answer.points_awarded);
    return Number.isFinite(parsed) ? Math.max(0, Math.min(maxPoints, parsed)) : null;
  }

  if (answer?.is_correct === true) return maxPoints;
  if (answer?.is_correct === false) return 0;
  return null;
}

export function computeSubmissionTotals(questions = [], answersByQuestionId = {}, examType) {
  let score = 0;
  let total = 0;
  let pendingCount = 0;

  for (const question of questions) {
    const maxPoints = getQuestionMaxPoints(question, examType);
    total += maxPoints;

    const answer = answersByQuestionId[question.id];
    const earned = resolveAnswerPoints(answer, maxPoints);

    if (earned == null) {
      pendingCount += 1;
    } else {
      score += earned;
    }
  }

  const scorePct =
    total > 0 ? Math.round((score / total) * 1000) / 10 : null;

  return {
    score: Math.round(score * 100) / 100,
    total,
    scorePct,
    pendingCount,
    isFullyGraded: pendingCount === 0,
  };
}

export function buildSubmissionReviewItems(questions = [], answers = [], examType) {
  const answersByQuestionId = Object.fromEntries(
    answers.map((row) => [row.question_id, row])
  );

  return questions.map((question, index) => {
    const questionType = getQuestionType(question, examType);
    const maxPoints = getQuestionMaxPoints(question, examType);
    const answer = answersByQuestionId[question.id] || null;
    const earnedPoints = resolveAnswerPoints(answer, maxPoints);
    const pendingReview =
      questionType === "essay" && earnedPoints == null && answer?.is_correct == null;

    return {
      questionId: question.id,
      questionNumber: index + 1,
      questionType,
      questionTypeLabel: getFormatLabel(questionType),
      questionText: question.question || "",
      maxPoints,
      earnedPoints,
      pendingReview,
      answerId: answer?.id || null,
      studentAnswer: answer?.answer || "",
      parsedAnswer: answer
        ? parseStoredAnswer(answer.answer, questionType)
        : null,
      isCorrect: answer?.is_correct ?? null,
      rawAnswer: answer,
    };
  });
}

export function formatReviewAnswerDisplay(item, question) {
  if (!item.studentAnswer) return "No answer submitted";

  const questionType = item.questionType;

  if (questionType === "enumeration" && Array.isArray(item.parsedAnswer)) {
    return item.parsedAnswer
      .map((value, idx) => `${idx + 1}. ${value || "—"}`)
      .join("\n");
  }

  if (questionType === "true_false") {
    return item.parsedAnswer === "true"
      ? "True"
      : item.parsedAnswer === "false"
        ? "False"
        : String(item.parsedAnswer || "");
  }

  if (questionType === "multiple_choice") {
    const letter = String(item.parsedAnswer || "").toUpperCase();
    const option = question?.[`option_${letter.toLowerCase()}`];
    return option ? `${letter}. ${option}` : letter || item.studentAnswer;
  }

  if (questionType === "essay") {
    return String(item.parsedAnswer || item.studentAnswer || "");
  }

  return String(item.parsedAnswer || item.studentAnswer || "");
}
