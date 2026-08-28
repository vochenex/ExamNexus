const DEFAULT_VISIBLE_DIGITS = 5;

/**
 * Mask student school IDs for faculty-facing lists.
 * Shows the first 5 characters; digits beyond that become asterisks.
 */
export function maskSchoolIdForDisplay(schoolId, { visibleDigits = DEFAULT_VISIBLE_DIGITS } = {}) {
  const raw = String(schoolId || "").trim();
  if (!raw) return "";

  const limit = Math.max(1, Number(visibleDigits) || DEFAULT_VISIBLE_DIGITS);
  if (raw.length <= limit) return raw;

  return `${raw.slice(0, limit)}${"*".repeat(raw.length - limit)}`;
}

export function formatMaskedSchoolIdLabel(schoolId, options) {
  const masked = maskSchoolIdForDisplay(schoolId, options);
  return masked ? `ID: ${masked}` : "Student";
}
