import { useTheme } from "../layouts/ThemeContext";
import Select from "./ui/Select";
import { getYearLevelLabel, normalizeYearLevel, YEAR_LEVELS } from "../utils/yearLevels";

export default function YearLevelBadge({ yearLevel, className = "" }) {
  const { theme } = useTheme();
  const label = getYearLevelLabel(yearLevel);

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
        theme === "dark"
          ? "border-cyan-500/20 bg-cyan-500/10 text-cyan-300"
          : "border-sky-200 bg-sky-50 text-sky-800"
      } ${className}`}
    >
      {label}
    </span>
  );
}

export function YearLevelSelect({ value, onChange, className = "", disabled = false }) {
  return (
    <Select
      value={normalizeYearLevel(value)}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={className}
    >
      {YEAR_LEVELS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}

export function YearLevelFilter({ value, onChange, counts = {} }) {
  const { theme } = useTheme();

  const options = [
    { value: "all", label: "All year levels" },
    ...YEAR_LEVELS,
  ];

  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {options.map((option) => {
        const isActive = value === option.value;
        const count =
          option.value === "all"
            ? counts.all ?? 0
            : counts[option.value] ?? 0;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              isActive
                ? theme === "dark"
                  ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-300"
                  : "border-teal-500 bg-teal-50 text-teal-800"
                : theme === "dark"
                  ? "border-white/10 bg-white/[0.03] text-gray-400 hover:border-white/20 hover:text-gray-200"
                  : "border-emerald-200/80 en-bg-elevated text-gray-600 hover:border-emerald-300 hover:text-teal-800"
            }`}
          >
            {option.label}
            <span className="ml-1.5 opacity-70">({count})</span>
          </button>
        );
      })}
    </div>
  );
}
