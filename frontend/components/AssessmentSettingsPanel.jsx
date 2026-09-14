import ProgressButton from "./ui/ProgressButton";
import ToggleOptionRow from "./ui/ToggleOptionRow";
import { primaryButton } from "../utils/themeButtons";
import {
  formatDurationInputValue,
  parseDurationInput,
} from "../utils/assessmentDuration";
import Select from "./ui/Select";

export default function AssessmentSettingsPanel({
  exam,
  onChange,
  loading,
  onPublish,
  publishLabel,
  theme,
  durationError = "",
}) {
  const inputClass = `w-full p-3 rounded-xl text-sm ${
    theme === "dark"
      ? "bg-white/10 text-white border border-white/10"
      : "en-bg-elevated text-gray-900 border border-emerald-200"
  }`;

  const durationInputClass = durationError
    ? `${inputClass} ${
        theme === "dark"
          ? "!border-red-400/70 ring-1 ring-red-400/40"
          : "!border-red-400 ring-1 ring-red-300/70"
      }`
    : inputClass;

  return (
    <div className="space-y-4">
      <div>
        <label
          className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${
            theme === "dark" ? "text-emerald-400/80" : "text-teal-700"
          }`}
        >
          Passing rate (%)
        </label>
        <input
          type="number"
          min="0"
          max="100"
          step="1"
          className={inputClass}
          value={
            Number.isFinite(Number(exam.pass_mark)) ? Number(exam.pass_mark) : 50
          }
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const raw = Number.parseFloat(e.target.value);
            const next = Number.isFinite(raw)
              ? Math.min(100, Math.max(0, Math.round(raw * 10) / 10))
              : 50;
            onChange({ pass_mark: next });
          }}
        />
        <p className={`mt-1.5 text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-600"}`}>
          Required for grading. Students at or above this percentage are marked as Passed in results and exports.
        </p>
      </div>

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
        <div id="assessment-duration-field">
          <label
            htmlFor="assessment-duration-value"
            className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${
              theme === "dark" ? "text-emerald-400/80" : "text-teal-700"
            }`}
          >
            Time limit <span className="normal-case text-red-400">*</span>
          </label>
          <input
            id="assessment-duration-value"
            type="number"
            min="1"
            inputMode="numeric"
            placeholder="e.g. 60"
            className={durationInputClass}
            value={formatDurationInputValue(exam.duration_value)}
            aria-invalid={Boolean(durationError)}
            aria-describedby={durationError ? "assessment-duration-error" : undefined}
            onChange={(e) =>
              onChange({
                duration_value: parseDurationInput(e.target.value),
              })
            }
          />
          {durationError ? (
            <p
              id="assessment-duration-error"
              className={`mt-1.5 text-xs font-medium ${
                theme === "dark" ? "text-red-300" : "text-red-600"
              }`}
            >
              {durationError}
            </p>
          ) : (
            <p className={`mt-1.5 text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-600"}`}>
              Required before publishing.
            </p>
          )}
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

      <ToggleOptionRow
        theme={theme}
        label="Shuffle questions"
        hint="Randomize question order for each student."
        checked={Boolean(exam.shuffle_questions)}
        onChange={(checked) => onChange({ shuffle_questions: checked })}
      />

      <ToggleOptionRow
        theme={theme}
        label="Lock finished sections"
        hint="When a student finishes a section (e.g. Multiple Choice) and moves to the next (e.g. Enumeration), they cannot go back to change earlier answers."
        checked={Boolean(exam.lock_completed_sections)}
        onChange={(checked) => onChange({ lock_completed_sections: checked })}
      />

      <ToggleOptionRow
        theme={theme}
        label="Allow answer review"
        hint="Let students revisit questions before submitting (within unlocked sections)."
        checked={Boolean(exam.allow_review)}
        onChange={(checked) => onChange({ allow_review: checked })}
      />

      <ToggleOptionRow
        theme={theme}
        label="Show score to students"
        hint="Students can see their score after submission on the Results page."
        checked={Boolean(exam.show_result)}
        onChange={(checked) =>
          onChange({
            show_result: checked,
            ...(checked ? {} : { show_question_review: false }),
          })
        }
      />

      <ToggleOptionRow
        theme={theme}
        label="Allow question review after submission"
        hint="When enabled, students can review each question and their answers. When off, only the score is shown."
        checked={Boolean(exam.show_question_review)}
        disabled={!exam.show_result}
        onChange={(checked) => onChange({ show_question_review: checked })}
      />

      <ToggleOptionRow
        theme={theme}
        label="Show correct answers after submission"
        hint="Independent preference. Students only see correct answers when score and question review are also enabled."
        checked={Boolean(exam.show_correct_answers)}
        onChange={(checked) => onChange({ show_correct_answers: checked })}
      />

      <ProgressButton
        type="button"
        onClick={onPublish}
        loading={loading}
        loadingLabel="Saving..."
        className={`${primaryButton(theme, "w-full justify-center px-4 py-3")} disabled:opacity-60`}
      >
        {publishLabel}
      </ProgressButton>
    </div>
  );
}
