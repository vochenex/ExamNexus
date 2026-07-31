export function normalizeSchoolId(value) {
  return String(value || "").replace(/\D/g, "");
}

export function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

export function getSchoolIdRule(role) {
  const normalized = normalizeRole(role);

  if (normalized === "admin") {
    return {
      min: 3,
      max: 3,
      label: "exactly 3 numbers",
      example: "123",
    };
  }

  if (normalized === "faculty") {
    return {
      min: 5,
      max: 5,
      label: "exactly 5 numbers",
      example: "12345",
    };
  }

  return {
    min: 9,
    max: 13,
    label: "9 to 13 numbers",
    example: "202412345",
  };
}

export function getSchoolIdHelpText(role) {
  const normalized = normalizeRole(role);
  const roleLabel =
    normalized === "admin"
      ? "Admin"
      : normalized === "faculty"
        ? "Faculty"
        : "Student";
  const rule = getSchoolIdRule(role);
  return `${roleLabel} School ID must contain ${rule.label}.`;
}

export function validateSchoolIdForRole(value, role) {
  const raw = String(value || "").trim();
  const normalized = normalizeSchoolId(value);
  const rule = getSchoolIdRule(role);

  if (!normalized) {
    return {
      valid: false,
      normalized,
      message: "School ID is required.",
    };
  }

  if (raw !== normalized) {
    return {
      valid: false,
      normalized,
      message: "School ID must contain numbers only.",
    };
  }

  if (normalized.length < rule.min || normalized.length > rule.max) {
    return {
      valid: false,
      normalized,
      message: getSchoolIdHelpText(role),
    };
  }

  return {
    valid: true,
    normalized,
    message: "",
  };
}

export function isSchoolIdValidForRole(value, role) {
  return validateSchoolIdForRole(value, role).valid;
}

export function validateSchoolIdAnyRole(value) {
  const raw = String(value || "").trim();
  const normalized = normalizeSchoolId(value);
  const valid =
    raw === normalized &&
    (/^\d{3}$/.test(normalized) ||
      /^\d{5}$/.test(normalized) ||
      (normalized.length >= 9 && normalized.length <= 13));

  return {
    valid,
    normalized,
    message: valid
      ? ""
      : "Enter a 3-digit admin ID, 5-digit faculty ID, or 9 to 13-digit student ID.",
  };
}
