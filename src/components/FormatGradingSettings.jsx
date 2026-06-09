import { useTheme } from "../layouts/ThemeContext";
import {
  CASE_FORMAT_OPTIONS,
  normalizeGradingOptions,
  supportsGradingOptions,
} from "../utils/questionGrading";
import { getFormatLabel } from "../utils/questionSections";
import Select from "./ui/Select";

const labelClass = (theme) =>
  `block text-xs font-semibold uppercase tracking-wide mb-2 ${
    theme === "dark" ? "text-emerald-400/80" : "text-teal-700"
  }`;

const inputClass = (theme) =>
  `w-full p-2.5 rounded-xl text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
    theme === "dark"
      ? "bg-white/10 text-white border border-white/10"
      : "en-bg-elevated text-gray-900 border border-emerald-200"
  }`;

function ToggleRow({ theme, label, hint, checked, onChange }) {
  return (
    <label
      className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 cursor-pointer ${
        theme === "dark"
          ? "border-white/10 bg-white/[0.03]"
          : "border-emerald-100 bg-emerald-50/40"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {hint && (
          <span
            className={`mt-0.5 block text-xs ${
              theme === "dark" ? "text-gray-400" : "text-gray-600"
            }`}
          >
            {hint}
          </span>
        )}
      </span>
    </label>
  );
}

export default function FormatGradingSettings({
  sectionType,
  gradingDefaults,
  onChange,
  compact = false,
}) {
  const { theme } = useTheme();

  if (!supportsGradingOptions(sectionType)) {
    return null;
  }

  const grading = normalizeGradingOptions(gradingDefaults);

  const patch = (updates) => {
    onChange({ ...grading, ...updates });
  };

  return (
    <div
      className={`space-y-3 ${
        compact
          ? ""
          : `rounded-xl border p-4 ${
              theme === "dark"
                ? "border-white/10 bg-white/[0.03]"
                : "border-emerald-100 bg-emerald-50/30"
            }`
      }`}
    >
      {!compact && (
        <div>
          <p
            className={`text-xs font-semibold uppercase tracking-wide ${
              theme === "dark" ? "text-emerald-400" : "text-teal-700"
            }`}
          >
            {getFormatLabel(sectionType)} grading
          </p>
          <p className={`mt-1 text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
            Applied to all {getFormatLabel(sectionType).toLowerCase()} questions.
          </p>
        </div>
      )}

      <ToggleRow
        theme={theme}
        label="Case sensitive"
        hint="Answers must match capitalization exactly."
        checked={grading.case_sensitive}
        onChange={(checked) =>
          patch({
            case_sensitive: checked,
            case_format: checked ? "any" : grading.case_format,
          })
        }
      />

      {!grading.case_sensitive && (
        <div>
          <label className={labelClass(theme)}>Expected casing</label>
          <Select
            value={grading.case_format}
            onChange={(e) => patch({ case_format: e.target.value })}
          >
            {CASE_FORMAT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      )}

      <ToggleRow
        theme={theme}
        label="Trim extra spaces"
        hint="Ignore leading and trailing spaces."
        checked={grading.trim_whitespace}
        onChange={(checked) => patch({ trim_whitespace: checked })}
      />

      {sectionType === "enumeration" && (
        <ToggleRow
          theme={theme}
          label="Accept any order"
          hint="Correct if all answers are present in any order."
          checked={grading.ignore_order}
          onChange={(checked) => patch({ ignore_order: checked })}
        />
      )}

      {sectionType === "identification" && (
        <ToggleRow
          theme={theme}
          label="Accept alternative answers"
          hint="Allow extra accepted answers per question."
          checked={grading.accept_alternatives}
          onChange={(checked) =>
            patch({
              accept_alternatives: checked,
            })
          }
        />
      )}

      <div>
        <label className={labelClass(theme)}>Points per question</label>
        <input
          type="number"
          min="1"
          step="1"
          className={inputClass(theme)}
          value={grading.points}
          onChange={(e) =>
            patch({
              points: Math.max(1, Number(e.target.value) || 1),
            })
          }
        />
      </div>
    </div>
  );
}
