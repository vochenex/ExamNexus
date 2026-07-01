import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import { normalizeGradingOptions, supportsGradingOptions } from "../utils/questionGrading";
import { getFormatLabel } from "../utils/questionSections";

function ToggleRow({ theme, label, hint, checked, onChange, disabled = false }) {
  return (
    <label
      className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      } ${
        theme === "dark"
          ? "border-white/10 bg-white/[0.03]"
          : "border-emerald-100 bg-emerald-50/40"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
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
  defaultOpen = false,
}) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(defaultOpen || compact);

  if (!supportsGradingOptions(sectionType)) {
    return null;
  }

  const grading = normalizeGradingOptions(gradingDefaults);

  const patch = (updates) => {
    onChange(normalizeGradingOptions({ ...grading, ...updates }));
  };

  const body = (
    <>
      <ToggleRow
        theme={theme}
        label="Case sensitive"
        hint="Answer must match the expected text exactly, including capitalization."
        checked={grading.case_sensitive}
        disabled={grading.accept_alternatives}
        onChange={(checked) => patch({ case_sensitive: checked })}
      />

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

      {(sectionType === "identification" || sectionType === "enumeration") && (
        <ToggleRow
          theme={theme}
          label="Accept alternative answers"
          hint={
            sectionType === "enumeration"
              ? "Allow other accepted spellings for listed answers; casing is ignored."
              : "Allow other accepted spellings; casing is ignored."
          }
          checked={grading.accept_alternatives}
          disabled={grading.case_sensitive}
          onChange={(checked) =>
            patch({
              accept_alternatives: checked,
              alternatives: checked ? grading.alternatives : [],
            })
          }
        />
      )}

    </>
  );

  if (compact) {
    return (
      <div
        className={`space-y-3 rounded-xl border p-4 ${
          theme === "dark"
            ? "border-white/10 bg-white/[0.02]"
            : "border-emerald-700/15 en-bg-elevated-soft"
        }`}
      >
        <div>
          <p
            className={`text-sm font-bold ${
              theme === "dark" ? "text-emerald-300" : "text-teal-800"
            }`}
          >
            {getFormatLabel(sectionType)}
          </p>
          <p
            className={`mt-0.5 text-xs ${
              theme === "dark" ? "text-gray-500" : "text-[#5a7a72]"
            }`}
          >
            Grading defaults for all {getFormatLabel(sectionType).toLowerCase()} questions
          </p>
        </div>
        {body}
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border ${
        theme === "dark"
          ? "border-white/10 bg-white/[0.03]"
          : "border-emerald-100 bg-emerald-50/30"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left ${
          theme === "dark" ? "text-emerald-300" : "text-teal-800"
        }`}
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold">
            {getFormatLabel(sectionType)} grading
          </span>
          <span
            className={`mt-0.5 block text-xs ${
              theme === "dark" ? "text-gray-500" : "text-gray-500"
            }`}
          >
            Applied to all {getFormatLabel(sectionType).toLowerCase()} questions
          </span>
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && <div className="space-y-3 border-t border-inherit px-4 py-4">{body}</div>}
    </div>
  );
}
