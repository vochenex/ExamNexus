import { Plus, Trash2, Archive } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import { EXAM_TYPE_LABELS } from "../utils/assessmentQuestions";
import { choiceLabel, stripChoicePrefix, formatChoiceOptionLabel } from "../utils/choiceLabels";
import { getQuestionType, normalizeGradingOptions, ensureEnumAlternativesForAnswers } from "../utils/questionGrading";
import Select from "./ui/Select";

const inputClass = (theme) =>
  `w-full p-3 rounded-xl text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
    theme === "dark"
      ? "bg-white/10 text-white placeholder:text-gray-500 border border-white/10"
      : "en-bg-elevated text-gray-900 placeholder:text-gray-400 border border-emerald-200"
  }`;

const labelClass = (theme) =>
  `block text-xs font-semibold uppercase tracking-wide mb-2 ${
    theme === "dark" ? "text-emerald-400/80" : "text-teal-700"
  }`;

export function AssessmentTypeSelect({ value, onChange, hint }) {
  const { theme } = useTheme();

  return (
    <div>
      <label className={labelClass(theme)}>Question format</label>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {Object.entries(EXAM_TYPE_LABELS).map(([typeValue, label]) => (
          <option key={typeValue} value={typeValue}>
            {label}
          </option>
        ))}
      </Select>
      {hint && (
        <p
          className={`mt-2 text-xs ${
            theme === "dark" ? "text-gray-400" : "text-gray-600"
          }`}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

export default function QuestionBuilderCard({
  question,
  index,
  examType,
  showAlternatives = false,
  onUpdate,
  onUpdateChoice,
  onUpdateEnumAnswer,
  onAddEnumAnswer,
  onRemoveEnumAnswer,
  onAddAlternativeAnswer,
  onUpdateAlternativeAnswer,
  onRemoveAlternativeAnswer,
  onAddEnumSlotAlternative,
  onUpdateEnumSlotAlternative,
  onRemoveEnumSlotAlternative,
  onDelete,
  onSaveToBank,
}) {
  const { theme } = useTheme();
  const type = getQuestionType(question, examType);
  const grading = normalizeGradingOptions(question.grading);
  const enumAlternatives = ensureEnumAlternativesForAnswers(
    grading,
    question.answers?.length || 0
  );

  return (
    <div
      className={`rounded-2xl border p-4 transition ${
        theme === "dark"
          ? "bg-black/20 border-white/10 hover:border-emerald-500/20"
          : "bg-gradient-to-br from-white to-emerald-50/50 border-emerald-100 shadow-sm hover:shadow-md"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
              theme === "dark"
                ? "bg-emerald-500/15 text-emerald-300"
                : "en-bg-skeleton text-teal-800"
            }`}
          >
            Question {index + 1}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {onSaveToBank && (
            <button
              type="button"
              onClick={onSaveToBank}
              className={`rounded-lg p-2 transition ${
                theme === "dark"
                  ? "text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                  : "text-teal-700 hover:bg-emerald-100 hover:text-teal-900"
              }`}
              aria-label={`Save question ${index + 1} to bank`}
              title="Save to question bank"
            >
              <Archive size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg p-2 text-red-400 transition hover:bg-red-500/10 hover:text-red-300"
            aria-label={`Delete question ${index + 1}`}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className={labelClass(theme)}>Question</label>
          <textarea
            rows={type === "essay" ? 3 : 2}
            className={inputClass(theme)}
            placeholder="Enter the question prompt"
            value={question.question}
            onChange={(e) => onUpdate("question", e.target.value)}
          />
        </div>

        {type === "multiple_choice" && (
          <div>
            <label className={labelClass(theme)}>Choices</label>
            <div className="space-y-2">
              {question.choices.map((choice, choiceIndex) => (
                <div key={choiceIndex} className="flex items-center gap-2">
                  <span
                    className={`w-8 shrink-0 text-sm font-semibold ${
                      theme === "dark" ? "text-emerald-400" : "text-teal-700"
                    }`}
                  >
                    {choiceLabel(choiceIndex)}.
                  </span>
                  <input
                    className={inputClass(theme)}
                    placeholder={`${choiceLabel(choiceIndex)}. Answer choice`}
                    value={stripChoicePrefix(choice)}
                    onChange={(e) => onUpdateChoice(choiceIndex, e.target.value)}
                  />
                </div>
              ))}
            </div>
            <div className="mt-3">
              <label className={labelClass(theme)}>Correct answer</label>
              <Select
                value={question.answer || ""}
                onChange={(e) => onUpdate("answer", e.target.value)}
              >
                <option value="">Select correct choice</option>
                {question.choices.map((choice, choiceIndex) => (
                  <option key={choiceIndex} value={choiceLabel(choiceIndex)}>
                    {formatChoiceOptionLabel(choice, choiceIndex)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}

        {type === "enumeration" && (
          <div>
            <label className={labelClass(theme)}>Correct answers</label>
            <p
              className={`mb-3 text-xs ${
                theme === "dark" ? "text-gray-400" : "text-gray-600"
              }`}
            >
              Add one field per expected answer.
            </p>
            <div className="space-y-4">
              {question.answers.map((answer, answerIndex) => (
                <div
                  key={answerIndex}
                  className={`rounded-xl border p-3 ${
                    theme === "dark"
                      ? "border-white/10 bg-white/[0.02]"
                      : "border-emerald-100 en-bg-elevated-soft"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-8 shrink-0 text-center text-xs font-semibold ${
                        theme === "dark" ? "text-emerald-400" : "text-teal-700"
                      }`}
                    >
                      {answerIndex + 1}.
                    </span>
                    <input
                      className={inputClass(theme)}
                      placeholder={`Correct answer ${answerIndex + 1}`}
                      value={answer || ""}
                      onChange={(e) => onUpdateEnumAnswer(answerIndex, e.target.value)}
                    />
                    {question.answers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onRemoveEnumAnswer(answerIndex)}
                        className="rounded-lg p-2 text-red-400 hover:bg-red-500/10"
                        aria-label={`Remove answer ${answerIndex + 1}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  {showAlternatives && (
                    <div className="mt-3 pl-10">
                      <p
                        className={`mb-2 text-xs font-medium ${
                          theme === "dark" ? "text-gray-400" : "text-gray-600"
                        }`}
                      >
                        Alternative spellings for answer {answerIndex + 1}
                      </p>
                      <div className="space-y-2">
                        {(enumAlternatives[answerIndex] || []).map((alternative, altIndex) => (
                          <div key={altIndex} className="flex items-center gap-2">
                            <input
                              className={inputClass(theme)}
                              placeholder={`Alternative ${altIndex + 1}`}
                              value={alternative || ""}
                              onChange={(e) =>
                                onUpdateEnumSlotAlternative?.(
                                  answerIndex,
                                  altIndex,
                                  e.target.value
                                )
                              }
                            />
                            <button
                              type="button"
                              onClick={() =>
                                onRemoveEnumSlotAlternative?.(answerIndex, altIndex)
                              }
                              className="rounded-lg p-2 text-red-400 hover:bg-red-500/10"
                              aria-label={`Remove alternative ${altIndex + 1}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => onAddEnumSlotAlternative?.(answerIndex)}
                        className={`mt-2 inline-flex items-center gap-1 text-xs font-medium ${
                          theme === "dark"
                            ? "text-emerald-400 hover:text-emerald-300"
                            : "text-teal-700 hover:text-teal-900"
                        }`}
                      >
                        <Plus size={12} />
                        Add alternative
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={onAddEnumAnswer}
              className={`mt-3 inline-flex items-center gap-1 text-sm font-medium ${
                theme === "dark"
                  ? "text-emerald-400 hover:text-emerald-300"
                  : "text-teal-700 hover:text-teal-900"
              }`}
            >
              <Plus size={14} />
              Add correct answer
            </button>
          </div>
        )}

        {type === "identification" && (
          <div className="space-y-3">
            <div>
              <label className={labelClass(theme)}>Correct answer</label>
              <input
                className={inputClass(theme)}
                placeholder="Primary expected answer"
                value={question.answer || ""}
                onChange={(e) => onUpdate("answer", e.target.value)}
              />
            </div>

            {showAlternatives && (
              <div>
                <label className={labelClass(theme)}>Alternative answers</label>
                <p
                  className={`mb-2 text-xs ${
                    theme === "dark" ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Other accepted answers for this question.
                </p>
                <div className="space-y-2">
                  {grading.alternatives.map((alternative, answerIndex) => (
                    <div key={answerIndex} className="flex items-center gap-2">
                      <input
                        className={inputClass(theme)}
                        placeholder={`Alternative ${answerIndex + 1}`}
                        value={alternative || ""}
                        onChange={(e) =>
                          onUpdateAlternativeAnswer(answerIndex, e.target.value)
                        }
                      />
                      <button
                        type="button"
                        onClick={() => onRemoveAlternativeAnswer(answerIndex)}
                        className="rounded-lg p-2 text-red-400 hover:bg-red-500/10"
                        aria-label={`Remove alternative ${answerIndex + 1}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={onAddAlternativeAnswer}
                  className={`mt-2 inline-flex items-center gap-1 text-sm font-medium ${
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
          </div>
        )}

        {type === "true_false" && (
          <div>
            <label className={labelClass(theme)}>Correct answer</label>
            <Select
              value={question.answer || ""}
              onChange={(e) => onUpdate("answer", e.target.value)}
            >
              <option value="">Select True or False</option>
              <option value="true">True</option>
              <option value="false">False</option>
            </Select>
          </div>
        )}

        {type === "essay" && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              theme === "dark"
                ? "border-amber-500/20 bg-amber-500/10 text-amber-200"
                : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            Essay responses are reviewed manually by the teacher after submission.
          </div>
        )}
      </div>
    </div>
  );
}

export function assessmentPanelClass(theme) {
  return `rounded-2xl border p-5 h-fit ${
    theme === "dark"
      ? "bg-white/5 border-white/10"
      : "en-bg-elevated border-emerald-200/80 en-panel-glow"
  }`;
}

export function assessmentInputClass(theme) {
  return inputClass(theme);
}
