import { useTheme } from "../layouts/ThemeContext";
import { formatFacultyLabel } from "../utils/subjectDisplay";
import ProfileAvatar from "./ProfileAvatar";

export default function FacultyProfileChip({ subject, compact = false, subjectCount = null }) {
  const { theme } = useTheme();
  const name = formatFacultyLabel(subject);

  return (
    <div className={`flex items-center gap-3 ${compact ? "" : "mt-1"}`}>
      <ProfileAvatar
        src={subject?.faculty_avatar_url}
        alt={name}
        size={compact ? "xs" : "sm"}
      />

      <div className="min-w-0">
        <p
          className={`text-xs uppercase tracking-wide ${
            theme === "dark" ? "text-gray-500" : "text-gray-500"
          }`}
        >
          Faculty
        </p>
        <p
          className={`truncate font-medium text-sm ${
            theme === "dark" ? "text-gray-200" : "text-gray-900"
          }`}
        >
          {name}
        </p>
        {subjectCount != null && compact && (
          <p className={`text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-600"}`}>
            {subjectCount} subject{subjectCount === 1 ? "" : "s"}
          </p>
        )}
      </div>
    </div>
  );
}
