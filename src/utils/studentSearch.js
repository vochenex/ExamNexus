export function matchesStudentSearch(student, query) {
  const trimmed = String(query || "").trim().toLowerCase();
  if (!trimmed) return true;
  const name = `${student.first_name || ""} ${student.last_name || ""}`.trim().toLowerCase();
  const id = String(student.school_id || "").toLowerCase();
  return name.includes(trimmed) || id.includes(trimmed);
}
