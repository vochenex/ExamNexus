import { useTheme } from "../layouts/ThemeContext";
import { SUBJECT_SECTIONS, formatSectionLabel } from "../utils/sections";

export default function SectionPicker({
  value = [],
  onChange,
  disabled = false,
  label = "Target sections",
  hint = "Choose which sections can see this.",
  sections = SUBJECT_SECTIONS,
}) {
  const { theme } = useTheme();
  const selected = Array.isArray(value) ? value : [];
  const availableSections = sections.length ? sections : SUBJECT_SECTIONS;

  const toggleSection = (section) => {
    if (disabled) return;

    const isSelected = selected.includes(section);
    if (isSelected) {
      if (selected.length === 1) return;
      onChange(selected.filter((item) => item !== section));
      return;
    }

    onChange([...selected, section].sort());
  };

  const selectAll = () => {
    if (!disabled) onChange([...availableSections]);
  };

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p
          className={`text-sm font-medium ${
            theme === "dark" ? "text-emerald-400" : "text-teal-700"
          }`}
        >
          {label}
        </p>
        <button
          type="button"
          disabled={disabled}
          onClick={selectAll}
          className={`text-xs underline-offset-2 hover:underline disabled:opacity-50 ${
            theme === "dark" ? "text-gray-400" : "text-gray-600"
          }`}
        >
          All sections
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {availableSections.map((section) => {
          const active = selected.includes(section);
          return (
            <button
              key={section}
              type="button"
              disabled={disabled}
              onClick={() => toggleSection(section)}
              className={`px-3 py-2 rounded-xl text-sm font-medium transition ${
                active
                  ? theme === "dark"
                    ? "bg-emerald-500 text-black"
                    : "bg-emerald-500 text-white"
                  : theme === "dark"
                    ? "bg-white/10 text-gray-300 hover:bg-white/15"
                    : "en-bg-elevated border border-emerald-200 text-gray-700 en-hover"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {formatSectionLabel(section)}
            </button>
          );
        })}
      </div>

      {hint && (
        <p className={`mt-2 text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
          {hint}
        </p>
      )}
    </div>
  );
}
