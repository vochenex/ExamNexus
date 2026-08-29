const DEFAULT_VISIBLE_DIGITS = 5;

function normalizeRole(role) {
  return String(role || "").toLowerCase();
}

/**
 * Mask school IDs shown to students viewing other people.
 * Faculty and admin roster views should use full IDs.
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

export function formatSchoolIdLabel(schoolId) {
  const raw = String(schoolId || "").trim();
  return raw ? `ID: ${raw}` : "Student";
}

export function formatSchoolIdForViewer(
  schoolId,
  { viewerRole, isSelf = false, visibleDigits = DEFAULT_VISIBLE_DIGITS } = {}
) {
  const raw = String(schoolId || "").trim();
  if (!raw) return "Student";

  const role = normalizeRole(viewerRole);
  if (isSelf || role === "faculty" || role === "admin") {
    return formatSchoolIdLabel(raw);
  }

  return formatMaskedSchoolIdLabel(raw, { visibleDigits });
}
