import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import ToggleOptionRow from "./ui/ToggleOptionRow";
import { normalizeGradingOptions, supportsGradingOptions } from "../utils/questionGrading";
import { getFormatLabel } from "../utils/questionSections";

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
      <ToggleOptionRow
        theme={theme}
        label="Case sensitive"
        hint="Answer must match the expected text exactly, including capitalization."
        checked={grading.case_sensitive}
        disabled={grading.accept_alternatives}
        onChange={(checked) => patch({ case_sensitive: checked })}
      />

      <ToggleOptionRow
        theme={theme}
        label="Trim extra spaces"
        hint="Ignore leading and trailing spaces."
        checked={grading.trim_whitespace}
        onChange={(checked) => patch({ trim_whitespace: checked })}
      />

      {sectionType === "enumeration" && (
        <ToggleOptionRow
          theme={theme}
          label="Accept any order"
          hint="Correct if all answers are present in any order."
          checked={grading.ignore_order}
          onChange={(checked) => patch({ ignore_order: checked })}
        />
      )}

      {(sectionType === "identification" || sectionType === "enumeration") && (
        <ToggleOptionRow
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
        className={`min-w-0 space-y-3 rounded-xl border p-4 ${
          theme === "dark"
            ? "border-white/10 bg-white/[0.02]"
            : "border-emerald-700/15 en-bg-elevated-soft"
        }`}
      >
        <div className="min-w-0">
          <p
            className={`break-words text-sm font-bold leading-snug ${
              theme === "dark" ? "text-emerald-300" : "text-teal-800"
            }`}
          >
            {getFormatLabel(sectionType)}
          </p>
          <p
            className={`mt-0.5 break-words text-xs leading-snug ${
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
      className={`min-w-0 rounded-xl border ${
        theme === "dark"
          ? "border-white/10 bg-white/[0.03]"
          : "border-emerald-100 bg-emerald-50/30"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`flex w-full min-w-0 items-center justify-between gap-3 px-4 py-3 text-left ${
          theme === "dark" ? "text-emerald-300" : "text-teal-800"
        }`}
      >
        <span className="min-w-0 flex-1 overflow-hidden">
          <span className="block break-words text-sm font-semibold leading-snug">
            {getFormatLabel(sectionType)} grading
          </span>
          <span
            className={`mt-0.5 block break-words text-xs leading-snug ${
              theme === "dark" ? "text-gray-500" : "text-gray-500"
            }`}
          >
            Applied to all {getFormatLabel(sectionType).toLowerCase()} questions
          </span>
        </span>
        {open ? <ChevronUp size={16} className="shrink-0" /> : <ChevronDown size={16} className="shrink-0" />}
      </button>
      {open && <div className="min-w-0 space-y-3 border-t border-inherit px-4 py-4">{body}</div>}
    </div>
  );
}
