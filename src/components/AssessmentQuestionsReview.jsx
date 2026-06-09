import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import { formatQuestionCorrectAnswers } from "../utils/assessmentQuestions";
import { getFormatLabel } from "../utils/questionSections";
import { groupQuestionsForNavigation } from "../utils/assessmentTake";

function QuestionReviewCard({ question, number, examType, theme }) {
  const questionType = question.question_type || examType;
  const correctAnswers = formatQuestionCorrectAnswers(question, examType);

  return (
    <div
      className={`rounded-xl border p-4 ${
        theme === "dark"
          ? "border-white/10 bg-black/20"
          : "border-emerald-100 en-bg-elevated"
      }`}
    >
      <p className="font-semibold text-sm leading-relaxed">
        {number}. {question.question || "No question text"}
      </p>

      {questionType === "multiple_choice" && (
        <div
          className={`mt-3 space-y-1 text-sm ${
            theme === "dark" ? "text-gray-300" : "text-gray-700"
          }`}
        >
          {question.option_a && <p>A. {question.option_a}</p>}
          {question.option_b && <p>B. {question.option_b}</p>}
          {question.option_c && <p>C. {question.option_c}</p>}
          {question.option_d && <p>D. {question.option_d}</p>}
        </div>
      )}

      {questionType === "essay" ? (
        <p
          className={`mt-3 text-sm ${
            theme === "dark" ? "text-amber-300" : "text-amber-700"
          }`}
        >
          Manual review — no auto-graded answer
        </p>
      ) : (
        <div className="mt-3">
          <p
            className={`text-xs font-semibold uppercase tracking-wide ${
              theme === "dark" ? "text-emerald-400" : "text-teal-700"
            }`}
          >
            Correct answer{correctAnswers.length === 1 ? "" : "s"}
          </p>
          {correctAnswers.length === 0 ? (
            <p className={`mt-1 text-sm ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
              Not set
            </p>
          ) : (
            <ul
              className={`mt-1 space-y-1 text-sm ${
                theme === "dark" ? "text-emerald-300" : "text-teal-800"
              }`}
            >
              {correctAnswers.map((answer, index) => (
                <li key={index}>
                  {correctAnswers.length > 1 ? `${index + 1}. ` : ""}
                  {answer}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function AssessmentQuestionsReview({ questions, examType }) {
  const { theme } = useTheme();
  const groups = groupQuestionsForNavigation(questions, examType);
  const [expanded, setExpanded] = useState(() => new Set(groups.map((group) => group.type)));

  const toggleGroup = (type) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  if (!questions.length) {
    return (
      <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
        No questions found.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const isOpen = expanded.has(group.type);
        const start = group.items[0]?.number;
        const end = group.items[group.items.length - 1]?.number;
        const rangeLabel = start === end ? `${start}` : `${start}–${end}`;

        return (
          <div
            key={group.type}
            className={`rounded-2xl border overflow-hidden ${
              theme === "dark"
                ? "border-white/10 bg-white/[0.03]"
                : "border-emerald-200/80 en-bg-elevated shadow-sm"
            }`}
          >
            <button
              type="button"
              onClick={() => toggleGroup(group.type)}
              className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left ${
                theme === "dark" ? "hover:bg-white/5" : "en-hover"
              }`}
            >
              <div>
                <p
                  className={`text-sm font-semibold ${
                    theme === "dark" ? "text-emerald-300" : "text-teal-800"
                  }`}
                >
                  {getFormatLabel(group.type)}
                </p>
                <p
                  className={`text-xs mt-0.5 ${
                    theme === "dark" ? "text-gray-500" : "text-gray-500"
                  }`}
                >
                  Items {rangeLabel} · {group.items.length} question
                  {group.items.length === 1 ? "" : "s"}
                </p>
              </div>
              {isOpen ? (
                <ChevronUp size={18} className={theme === "dark" ? "text-gray-400" : "text-gray-600"} />
              ) : (
                <ChevronDown size={18} className={theme === "dark" ? "text-gray-400" : "text-gray-600"} />
              )}
            </button>

            {isOpen && (
              <div className="space-y-3 border-t px-4 py-4 border-inherit">
                {group.items.map((item) => {
                  const question = questions[item.index];
                  if (!question) return null;

                  return (
                    <QuestionReviewCard
                      key={question.id || item.index}
                      question={question}
                      number={item.number}
                      examType={examType}
                      theme={theme}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
