import ProgressButton from "./ui/ProgressButton";
import ToggleOptionRow from "./ui/ToggleOptionRow";
import { primaryButton } from "../utils/themeButtons";
import { DEFAULT_DURATION_VALUE, parseDurationValue } from "../utils/assessmentDuration";
import Select from "./ui/Select";

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

      <ToggleOptionRow
        theme={theme}
        label="Shuffle questions"
        hint="Randomize question order for each student. Also locks finished sections so students cannot jump back after moving on."
        checked={Boolean(exam.shuffle_questions)}
        onChange={(checked) =>
          onChange({
            shuffle_questions: checked,
            ...(checked ? { lock_completed_sections: true } : {}),
          })
        }
      />

      <ToggleOptionRow
        theme={theme}
        label="Lock finished sections"
        hint="When a student finishes a section (e.g. Multiple Choice) and moves to the next (e.g. Enumeration), they cannot go back to change earlier answers."
        checked={
          Boolean(exam.lock_completed_sections) || Boolean(exam.shuffle_questions)
        }
        disabled={Boolean(exam.shuffle_questions)}
        onChange={(checked) => onChange({ lock_completed_sections: checked })}
      />

      <ToggleOptionRow
        theme={theme}
        label="Allow answer review"
        hint="Let students revisit questions before submitting (within unlocked sections)."
        checked={exam.allow_review !== false}
        onChange={(checked) => onChange({ allow_review: checked })}
      />

      <ToggleOptionRow
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

      <ToggleOptionRow
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

      <ToggleOptionRow
        theme={theme}
        label="Show correct answers after submission"
        hint="When enabled, students see the correct answer for each question during review. When off, they only see their own response."
        checked={exam.show_correct_answers !== false}
        disabled={exam.show_result === false || exam.show_question_review === false}
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
