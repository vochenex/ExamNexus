export const GRADE_WEIGHT_PRESETS = {
  major: { exam: 60, standing: 30, attendance: 10, label: "Major subject" },
  minor: { exam: 70, standing: 20, attendance: 10, label: "Minor subject" },
};

export function getDefaultWeights(subjectType = "major") {
  return subjectType === "minor"
    ? { ...GRADE_WEIGHT_PRESETS.minor }
    : { ...GRADE_WEIGHT_PRESETS.major };
}

export function averageValues(values = []) {
  if (!values.length) return null;
  return (
    Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) /
    10
  );
}

export function computeAttendanceScore(classesMissed, totalClasses) {
  const total = Math.max(1, Number(totalClasses) || 1);
  const missed = Math.max(0, Math.min(total, Number(classesMissed) || 0));
  return Math.round(((total - missed) / total) * 1000) / 10;
}

export function computeFinalGrade({
  majorExamPct,
  classStandingPct,
  attendancePct,
  examWeight,
  standingWeight,
  attendanceWeight = 10,
}) {
  let weightedSum = 0;
  let appliedWeight = 0;

  if (majorExamPct != null) {
    weightedSum += majorExamPct * (examWeight / 100);
    appliedWeight += examWeight;
  }

  if (classStandingPct != null) {
    weightedSum += classStandingPct * (standingWeight / 100);
    appliedWeight += standingWeight;
  }

  if (attendancePct != null) {
    weightedSum += attendancePct * (attendanceWeight / 100);
    appliedWeight += attendanceWeight;
  }

  if (appliedWeight === 0) return null;

  const scale = appliedWeight < 100 ? 100 / appliedWeight : 1;
  return Math.round(weightedSum * scale * 10) / 10;
}

export function buildSubjectGradeBreakdown(gradedResults = [], enrolledSubjects = []) {
  const subjectMap = new Map();

  for (const subject of enrolledSubjects) {
    if (!subject?.id) continue;
    subjectMap.set(subject.id, {
      subjectId: subject.id,
      subjectName: subject.name || "Subject",
      subjectType: subject.subject_type === "minor" ? "minor" : "major",
      examScores: [],
      quizScores: [],
      activityScores: [],
    });
  }

  for (const row of gradedResults) {
    const key = row.subjectId;
    if (!key) continue;

    if (!subjectMap.has(key)) {
      subjectMap.set(key, {
        subjectId: key,
        subjectName: row.subjectName || "Subject",
        subjectType: "major",
        examScores: [],
        quizScores: [],
        activityScores: [],
      });
    }

    const entry = subjectMap.get(key);
    if (row.category === "exam") entry.examScores.push(row.pct);
    else if (row.category === "quiz") entry.quizScores.push(row.pct);
    else if (row.category === "activity") entry.activityScores.push(row.pct);
  }

  return [...subjectMap.values()]
    .map((entry) => ({
      subjectId: entry.subjectId,
      subjectName: entry.subjectName,
      subjectType: entry.subjectType,
      majorExamPct: averageValues(entry.examScores),
      classStandingPct: averageValues([...entry.quizScores, ...entry.activityScores]),
      quizPct: averageValues(entry.quizScores),
      activityPct: averageValues(entry.activityScores),
      examCount: entry.examScores.length,
      quizCount: entry.quizScores.length,
      activityCount: entry.activityScores.length,
      standingCount: entry.quizScores.length + entry.activityScores.length,
    }))
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName));
}

export function estimateGradeFromPercentage(pct) {
  if (pct == null) return null;
  if (pct >= 97) return { label: "1.00", remark: "Excellent" };
  if (pct >= 94) return { label: "1.25", remark: "Superior" };
  if (pct >= 91) return { label: "1.50", remark: "Very Good" };
  if (pct >= 88) return { label: "1.75", remark: "Good" };
  if (pct >= 85) return { label: "2.00", remark: "Satisfactory" };
  if (pct >= 82) return { label: "2.25", remark: "Fair" };
  if (pct >= 79) return { label: "2.50", remark: "Passing" };
  if (pct >= 75) return { label: "2.75", remark: "Minimum Pass" };
  return { label: "3.00", remark: "Needs Improvement" };
}
