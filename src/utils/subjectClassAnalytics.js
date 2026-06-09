import { resolveAssessmentCategory } from "./assessmentCategories";
import { averageValues } from "./gradeComputation";
import { percentage } from "./studentAnalytics";

export function buildSubjectClassAnalytics(exams = [], results = []) {
  const resultsByExam = new Map();

  for (const row of results || []) {
    if (!resultsByExam.has(row.exam_id)) {
      resultsByExam.set(row.exam_id, []);
    }
    resultsByExam.get(row.exam_id).push(row);
  }

  const examScores = [];
  const standingScores = [];
  const majorExamChart = [];

  for (const exam of exams || []) {
    const category = resolveAssessmentCategory(exam);
    const examResults = resultsByExam.get(exam.id) || [];
    if (!examResults.length) continue;

    const percentages = examResults
      .map((row) => percentage(row.score, row.total))
      .filter((value) => Number.isFinite(value));

    if (!percentages.length) continue;

    const classAverage = averageValues(percentages);
    if (classAverage == null) continue;

    if (category === "exam") {
      examScores.push(classAverage);
      majorExamChart.push({
        key: exam.id,
        label: exam.title || "Exam",
        value: classAverage,
        meta: `${examResults.length} submission${examResults.length === 1 ? "" : "s"}`,
      });
    } else {
      standingScores.push(classAverage);
    }
  }

  majorExamChart.sort((a, b) => a.label.localeCompare(b.label));

  return {
    majorExamPct: averageValues(examScores),
    classStandingPct: averageValues(standingScores),
    majorExamChart,
    majorExamCount: examScores.length,
    standingAssessmentCount: standingScores.length,
    totalSubmissions: (results || []).length,
  };
}
