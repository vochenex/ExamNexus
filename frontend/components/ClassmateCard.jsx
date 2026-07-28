import ProfileAvatar from "./ProfileAvatar";
import { useTheme } from "../layouts/ThemeContext";
import { formatSectionLabel } from "../utils/sections";

export default function ClassmateCard({ classmate, highlight = false }) {
  const { theme } = useTheme();
  const name = `${classmate.first_name || ""} ${classmate.last_name || ""}`.trim() || "Student";

  return (
    <div
      className={`
        flex items-center gap-3 rounded-xl p-3 border transition-all
        ${
          highlight
            ? theme === "dark"
              ? "bg-emerald-500/15 border-emerald-500/40"
              : "en-bg-skeleton border-emerald-400"
            : theme === "dark"
              ? "bg-white/5 border-white/10 hover:border-emerald-500/20"
              : "en-bg-elevated border-emerald-200 hover:border-emerald-300"
        }
      `}
    >
      <ProfileAvatar src={classmate.avatar_url} alt={name} size="sm" />
      <div className="min-w-0 flex-1">
        <p
          className={`truncate font-medium text-sm ${
            theme === "dark" ? "text-gray-100" : "text-gray-900"
          }`}
        >
          {name}
          {classmate.is_you && (
            <span
              className={`ml-2 text-xs font-semibold ${
                theme === "dark" ? "text-emerald-400" : "text-teal-700"
              }`}
            >
              (You)
            </span>
          )}
        </p>
        <p className={`text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-600"}`}>
          {classmate.school_id ? `ID: ${classmate.school_id}` : "Student"}
        </p>
      </div>
      <span
        className={`
          shrink-0 rounded-lg px-2 py-1 text-xs font-semibold
          ${
            theme === "dark"
              ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"
              : "bg-cyan-50 text-cyan-800 border border-cyan-200"
          }
        `}
      >
        {formatSectionLabel(classmate.section)}
      </span>
    </div>
  );
}
