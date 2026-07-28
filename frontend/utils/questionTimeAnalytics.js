import { getFormatLabel } from "./questionSections";
import { getQuestionType } from "./questionGrading";

export function formatDurationSeconds(seconds) {
  if (seconds == null || !Number.isFinite(Number(seconds))) return "—";
  const total = Math.max(0, Math.round(Number(seconds)));
  if (total < 60) return `${total}s`;

  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  return remainder > 0 ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

export function groupQuestionTimeByFormat(items = []) {
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
          (b.avgTimeSeconds || 0) - (a.avgTimeSeconds || 0) ||
          a.questionNumber - b.questionNumber
      ),
    }))
    .sort((a, b) => {
      const maxA = Math.max(...a.items.map((entry) => entry.avgTimeSeconds || 0), 0);
      const maxB = Math.max(...b.items.map((entry) => entry.avgTimeSeconds || 0), 0);
      return maxB - maxA || a.label.localeCompare(b.label);
    });
}

export function buildQuestionTimeAnalytics(
  questions = [],
  studentAnswers = [],
  examType = "multiple_choice"
) {
  return questions
    .map((question, index) => {
      const answersForQuestion = (studentAnswers || []).filter(
        (row) => row.question_id === question.id
      );

      const timedSamples = answersForQuestion
        .map((row) => Number(row.time_spent_seconds))
        .filter((value) => Number.isFinite(value) && value >= 0);

      const sampleCount = timedSamples.length;
      const avgTimeSeconds =
        sampleCount > 0
          ? Math.round(
              timedSamples.reduce((sum, value) => sum + value, 0) / sampleCount
            )
          : null;

      const maxTimeSeconds = sampleCount > 0 ? Math.max(...timedSamples) : null;

      return {
        questionId: question.id,
        questionNumber: index + 1,
        questionText: question.question || "",
        questionType: getQuestionType(question, examType),
        avgTimeSeconds,
        maxTimeSeconds,
        sampleCount,
      };
    })
    .sort(
      (a, b) =>
        (b.avgTimeSeconds || 0) - (a.avgTimeSeconds || 0) ||
        a.questionNumber - b.questionNumber
    );
}

export function getOverallAverageQuestionTime(items = []) {
  const withData = (items || []).filter(
    (item) => item.avgTimeSeconds != null && item.sampleCount > 0
  );

  if (!withData.length) return null;

  const weighted = withData.reduce(
    (acc, item) => {
      acc.total += item.avgTimeSeconds * item.sampleCount;
      acc.count += item.sampleCount;
      return acc;
    },
    { total: 0, count: 0 }
  );

  return weighted.count > 0 ? Math.round(weighted.total / weighted.count) : null;
}
