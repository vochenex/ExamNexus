export const MIN_SECTION_COUNT = 1;
export const MAX_SECTION_COUNT = 12;
export const DEFAULT_SECTION_COUNT = 3;

export function indexToSectionLetter(index) {
  const safe = Math.min(MAX_SECTION_COUNT, Math.max(1, Number.parseInt(index, 10) || 1));
  return String.fromCharCode(64 + safe);
}

export function sectionLetterToIndex(section) {
  const letter = String(section || "A").trim().toUpperCase();
  if (!/^[A-Z]$/.test(letter)) return 1;
  const index = letter.charCodeAt(0) - 64;
  return Math.min(MAX_SECTION_COUNT, Math.max(1, index));
}

export function normalizeSectionCount(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return DEFAULT_SECTION_COUNT;
  return Math.min(MAX_SECTION_COUNT, Math.max(MIN_SECTION_COUNT, parsed));
}

export function getSectionsForCount(count) {
  const normalized = normalizeSectionCount(count);
  return Array.from({ length: normalized }, (_, index) => indexToSectionLetter(index + 1));
}

export function getSubjectSections(subject) {
  return getSectionsForCount(subject?.section_count);
}

export function getMaxEnrolledSectionIndex(classmates = []) {
  let max = MIN_SECTION_COUNT;

  for (const classmate of classmates) {
    max = Math.max(max, sectionLetterToIndex(classmate.section));
  }

  return max;
}

export function formatSubjectSectionsLabel(count) {
  const sections = getSectionsForCount(count);
  if (sections.length === 0) return "No sections";
  if (sections.length === 1) return `Section ${sections[0]}`;
  if (sections.length === 2) return `Sections ${sections[0]} and ${sections[1]}`;

  const last = sections[sections.length - 1];
  const rest = sections.slice(0, -1).map((section) => `Section ${section}`).join(", ");
  return `${rest}, and Section ${last}`;
}

export function normalizeTargetSections(sections, availableSections = getSectionsForCount(DEFAULT_SECTION_COUNT)) {
  const allowed = Array.isArray(availableSections) && availableSections.length
    ? availableSections
    : getSectionsForCount(DEFAULT_SECTION_COUNT);
  const source = Array.isArray(sections) ? sections : allowed;
  const normalized = [
    ...new Set(
      source
        .map((section) => String(section || "A").trim().toUpperCase())
        .filter((section) => allowed.includes(section))
    ),
  ];

  return normalized.length ? normalized : [...allowed];
}

export function formatTargetSectionsLabel(sections, availableSections = getSectionsForCount(DEFAULT_SECTION_COUNT)) {
  const allowed = Array.isArray(availableSections) && availableSections.length
    ? availableSections
    : getSectionsForCount(DEFAULT_SECTION_COUNT);
  const normalized = normalizeTargetSections(sections, allowed);

  if (normalized.length === allowed.length) {
    return "All Sections";
  }

  return normalized.map((section) => formatSectionLabel(section)).join(", ");
}

export function isVisibleToSection(targetSections, studentSection, availableSections = getSectionsForCount(DEFAULT_SECTION_COUNT)) {
  const section = String(studentSection || "A").trim().toUpperCase();
  return normalizeTargetSections(targetSections, availableSections).includes(section);
}

export function formatSectionLabel(section) {
  if (!section) return "Unassigned";
  return `Section ${section}`;
}

export function groupBySection(items, sectionKey = "section", availableSections = getSectionsForCount(DEFAULT_SECTION_COUNT)) {
  const sections = Array.isArray(availableSections) && availableSections.length
    ? availableSections
    : getSectionsForCount(DEFAULT_SECTION_COUNT);

  return sections.reduce((groups, section) => {
    groups[section] = items.filter(
      (item) => String(item[sectionKey] || "A").toUpperCase() === section
    );
    return groups;
  }, {});
}

export function buildSectionCounts(classmates = [], availableSections = getSectionsForCount(DEFAULT_SECTION_COUNT)) {
  const sections = Array.isArray(availableSections) && availableSections.length
    ? availableSections
    : getSectionsForCount(DEFAULT_SECTION_COUNT);
  const counts = { all: classmates.length };

  for (const section of sections) {
    counts[section] = 0;
  }

  for (const classmate of classmates) {
    const key = String(classmate.section || "A").toUpperCase();
    if (counts[key] !== undefined) counts[key] += 1;
  }

  return counts;
}

export function getSectionsForSubjects(subjects = []) {
  if (!subjects.length) return getSectionsForCount(DEFAULT_SECTION_COUNT);

  const maxCount = Math.max(
    ...subjects.map((subject) => normalizeSectionCount(subject?.section_count))
  );

  return getSectionsForCount(maxCount);
}

/** Default A–C list for legacy callers */
export const SUBJECT_SECTIONS = ["A", "B", "C"];
