export const DEFAULT_DURATION_VALUE = 60;
export const DEFAULT_DURATION_UNIT = "minutes";

export function normalizeDurationUnit(unit) {
  const normalized = String(unit || DEFAULT_DURATION_UNIT).trim().toLowerCase();
  if (normalized === "hour" || normalized === "hours") return "hours";
  if (normalized === "day" || normalized === "days") return "days";
  if (normalized === "week" || normalized === "weeks") return "weeks";
  return "minutes";
}

/** True when the faculty form has a usable time-limit number. */
export function isDurationValueProvided(value) {
  if (value === "" || value === null || value === undefined) return false;
  const parsed = Number.parseInt(String(value).trim(), 10);
  return Number.isFinite(parsed) && parsed >= 1;
}

/**
 * Controlled input helper — empty stays empty (no forced 60).
 * Returns "" or a positive integer.
 */
export function parseDurationInput(value) {
  if (value === "" || value === null || value === undefined) {
    return "";
  }
  const parsed = Number.parseInt(String(value).trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return "";
  }
  return parsed;
}

export function formatDurationInputValue(value) {
  if (value === "" || value === null || value === undefined) {
    return "";
  }
  const parsed = Number.parseInt(String(value).trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return "";
  }
  return String(parsed);
}

export function parseDurationValue(value, fallback = DEFAULT_DURATION_VALUE) {
  if (value === "" || value === null || value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(String(value).trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

export function getAssessmentDurationSeconds(examData) {
  const value = parseDurationValue(examData?.duration_value, DEFAULT_DURATION_VALUE);
  const unit = normalizeDurationUnit(examData?.duration_unit);

  switch (unit) {
    case "hours":
      return value * 60 * 60;
    case "days":
      return value * 60 * 60 * 24;
    case "weeks":
      return value * 60 * 60 * 24 * 7;
    default:
      return value * 60;
  }
}

export function formatAssessmentDurationLabel(examData) {
  const value = parseDurationValue(examData?.duration_value, DEFAULT_DURATION_VALUE);
  const unit = normalizeDurationUnit(examData?.duration_unit);

  if (unit === "hours") {
    return `${value} ${value === 1 ? "hour" : "hours"}`;
  }
  if (unit === "days") {
    return `${value} ${value === 1 ? "day" : "days"}`;
  }
  if (unit === "weeks") {
    return `${value} ${value === 1 ? "week" : "weeks"}`;
  }

  return `${value} ${value === 1 ? "minute" : "minutes"}`;
}

export function durationFieldsForDb(examPayload) {
  return {
    duration_value: parseDurationValue(examPayload?.duration_value, DEFAULT_DURATION_VALUE),
    duration_unit: normalizeDurationUnit(examPayload?.duration_unit),
  };
}

export function focusAssessmentDurationField() {
  if (typeof document === "undefined") return;
  const field = document.getElementById("assessment-duration-field");
  const input = document.getElementById("assessment-duration-value");
  field?.scrollIntoView({ behavior: "smooth", block: "center" });
  window.setTimeout(() => {
    input?.focus?.();
    input?.select?.();
  }, 180);
}
