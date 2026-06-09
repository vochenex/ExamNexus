import { primaryButton } from "../utils/themeButtons";
import { DEFAULT_DURATION_VALUE, parseDurationValue } from "../utils/assessmentDuration";
import Select from "./ui/Select";

function ToggleRow({ theme, label, hint, checked, onChange, disabled = false }) {
  return (
    <label
      className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
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

export default function AssessmentSettingsPanel({
  exam,
  onChange,
  loading,
  onPublish,
  publishLabel,
  theme,
}) {
  const inputClass = `w-full p-3 rounded-xl text-sm ${
    theme === "dark"
      ? "bg-white/10 text-white border border-white/10"
      : "en-bg-elevated text-gray-900 border border-emerald-200"
  }`;

  return (
    <div className="space-y-4">
      <div>
        <label
          className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${
            theme === "dark" ? "text-emerald-400/80" : "text-teal-700"
          }`}
        >
          Student instructions
        </label>
        <textarea
          rows={3}
          className={inputClass}
          placeholder="Instructions shown before students begin"
          value={exam.instructions || ""}
          onChange={(e) => onChange({ instructions: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${
              theme === "dark" ? "text-emerald-400/80" : "text-teal-700"
            }`}
          >
            Time limit
          </label>
          <p
            className={`mb-2 text-xs ${
              theme === "dark" ? "text-gray-500" : "text-gray-500"
            }`}
          >
            Click the field to select the value, then type the minutes you want.
          </p>
          <input
            type="number"
            min="1"
            className={inputClass}
            value={parseDurationValue(exam.duration_value, DEFAULT_DURATION_VALUE)}
            onFocus={(e) => e.target.select()}
            onChange={(e) =>
              onChange({
                duration_value: parseDurationValue(e.target.value, DEFAULT_DURATION_VALUE),
              })
            }
          />
        </div>
        <div>
          <label
            className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${
              theme === "dark" ? "text-emerald-400/80" : "text-teal-700"
            }`}
          >
            Unit
          </label>
          <Select
            value={exam.duration_unit || "minutes"}
            onChange={(e) => onChange({ duration_unit: e.target.value })}
          >
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
          </Select>
        </div>
      </div>

      <ToggleRow
        theme={theme}
        label="Shuffle questions"
        hint="Randomize question order for each student."
        checked={Boolean(exam.shuffle_questions)}
        onChange={(checked) => onChange({ shuffle_questions: checked })}
      />

      <ToggleRow
        theme={theme}
        label="Allow answer review"
        hint="Let students revisit questions before submitting."
        checked={exam.allow_review !== false}
        onChange={(checked) => onChange({ allow_review: checked })}
      />

      <ToggleRow
        theme={theme}
        label="Show score to students"
        hint="Students can see their score after submission on the Results page."
        checked={exam.show_result !== false}
        onChange={(checked) =>
          onChange({
            show_result: checked,
            ...(checked ? {} : { show_question_review: false, show_correct_answers: false }),
          })
        }
      />

      <ToggleRow
        theme={theme}
        label="Allow question review after submission"
        hint="When enabled, students can review each question and their answers. When off, only the score is shown."
        checked={exam.show_question_review !== false}
        disabled={exam.show_result === false}
        onChange={(checked) =>
          onChange({
            show_question_review: checked,
            ...(checked ? {} : { show_correct_answers: false }),
          })
        }
      />

      <ToggleRow
        theme={theme}
        label="Show correct answers after submission"
        hint="When enabled, students see the correct answer for each question during review. When off, they only see their own response."
        checked={exam.show_correct_answers !== false}
        disabled={exam.show_result === false || exam.show_question_review === false}
        onChange={(checked) => onChange({ show_correct_answers: checked })}
      />

      <button
        type="button"
        onClick={onPublish}
        disabled={loading}
        className={`${primaryButton(theme, "w-full justify-center px-4 py-3")} disabled:opacity-60`}
      >
        {loading ? "Saving..." : publishLabel}
      </button>
    </div>
  );
}
