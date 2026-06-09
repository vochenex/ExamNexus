export const YEAR_LEVELS = [
  { value: "1st_year", label: "1st Year" },
  { value: "2nd_year", label: "2nd Year" },
  { value: "3rd_year", label: "3rd Year" },
  { value: "4th_year", label: "4th Year" },
];

export const YEAR_LEVEL_LABELS = Object.fromEntries(
  YEAR_LEVELS.map(({ value, label }) => [value, label])
);

export const DEFAULT_YEAR_LEVEL = "1st_year";

const LEGACY_GRADE_LEVELS = new Set([
  "grade_7",
  "grade_8",
  "grade_9",
  "grade_10",
  "grade_11",
  "grade_12",
]);

function toCanonicalYearLevelKey(value) {
  const trimmed = String(value).trim();
  if (YEAR_LEVEL_LABELS[trimmed]) return trimmed;

  const lower = trimmed.toLowerCase();
  if (YEAR_LEVEL_LABELS[lower]) return lower;

  const underscored = lower.replace(/[\s-]+/g, "_");
  if (YEAR_LEVEL_LABELS[underscored]) return underscored;

  if (LEGACY_GRADE_LEVELS.has(lower) || LEGACY_GRADE_LEVELS.has(underscored)) {
    return DEFAULT_YEAR_LEVEL;
  }

  return null;
}

export function normalizeYearLevel(value) {
  if (value == null || String(value).trim() === "") {
    return DEFAULT_YEAR_LEVEL;
  }

  return toCanonicalYearLevelKey(value) || DEFAULT_YEAR_LEVEL;
}

export function normalizeYearLevelForStorage(value) {
  if (value == null || String(value).trim() === "") return null;
  return toCanonicalYearLevelKey(value);
}

export function getYearLevelLabel(value) {
  return YEAR_LEVEL_LABELS[normalizeYearLevel(value)] || "1st Year";
}

export function filterSubjectsByYearLevel(subjects, yearFilter) {
  if (!yearFilter || yearFilter === "all") return subjects || [];
  return (subjects || []).filter(
    (subject) => normalizeYearLevel(subject.year_level) === yearFilter
  );
}
