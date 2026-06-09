import { getQuestionType } from "./questionGrading";
import { getFormatLabel } from "./questionSections";
import {
  buildQuestionTimeAnalytics,
  getOverallAverageQuestionTime,
  groupQuestionTimeByFormat,
} from "./questionTimeAnalytics";

export function percentage(score, total) {
  if (!total || total <= 0) return 0;
  return Math.round((Number(score) / Number(total)) * 1000) / 10;
}

export function resolveQuestionFormatType(question, examType) {
  return getQuestionType(question, examType);
}

export function groupQuestionDifficultyByFormat(items = []) {
  const groups = new Map();

  for (const item of items) {
    const type = item.questionType || "multiple_choice";
    if (!groups.has(type)) {
      groups.set(type, []);
    }
    groups.get(type).push(item);
  }

  return [...groups.entries()]
    .map(([type, groupItems]) => ({
      type,
      label: getFormatLabel(type),
      items: [...groupItems].sort(
        (a, b) =>
          b.incorrectCount - a.incorrectCount ||
          a.questionNumber - b.questionNumber
      ),
    }))
    .sort((a, b) => {
      const maxA = Math.max(...a.items.map((entry) => entry.incorrectCount), 0);
      const maxB = Math.max(...b.items.map((entry) => entry.incorrectCount), 0);
      return maxB - maxA || a.label.localeCompare(b.label);
    });
}

export function buildExamFacultyAnalytics(
  results = [],
  studentAnswers = [],
  questions = [],
  examType = "multiple_choice"
) {
  const submissions = (results || []).filter((row) => row.student_id);
  const gradedResults = submissions.filter((row) => Number(row.total) > 0);

  const classAverage =
    gradedResults.length > 0
      ? Math.round(
          (gradedResults.reduce(
            (sum, row) => sum + percentage(row.score, row.total),
            0
          ) /
            gradedResults.length) *
            10
        ) / 10
      : null;

  const submissionCount = submissions.length;

  const questionDifficulty = questions
    .map((question, index) => {
      const answersForQuestion = (studentAnswers || []).filter(
        (row) => row.question_id === question.id
      );

      const graded = answersForQuestion.filter((row) => row.is_correct !== null);
      const incorrectCount = graded.filter((row) => row.is_correct === false).length;
      const correctCount = graded.filter((row) => row.is_correct === true).length;
      const accuracyRate =
        graded.length > 0
          ? Math.round((correctCount / graded.length) * 1000) / 10
          : null;

      return {
        questionId: question.id,
        questionNumber: index + 1,
        questionText: question.question || "",
        questionType: resolveQuestionFormatType(question, examType),
        incorrectCount,
        correctCount,
        responseCount: graded.length,
        accuracyRate,
      };
    })
    .sort(
      (a, b) =>
        b.incorrectCount - a.incorrectCount ||
        a.questionNumber - b.questionNumber
    );

  const studentPerformance = submissions
    .map((row) => {
      const user = row.users || {};
      const name =
        `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
        user.school_id ||
        "Student";

      const total = Number(row.total) || 0;
      const score = Number(row.score) || 0;

      return {
        studentId: row.student_id,
        name,
        score,
        total,
        scorePct: total > 0 ? percentage(row.score, row.total) : null,
        pendingReview: total === 0,
      };
    })
    .sort((a, b) => {
      if (a.scorePct != null && b.scorePct != null) return b.scorePct - a.scorePct;
      if (a.scorePct != null) return -1;
      if (b.scorePct != null) return 1;
      return a.name.localeCompare(b.name);
    });

  const questionTimeAnalytics = buildQuestionTimeAnalytics(
    questions,
    studentAnswers,
    examType
  );

  return {
    classAverage,
    submissionCount,
    questionDifficulty,
    questionDifficultyGroups: groupQuestionDifficultyByFormat(questionDifficulty),
    questionTimeAnalytics,
    questionTimeGroups: groupQuestionTimeByFormat(questionTimeAnalytics),
    overallAvgQuestionTimeSeconds: getOverallAverageQuestionTime(questionTimeAnalytics),
    studentPerformance,
  };
}

export function buildSubmissionAlertRankings(results = [], integrityEvents = []) {
  const submissions = (results || []).filter((row) => row.student_id);

  const eventsByStudent = (integrityEvents || []).reduce((acc, event) => {
    const id = event.student_id;
    if (!id) return acc;
    if (!acc[id]) acc[id] = [];
    acc[id].push(event);
    return acc;
  }, {});

  return submissions
    .map((row) => {
      const user = row.users || {};
      const name =
        `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
        user.school_id ||
        "Student";
      const alerts = eventsByStudent[row.student_id] || [];
      const alertCount = alerts.length;

      return {
        studentId: row.student_id,
        name,
        score: Number(row.score) || 0,
        total: Number(row.total) || 0,
        scorePct: percentage(row.score, row.total),
        alertCount,
        alertTier: getAlertTier(alertCount),
        alerts,
      };
    })
    .sort((a, b) => {
      if (b.alertCount !== a.alertCount) return b.alertCount - a.alertCount;
      return b.scorePct - a.scorePct;
    });
}

export function getAlertTier(alertCount) {
  if (alertCount === 0) return "blue";
  if (alertCount <= 2) return "yellow";
  return "red";
}
