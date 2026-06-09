import { sortAssessments } from "./assessmentStatus";

export const ASSESSMENT_CATEGORIES = [
  { value: "exam", label: "Exam" },
  { value: "quiz", label: "Quiz" },
  { value: "activity", label: "Activity" },
];

export const ASSESSMENT_CATEGORY_LABELS = Object.fromEntries(
  ASSESSMENT_CATEGORIES.map(({ value, label }) => [value, label])
);

const CATEGORY_META_RE =
  /^<!--\s*examnexus-category:(exam|quiz|activity)\s*-->\s*/i;

export function normalizeAssessmentCategory(value) {
  const normalized = String(value || "exam").toLowerCase();
  if (normalized === "quiz" || normalized === "activity") return normalized;
  return "exam";
}

export function stripAssessmentCategoryFromDescription(description) {
  return String(description || "")
    .replace(CATEGORY_META_RE, "")
    .trimStart();
}

export function embedAssessmentCategoryInDescription(description, category) {
  const clean = stripAssessmentCategoryFromDescription(description);
  const normalized = normalizeAssessmentCategory(category);
  return clean
    ? `<!-- examnexus-category:${normalized} -->\n${clean}`
    : `<!-- examnexus-category:${normalized} -->`;
}

export function resolveAssessmentCategory(exam) {
  if (exam?.assessment_category) {
    return normalizeAssessmentCategory(exam.assessment_category);
  }

  const match = String(exam?.description || "").match(CATEGORY_META_RE);
  if (match?.[1]) {
    return normalizeAssessmentCategory(match[1]);
  }

  return "exam";
}

export function enrichExamRecord(exam) {
  if (!exam) return exam;

  return {
    ...exam,
    assessment_category: resolveAssessmentCategory(exam),
    description: stripAssessmentCategoryFromDescription(exam.description),
  };
}

export function getAssessmentCategoryLabel(category) {
  return ASSESSMENT_CATEGORY_LABELS[normalizeAssessmentCategory(category)] || "Exam";
}

export function getAssessmentCategoryStyles(category, theme) {
  const value = normalizeAssessmentCategory(category);
  const isDark = theme === "dark";

  const styles = {
    exam: {
      badge: isDark
        ? "bg-red-500/10 text-red-300/90 border-red-500/20"
        : "bg-red-50 text-red-700/90 border-red-200/80",
      accent: isDark ? "border-l-red-400/50" : "border-l-red-300/80",
      card: isDark
        ? "border-red-500/10 bg-red-500/[0.03]"
        : "border-red-100 bg-red-50/30",
      dot: isDark ? "bg-red-400/70" : "bg-red-400/60",
    },
    quiz: {
      badge: isDark
        ? "bg-amber-500/10 text-amber-200/90 border-amber-500/20"
        : "bg-amber-50 text-amber-800/90 border-amber-200/80",
      accent: isDark ? "border-l-amber-400/50" : "border-l-amber-300/80",
      card: isDark
        ? "border-amber-500/10 bg-amber-500/[0.03]"
        : "border-amber-100 bg-amber-50/30",
      dot: isDark ? "bg-amber-400/70" : "bg-amber-400/60",
    },
    activity: {
      badge: isDark
        ? "bg-sky-500/10 text-sky-300/90 border-sky-500/20"
        : "bg-sky-50 text-sky-800/90 border-sky-200/80",
      accent: isDark ? "border-l-sky-400/50" : "border-l-sky-300/80",
      card: isDark
        ? "border-sky-500/10 bg-sky-500/[0.03]"
        : "border-sky-100 bg-sky-50/30",
      dot: isDark ? "bg-sky-400/70" : "bg-sky-400/60",
    },
  };

  return styles[value];
}

export function groupAssessmentsBySubject(assessments, sortBy = "hierarchy") {
  const groups = new Map();

  for (const assessment of assessments) {
    const subjectId = assessment.subject_id || "unknown";
    const subjectName = assessment.subject_name || "Unknown Subject";

    if (!groups.has(subjectId)) {
      groups.set(subjectId, {
        subjectId,
        subjectName,
        assessments: [],
      });
    }

    groups.get(subjectId).assessments.push(assessment);
  }

  return [...groups.values()]
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName))
    .map((group) => ({
      ...group,
      assessments: sortAssessments(group.assessments, sortBy),
    }));
}
