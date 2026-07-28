import { useEffect, useState } from "react";
import { useTheme } from "../layouts/ThemeContext";
import { getFacultySubjectCount } from "../utils/supabaseData";
import FacultyProfileChip from "./FacultyProfileChip";

export default function SubjectFacultyCard({ faculty, subject }) {
  const { theme } = useTheme();
  const [subjectCount, setSubjectCount] = useState(null);

  const chipSubject = faculty
    ? {
        faculty_first_name: faculty.first_name,
        faculty_last_name: faculty.last_name,
        faculty_avatar_url: faculty.avatar_url,
      }
    : subject;

  useEffect(() => {
    const schoolId = faculty?.school_id || subject?.teacher_school_id;
    if (!schoolId) return;

    getFacultySubjectCount(schoolId)
      .then((count) => setSubjectCount(count))
      .catch(() => setSubjectCount(null));
  }, [faculty?.school_id, subject?.teacher_school_id]);

  return (
    <div
      className={`
        rounded-2xl p-5 border
        ${
          theme === "dark"
            ? "bg-white/5 border-white/10"
            : "en-bg-elevated border-emerald-200 shadow-sm"
        }
      `}
    >
      <h2
        className={`text-sm font-semibold uppercase tracking-wide mb-3 ${
          theme === "dark" ? "text-emerald-400" : "text-teal-700"
        }`}
      >
        Assigned Faculty
      </h2>
      <FacultyProfileChip subject={chipSubject} subjectCount={subjectCount} />
      {faculty?.email && (
        <p className={`mt-3 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
          {faculty.email}
        </p>
      )}
      {faculty?.department && (
        <p className={`text-sm ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
          {faculty.department}
        </p>
      )}
      {subjectCount != null && (
        <p className={`mt-2 text-sm font-medium ${
          theme === "dark" ? "text-emerald-400" : "text-teal-700"
        }`}>
          Teaches {subjectCount} subject{subjectCount === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}
