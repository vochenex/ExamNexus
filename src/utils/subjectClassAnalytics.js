import { resolveAssessmentCategory } from "./assessmentCategories";
import { averageValues, computeFinalGrade, getDefaultWeights } from "./gradeComputation";
import { percentage, tierFromScore } from "./studentAnalytics";

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

export function buildPerStudentSubjectAnalytics(
  exams = [],
  results = [],
  classmates = [],
  subject = {}
) {
  const weights = getDefaultWeights(subject?.subject_type);
  const examById = new Map((exams || []).map((exam) => [exam.id, exam]));
  const resultsByStudent = new Map();

  for (const row of results || []) {
    if (!row?.student_id) continue;
    if (!resultsByStudent.has(row.student_id)) {
      resultsByStudent.set(row.student_id, []);
    }
    resultsByStudent.get(row.student_id).push(row);
  }

  return (classmates || [])
    .map((classmate) => {
      const studentResults = resultsByStudent.get(classmate.id) || [];
      const examScores = [];
      const standingScores = [];
      const sectionScores = [];

      for (const row of studentResults) {
        const exam = examById.get(row.exam_id);
        const total = Number(row.total) || 0;
        if (!exam || total <= 0) continue;

        const pct = percentage(row.score, row.total);
        const category = resolveAssessmentCategory(exam);
        sectionScores.push({
          key: `${classmate.id}-${row.exam_id}`,
          label: exam.title || "Assessment",
          value: pct,
          category,
        });

        if (category === "exam") examScores.push(pct);
        else standingScores.push(pct);
      }

      sectionScores.sort((a, b) => a.label.localeCompare(b.label));

      const majorExamPct = averageValues(examScores);
      const classStandingPct = averageValues(standingScores);
      const overallRating =
        computeFinalGrade({
          majorExamPct,
          classStandingPct,
          attendancePct: null,
          examWeight: weights.exam,
          standingWeight: weights.standing,
          attendanceWeight: weights.attendance,
        }) ??
        averageValues(
          [majorExamPct, classStandingPct].filter((value) => value != null)
        );

      const ratingValue = overallRating ?? 0;

      return {
        ...classmate,
        majorExamPct,
        classStandingPct,
        overallRating,
        ratingPct: overallRating,
        tier: tierFromScore(ratingValue),
        grade: overallRating != null ? `${overallRating}%` : "—",
        sectionScores,
        submissions: studentResults.filter((row) => Number(row.total) > 0).length,
      };
    })
    .sort((a, b) => (b.overallRating ?? -1) - (a.overallRating ?? -1));
}
