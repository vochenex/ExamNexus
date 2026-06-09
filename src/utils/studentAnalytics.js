import { resolveAssessmentCategory } from "./assessmentCategories";
import { buildSubjectGradeBreakdown } from "./gradeComputation";

export function percentage(score, total) {
  if (!total || total <= 0) return 0;
  return Math.round((Number(score) / Number(total)) * 1000) / 10;
}

export function estimateGwaFromPercentage(pct) {
  if (pct >= 97) return { gwa: 1.0, label: "1.00", remark: "Excellent" };
  if (pct >= 94) return { gwa: 1.25, label: "1.25", remark: "Superior" };
  if (pct >= 91) return { gwa: 1.5, label: "1.50", remark: "Very Good" };
  if (pct >= 88) return { gwa: 1.75, label: "1.75", remark: "Good" };
  if (pct >= 85) return { gwa: 2.0, label: "2.00", remark: "Satisfactory" };
  if (pct >= 82) return { gwa: 2.25, label: "2.25", remark: "Fair" };
  if (pct >= 79) return { gwa: 2.5, label: "2.50", remark: "Passing" };
  if (pct >= 75) return { gwa: 2.75, label: "2.75", remark: "Minimum Pass" };
  return { gwa: 3.0, label: "3.00", remark: "Needs Improvement" };
}

export function tierFromScore(pct) {
  if (pct >= 90) return { label: "Outstanding", tone: "emerald" };
  if (pct >= 80) return { label: "Strong", tone: "teal" };
  if (pct >= 70) return { label: "Steady Progress", tone: "cyan" };
  if (pct >= 60) return { label: "Developing", tone: "amber" };
  return { label: "Needs Focus", tone: "orange" };
}

export function standingFromPercentile(percentile) {
  if (percentile >= 90) return { label: "Top 10%", tone: "emerald" };
  if (percentile >= 75) return { label: "Upper Quarter", tone: "teal" };
  if (percentile >= 50) return { label: "Above Average", tone: "cyan" };
  if (percentile >= 25) return { label: "Mid Pack", tone: "amber" };
  return { label: "Building Up", tone: "orange" };
}

export function normalizeResultRow(row) {
  const exam = row.exam || {};
  const subject = exam.subjects || {};
  const category = resolveAssessmentCategory(exam);
  const total = Number(row.total) || 0;
  const score = Number(row.score) || 0;
  const pct = percentage(score, total);

  return {
    id: row.id,
    examId: row.exam_id,
    title: exam.title || "Assessment",
    subjectId: exam.subject_id,
    subjectName: subject.name || "Unknown Subject",
    category,
    score,
    total,
    pct,
    createdAt: row.created_at || null,
    pendingReview: total === 0,
  };
}

export function buildStudentAnalytics(
  results = [],
  upcomingAssessments = [],
  stats = {},
  enrolledSubjects = []
) {
  const graded = results.filter((row) => row.total > 0 && !row.pendingReview);
  const overallPct =
    graded.length > 0
      ? Math.round(
          (graded.reduce((sum, row) => sum + row.pct, 0) / graded.length) * 10
        ) / 10
      : null;

  const byCategory = { exam: [], quiz: [], activity: [] };
  for (const row of graded) {
    if (byCategory[row.category]) byCategory[row.category].push(row.pct);
  }

  const averageFor = (items) =>
    items.length
      ? Math.round((items.reduce((a, b) => a + b, 0) / items.length) * 10) / 10
      : null;

  const majorExamPct = averageFor(byCategory.exam);
  const quizPct = averageFor(byCategory.quiz);
  const activityPct = averageFor(byCategory.activity);

  const subjectMap = new Map();
  for (const row of graded) {
    const key = row.subjectId || row.subjectName;
    if (!subjectMap.has(key)) {
      subjectMap.set(key, {
        subjectId: row.subjectId,
        subjectName: row.subjectName,
        scores: [],
      });
    }
    subjectMap.get(key).scores.push(row.pct);
  }

  const subjectPerformance = [...subjectMap.values()]
    .map((entry) => ({
      subjectId: entry.subjectId,
      subjectName: entry.subjectName,
      averagePct:
        Math.round(
          (entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length) * 10
        ) / 10,
      assessmentsTaken: entry.scores.length,
    }))
    .sort((a, b) => b.averagePct - a.averagePct);

  const recentScores = [...graded]
    .sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (aTime !== bTime) return aTime - bTime;
      return String(a.id || "").localeCompare(String(b.id || ""));
    })
    .slice(-8);

  const upcoming = upcomingAssessments.filter(
    (exam) => exam.status === "active" || exam.status === "scheduled"
  );

  const dueSoon = upcoming
    .filter((exam) => exam.end_datetime)
    .sort((a, b) => new Date(a.end_datetime) - new Date(b.end_datetime))
    .slice(0, 4);

  const estimatedGrade = overallPct != null ? estimateGwaFromPercentage(overallPct) : null;
  const majorExamGrade =
    majorExamPct != null ? estimateGwaFromPercentage(majorExamPct) : null;

  const performanceTier = overallPct != null ? tierFromScore(overallPct) : null;
  const subjectGrades = buildSubjectGradeBreakdown(graded, enrolledSubjects);

  return {
    stats: {
      enrolledSubjects: stats.enrolledSubjects ?? 0,
      completedAssessments: stats.completedAssessments ?? graded.length,
      upcomingAssessments: stats.upcomingAssessments ?? upcoming.length,
    },
    overallPct,
    majorExamPct,
    quizPct,
    activityPct,
    estimatedGrade,
    majorExamGrade,
    performanceTier,
    subjectPerformance,
    subjectGrades,
    enrolledSubjects,
    recentScores,
    upcomingCount: upcoming.length,
    dueSoon,
    categoryBreakdown: [
      { key: "exam", label: "Exams", value: majorExamPct, count: byCategory.exam.length },
      { key: "quiz", label: "Quizzes", value: quizPct, count: byCategory.quiz.length },
      { key: "activity", label: "Activities", value: activityPct, count: byCategory.activity.length },
    ].filter((item) => item.count > 0),
  };
}

export function mergeSectionStandings(analytics, standings = []) {
  if (!standings.length) return analytics;

  const standingBySubject = new Map(
    standings.map((row) => [row.subject_id || row.subjectId, row])
  );

  const subjectPerformance = analytics.subjectPerformance.map((subject) => {
    const standing = standingBySubject.get(subject.subjectId);
    if (!standing) return subject;

    const percentile = standing.section_percentile ?? standing.sectionPercentile;
    return {
      ...subject,
      sectionPercentile: percentile,
      standing: standingFromPercentile(percentile),
    };
  });

  const avgPercentile =
    subjectPerformance.filter((s) => s.sectionPercentile != null).length > 0
      ? Math.round(
          subjectPerformance
            .filter((s) => s.sectionPercentile != null)
            .reduce((sum, s) => sum + s.sectionPercentile, 0) /
            subjectPerformance.filter((s) => s.sectionPercentile != null).length
        )
      : null;

  return {
    ...analytics,
    subjectPerformance,
    classStanding: avgPercentile != null ? standingFromPercentile(avgPercentile) : null,
    classStandingPercentile: avgPercentile,
  };
}
