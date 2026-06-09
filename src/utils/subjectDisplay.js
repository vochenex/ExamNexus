export function formatFacultyName(subject) {
  const first = subject?.faculty_first_name?.trim();
  const last = subject?.faculty_last_name?.trim();
  const full = [first, last].filter(Boolean).join(" ");
  if (full) return full;
  if (subject?.faculty_name?.trim()) return subject.faculty_name.trim();
  return null;
}

export function formatFacultyLabel(subject) {
  return formatFacultyName(subject) || "Faculty not assigned";
}

export function getFacultyInitials(subject) {
  const first = subject?.faculty_first_name?.trim();
  const last = subject?.faculty_last_name?.trim();
  const parts = [first?.[0], last?.[0]].filter(Boolean);
  if (parts.length) return parts.join("").toUpperCase();
  if (subject?.faculty_name?.trim()) {
    return subject.faculty_name.trim().slice(0, 2).toUpperCase();
  }
  return "?";
}
