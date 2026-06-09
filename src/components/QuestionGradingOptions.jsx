import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { useTheme } from "../layouts/ThemeContext";
import {
  CASE_FORMAT_OPTIONS,
  normalizeGradingOptions,
  supportsGradingOptions,
  getQuestionType,
} from "../utils/questionGrading";
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

function ToggleRow({ theme, label, hint, checked, onChange, disabled = false }) {
  return (
    <label
      className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${
        disabled
          ? "opacity-50 cursor-not-allowed"
          : "cursor-pointer"
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

export default function QuestionGradingOptions({
  question,
  examType,
  onUpdateGrading,
}) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const type = getQuestionType(question, examType);

  if (!supportsGradingOptions(type)) {
    return null;
  }

  const grading = normalizeGradingOptions(question.grading);

  const patchGrading = (patch) => {
    onUpdateGrading({
      ...grading,
      ...patch,
    });
  };

  const addAlternative = () => {
    patchGrading({
      alternatives: [...grading.alternatives, ""],
    });
  };

  const updateAlternative = (index, value) => {
    const next = [...grading.alternatives];
    next[index] = value;
    patchGrading({ alternatives: next });
  };

  const removeAlternative = (index) => {
    patchGrading({
      alternatives: grading.alternatives.filter((_, i) => i !== index),
    });
  };

  return (
    <div
      className={`rounded-xl border ${
        theme === "dark"
          ? "border-white/10 bg-white/[0.03]"
          : "border-emerald-100 en-bg-elevated/70"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`flex w-full items-center justify-between px-4 py-3 text-left ${
          theme === "dark" ? "text-emerald-300" : "text-teal-800"
        }`}
      >
        <span className="text-sm font-semibold">Grading options</span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="space-y-3 border-t px-4 py-4 border-inherit">
          <ToggleRow
            theme={theme}
            label="Case sensitive"
            hint="Student answer must match capitalization exactly."
            checked={grading.case_sensitive}
            onChange={(checked) =>
              patchGrading({
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
                onChange={(e) => patchGrading({ case_format: e.target.value })}
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
            hint="Ignore leading and trailing spaces when checking answers."
            checked={grading.trim_whitespace}
            onChange={(checked) => patchGrading({ trim_whitespace: checked })}
          />

          {type === "enumeration" && (
            <ToggleRow
              theme={theme}
              label="Accept any order"
              hint="Correct if all answers are present, even in a different order."
              checked={grading.ignore_order}
              onChange={(checked) => patchGrading({ ignore_order: checked })}
            />
          )}

          {type === "identification" && (
            <>
              <ToggleRow
                theme={theme}
                label="Accept alternative answers"
                hint="Count other valid spellings or phrasings as correct."
                checked={grading.accept_alternatives}
                onChange={(checked) =>
                  patchGrading({
                    accept_alternatives: checked,
                    alternatives: checked ? grading.alternatives : [],
                  })
                }
              />

              {grading.accept_alternatives && (
                <div className="space-y-2">
                  <label className={labelClass(theme)}>Alternative answers</label>
                  {grading.alternatives.length === 0 && (
                    <p
                      className={`text-xs ${
                        theme === "dark" ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      Add other accepted answers besides the main correct answer.
                    </p>
                  )}
                  {grading.alternatives.map((alternative, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        className={inputClass(theme)}
                        placeholder={`Alternative ${index + 1}`}
                        value={alternative}
                        onChange={(e) => updateAlternative(index, e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => removeAlternative(index)}
                        className="rounded-lg p-2 text-red-400 hover:bg-red-500/10"
                        aria-label={`Remove alternative ${index + 1}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addAlternative}
                    className={`inline-flex items-center gap-1 text-sm font-medium ${
                      theme === "dark"
                        ? "text-emerald-400 hover:text-emerald-300"
                        : "text-teal-700 hover:text-teal-900"
                    }`}
                  >
                    <Plus size={14} />
                    Add alternative
                  </button>
                </div>
              )}
            </>
          )}

          <div>
            <label className={labelClass(theme)}>Points</label>
            <input
              type="number"
              min="1"
              step="1"
              className={inputClass(theme)}
              value={grading.points}
              onChange={(e) =>
                patchGrading({
                  points: Math.max(1, Number(e.target.value) || 1),
                })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
