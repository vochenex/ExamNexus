export function getAssessmentStatus(assessment) {
  const now = new Date();

  if (
    assessment?.start_datetime &&
    now < new Date(assessment.start_datetime)
  ) {
    return "scheduled";
  }

  if (
    assessment?.end_datetime &&
    now > new Date(assessment.end_datetime)
  ) {
    return "closed";
  }

  return "active";
}

export function getAssessmentStatusLabel(status) {
  if (status === "scheduled") return "Scheduled";
  if (status === "closed") return "Closed";
  return "Available";
}

export function getStudentAssessmentStatus(assessment) {
  if (assessment?.retake_status === "approved") {
    return "retake_approved";
  }

  if (assessment?.retake_status === "pending") {
    return assessment?.submitted ? "completed" : "missed";
  }

  if (assessment?.submitted) return "completed";

  if (getAssessmentStatus(assessment) === "closed") {
    return "missed";
  }

  return "pending";
}

export function getStudentAssessmentStatusLabel(status) {
  if (status === "retake_approved") return "Retake approved";
  if (status === "completed") return "Completed";
  if (status === "missed") return "Missed";
  return "Pending";
}

export function canStudentTakeAssessment(assessment) {
  if (assessment?.retake_status === "approved") {
    return getAssessmentStatus(assessment) !== "scheduled";
  }

  return (
    !assessment?.submitted &&
    getAssessmentStatus(assessment) === "active"
  );
}

export function canStudentAccessResults(exam) {
  return exam?.allow_student_view !== false;
}

export function canStudentViewResultsFromCard(assessment) {
  if (getStudentAssessmentStatus(assessment) !== "completed") return false;
  if (assessment?.allow_student_view === false) return false;
  return assessment?.allow_show_correct_answers !== false;
}

export function getStudentResultsReleaseLabel(exam) {
  if (!canStudentAccessResults(exam)) return "Completed";
  if (exam?.allow_question_review === false) return "Score only";
  if (exam?.allow_show_correct_answers === false) return "Review (no answers)";
  return "Full review";
}

export function canRequestRetake(assessment) {
  if (!assessment) return false;
  if (assessment.retake_status === "pending") return false;
  if (assessment.retake_status === "approved") return false;

  const status = getStudentAssessmentStatus(assessment);
  if (assessment.retake_status === "denied") {
    return status === "completed" || status === "missed";
  }

  return status === "completed" || status === "missed";
}

export function getRetakeStatusLabel(status) {
  if (status === "pending") return "Retake pending";
  if (status === "approved") return "Retake approved";
  if (status === "denied") return "Retake denied";
  if (status === "fulfilled") return "Retake used";
  return null;
}

export const ASSESSMENT_SORT_OPTIONS = [
  { value: "hierarchy", label: "Type (Exam → Quiz → Activity)" },
  { value: "name", label: "Assessment name" },
  { value: "due_date", label: "Due date" },
  { value: "date_made", label: "Date created" },
];

const CATEGORY_RANK = { exam: 0, quiz: 1, activity: 2 };

function assessmentTimeValue(assessment, fields = []) {
  for (const field of fields) {
    const time = new Date(assessment?.[field]).getTime();
    if (Number.isFinite(time)) return time;
  }
  return null;
}

export function sortAssessmentsRecentFirst(assessments = []) {
  return sortAssessments(assessments, "date_made");
}

export function sortAssessments(assessments = [], sortBy = "hierarchy") {
  const list = [...assessments];

  if (sortBy === "name") {
    return list.sort((a, b) =>
      String(a?.title || "").localeCompare(String(b?.title || ""), undefined, {
        sensitivity: "base",
      })
    );
  }

  if (sortBy === "due_date") {
    return list.sort((a, b) => {
      const aTime = assessmentTimeValue(a, ["end_datetime", "start_datetime"]) ?? Infinity;
      const bTime = assessmentTimeValue(b, ["end_datetime", "start_datetime"]) ?? Infinity;
      if (aTime !== bTime) return aTime - bTime;
      return String(a?.title || "").localeCompare(String(b?.title || ""), undefined, {
        sensitivity: "base",
      });
    });
  }

  if (sortBy === "date_made") {
    return list.sort((a, b) => {
      const aTime =
        assessmentTimeValue(a, ["created_at", "start_datetime", "end_datetime"]) ?? 0;
      const bTime =
        assessmentTimeValue(b, ["created_at", "start_datetime", "end_datetime"]) ?? 0;
      if (aTime !== bTime) return bTime - aTime;
      return String(a?.title || "").localeCompare(String(b?.title || ""), undefined, {
        sensitivity: "base",
      });
    });
  }

  return list.sort((a, b) => {
    const rankA =
      CATEGORY_RANK[String(a?.assessment_category || "exam").toLowerCase()] ??
      CATEGORY_RANK.exam;
    const rankB =
      CATEGORY_RANK[String(b?.assessment_category || "exam").toLowerCase()] ??
      CATEGORY_RANK.exam;
    if (rankA !== rankB) return rankA - rankB;

    const aDue = assessmentTimeValue(a, ["end_datetime", "start_datetime"]) ?? Infinity;
    const bDue = assessmentTimeValue(b, ["end_datetime", "start_datetime"]) ?? Infinity;
    if (aDue !== bDue) return aDue - bDue;

    return String(a?.title || "").localeCompare(String(b?.title || ""), undefined, {
      sensitivity: "base",
    });
  });
}
