import { useTheme } from "../layouts/ThemeContext";
import { getFormatLabel } from "../utils/questionSections";
import { normalizeGradingOptions } from "../utils/questionGrading";

const inputClass = (theme) =>
  `w-full max-w-[5.5rem] rounded-xl px-3 py-2 text-sm font-semibold text-center transition focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
    theme === "dark"
      ? "bg-white/10 text-white border border-white/10"
      : "en-bg-input text-[#1a332c] border border-emerald-700/20"
  }`;

export default function AssessmentPointsPanel({ sections, onChange }) {
  const { theme } = useTheme();

  if (!sections?.length) {
    return null;
  }

  return (
    <div className="space-y-2">
      {sections.map((section) => {
        const grading = normalizeGradingOptions(section.gradingDefaults);

        return (
          <div
            key={section.id}
            className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${
              theme === "dark"
                ? "border-white/10 bg-white/[0.03]"
                : "border-emerald-700/15 en-bg-elevated-soft"
            }`}
          >
            <div className="min-w-0 flex-1">
              <p
                className={`break-words text-sm font-semibold leading-snug ${
                  theme === "dark" ? "text-emerald-300" : "text-teal-800"
                }`}
              >
                {getFormatLabel(section.type)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <label
                htmlFor={`points-${section.id}`}
                className={`text-xs font-medium ${
                  theme === "dark" ? "text-gray-400" : "text-[#5a7a72]"
                }`}
              >
                pts
              </label>
              <input
                id={`points-${section.id}`}
                type="number"
                min="1"
                step="1"
                className={inputClass(theme)}
                value={grading.points}
                onChange={(e) =>
                  onChange(section.id, {
                    ...grading,
                    points: Math.max(1, Number(e.target.value) || 1),
                  })
                }
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
