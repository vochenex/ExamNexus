import { useTheme } from "../layouts/ThemeContext";
import { getExpectedEnumerationAnswers } from "../utils/assessmentQuestions";
import { getQuestionType } from "../utils/questionGrading";
import { blockClipboardEvent } from "../utils/examIntegrity";

const inputClass = (theme) =>
  `w-full p-3 rounded-xl text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
    theme === "dark"
      ? "bg-white/10 text-white placeholder:text-gray-500 border border-white/10"
      : "en-bg-elevated text-gray-900 placeholder:text-gray-400 border border-emerald-200"
  }`;

const clipboardProps = {
  onCopy: blockClipboardEvent,
  onPaste: blockClipboardEvent,
  onCut: blockClipboardEvent,
  onDrop: blockClipboardEvent,
  onContextMenu: blockClipboardEvent,
  autoComplete: "off",
  spellCheck: false,
};

export default function AssessmentQuestionInput({
  question,
  examType,
  value,
  onChange,
}) {
  const { theme } = useTheme();
  const questionType = getQuestionType(question, examType);

  if (questionType === "multiple_choice") {
    return (
      <div className="grid gap-3">
        {["A", "B", "C", "D"].map((letter) => {
          const option = question[`option_${letter.toLowerCase()}`];
          if (!option) return null;

          const selected = value === letter;

          return (
            <button
              key={letter}
              type="button"
              onClick={() => onChange(letter)}
              className={`rounded-xl border p-4 text-left transition ${
                selected
                  ? theme === "dark"
                    ? "border-emerald-400 bg-emerald-500/20 text-white"
                    : "border-teal-500 bg-teal-50 text-teal-900"
                  : theme === "dark"
                    ? "border-white/10 bg-white/5 hover:bg-white/10"
                    : "border-emerald-200/80 en-bg-elevated hover:border-emerald-300"
              }`}
            >
              <span className="mr-3 font-bold">{letter}.</span>
              {option}
            </button>
          );
        })}
      </div>
    );
  }

  if (questionType === "true_false") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { label: "True", value: "true" },
          { label: "False", value: "false" },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-xl border p-4 text-center font-semibold transition ${
              value === option.value
                ? theme === "dark"
                  ? "border-emerald-400 bg-emerald-500/20 text-white"
                  : "border-teal-500 bg-teal-50 text-teal-900"
                : theme === "dark"
                  ? "border-white/10 bg-white/5 hover:bg-white/10"
                  : "border-emerald-200/80 en-bg-elevated hover:border-emerald-300"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    );
  }

  if (questionType === "enumeration") {
    const expectedCount = getExpectedEnumerationAnswers(question).length || 1;
    const answers = Array.isArray(value) ? value : Array(expectedCount).fill("");

    const updateAnswer = (index, nextValue) => {
      const next = [...answers];
      while (next.length < expectedCount) next.push("");
      next[index] = nextValue;
      onChange(next);
    };

    return (
      <div className="space-y-3">
        <p
          className={`text-sm ${
            theme === "dark" ? "text-gray-400" : "text-gray-600"
          }`}
        >
          Provide {expectedCount} answer{expectedCount === 1 ? "" : "s"} in order.
        </p>
        {Array.from({ length: expectedCount }).map((_, index) => (
          <div key={index} className="flex items-center gap-3">
            <span
              className={`w-8 shrink-0 text-sm font-semibold ${
                theme === "dark" ? "text-emerald-400" : "text-teal-700"
              }`}
            >
              {index + 1}.
            </span>
            <input
              className={inputClass(theme)}
              placeholder={`Answer ${index + 1}`}
              value={answers[index] || ""}
              onChange={(e) => updateAnswer(index, e.target.value)}
              {...clipboardProps}
            />
          </div>
        ))}
      </div>
    );
  }

  if (questionType === "essay") {
    return (
      <div>
        <textarea
          rows={8}
          className={inputClass(theme)}
          placeholder="Write your response here..."
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          {...clipboardProps}
        />
        <p
          className={`mt-2 text-xs ${
            theme === "dark" ? "text-amber-300/80" : "text-amber-700"
          }`}
        >
          Essay answers are reviewed manually by your teacher after submission.
        </p>
      </div>
    );
  }

  return (
    <input
      className={inputClass(theme)}
      placeholder="Type your answer"
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      {...clipboardProps}
    />
  );
}
