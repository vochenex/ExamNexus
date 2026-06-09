import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import QuestionBuilderCard from "./QuestionBuilderCard";
import { getFormatLabel } from "../utils/questionSections";
import { normalizeGradingOptions } from "../utils/questionGrading";

function questionPreview(question) {
  const text = String(question.question || "").trim();
  if (!text) return "Untitled question";
  return text.length > 48 ? `${text.slice(0, 48)}…` : text;
}

export default function QuestionSectionsPanel({
  questionSections,
  activeSectionId,
  questions,
  onAddQuestionToSection,
  onUpdateQuestion,
  onUpdateChoice,
  onUpdateEnumAnswer,
  onAddEnumAnswer,
  onRemoveEnumAnswer,
  onAddAlternativeAnswer,
  onUpdateAlternativeAnswer,
  onRemoveAlternativeAnswer,
  onDeleteQuestion,
  onSelectSection,
}) {
  const { theme } = useTheme();
  const [expandedSections, setExpandedSections] = useState(() => new Set());
  const [expandedQuestions, setExpandedQuestions] = useState(() => new Set());
  const scrollTargetRef = useRef(null);

  useEffect(() => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      questionSections.forEach((section) => {
        if (section.id === activeSectionId) {
          next.add(section.id);
        }
      });
      if (next.size === 0 && questionSections[0]?.id) {
        next.add(questionSections[0].id);
      }
      return next;
    });
  }, [activeSectionId, questionSections]);

  useEffect(() => {
    if (questions.length === 0) return;

    setExpandedQuestions((prev) => {
      if (prev.size > 0) return prev;

      const next = new Set();
      questionSections.forEach((section) => {
        const sectionQuestions = questions.filter(
          (question) => question.sectionId === section.id
        );
        if (sectionQuestions.length > 0) {
          next.add(`${section.id}-0`);
        }
      });
      return next;
    });
  }, [questions.length, questionSections, questions]);

  useEffect(() => {
    scrollTargetRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [questions.length]);

  const toggleSection = (sectionId) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
    onSelectSection(sectionId);
  };

  const toggleQuestion = (key) => {
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleAddQuestion = (sectionId) => {
    onSelectSection(sectionId);
    setExpandedSections((prev) => new Set(prev).add(sectionId));

    const sectionQuestions = questions.filter((question) => question.sectionId === sectionId);
    const newKey = `${sectionId}-${sectionQuestions.length}`;
    setExpandedQuestions((prev) => new Set(prev).add(newKey));

    onAddQuestionToSection(sectionId);
  };

  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="font-semibold">Questions ({questions.length})</h2>
        {questionSections.length > 1 && (
          <p className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
            {questionSections.length} format sections
          </p>
        )}
      </div>

      {questions.length === 0 && questionSections.length === 1 ? (
        <div
          className={`rounded-2xl border border-dashed p-8 text-center ${
            theme === "dark"
              ? "border-white/10 text-gray-400"
              : "border-emerald-200 text-gray-500"
          }`}
        >
          <p className="text-sm mb-4">
            No questions yet. Add your first{" "}
            {getFormatLabel(questionSections[0]?.type).toLowerCase()} question.
          </p>
          <button
            type="button"
            onClick={() => handleAddQuestion(questionSections[0]?.id)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${
              theme === "dark"
                ? "bg-emerald-500 text-black hover:bg-emerald-400"
                : "bg-emerald-500 text-white hover:bg-emerald-600"
            }`}
          >
            <Plus size={16} />
            Add question
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {questionSections.map((section) => {
            const sectionQuestions = questions.filter(
              (question) => question.sectionId === section.id
            );
            const isExpanded = expandedSections.has(section.id);
            const isActive = section.id === activeSectionId;
            const sectionGrading = normalizeGradingOptions(section.gradingDefaults);

            return (
              <div
                key={section.id}
                className={`rounded-2xl border overflow-hidden ${
                  isActive
                    ? theme === "dark"
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-emerald-300 bg-emerald-50/40"
                    : theme === "dark"
                      ? "border-white/10 bg-black/10"
                      : "border-emerald-100 en-bg-elevated"
                }`}
              >
                <div
                  className={`flex items-center gap-2 px-4 py-3 ${
                    theme === "dark" ? "border-white/10" : "border-emerald-100"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    {isExpanded ? (
                      <ChevronUp
                        size={18}
                        className={theme === "dark" ? "text-emerald-400" : "text-teal-700"}
                      />
                    ) : (
                      <ChevronDown
                        size={18}
                        className={theme === "dark" ? "text-gray-400" : "text-gray-500"}
                      />
                    )}
                    <div className="min-w-0">
                      <h3
                        className={`text-sm font-semibold ${
                          theme === "dark" ? "text-emerald-300" : "text-teal-800"
                        }`}
                      >
                        {getFormatLabel(section.type)}
                      </h3>
                      <p
                        className={`text-xs mt-0.5 ${
                          theme === "dark" ? "text-gray-400" : "text-gray-600"
                        }`}
                      >
                        {sectionQuestions.length} question
                        {sectionQuestions.length === 1 ? "" : "s"}
                        {isActive ? " · active" : ""}
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddQuestion(section.id)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                      theme === "dark"
                        ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                        : "en-bg-skeleton text-teal-800 hover:bg-emerald-200"
                    }`}
                  >
                    <Plus size={14} />
                    Add
                  </button>
                </div>

                {isExpanded && (
                  <div className="space-y-3 border-t px-4 py-4 border-inherit">
                    {sectionQuestions.length === 0 && (
                      <p
                        className={`rounded-xl border border-dashed p-4 text-sm text-center ${
                          theme === "dark"
                            ? "border-white/10 text-gray-400"
                            : "border-emerald-200 text-gray-500"
                        }`}
                      >
                        No questions in this section yet. Click Add above.
                      </p>
                    )}

                    {sectionQuestions.map((question, localIndex) => {
                      const globalIndex = questions.findIndex((item) => item === question);
                      const questionKey = `${section.id}-${localIndex}`;
                      const isQuestionExpanded =
                        expandedQuestions.has(questionKey) ||
                        (sectionQuestions.length === 1 && expandedQuestions.size === 0);

                      const isLastInSection = localIndex === sectionQuestions.length - 1;
                      const shouldScroll = isLastInSection;
                      const showAlternatives =
                        section.type === "identification" &&
                        sectionGrading.accept_alternatives;

                      return (
                        <div
                          key={question.id || questionKey}
                          ref={shouldScroll ? scrollTargetRef : null}
                          className={`rounded-xl border ${
                            theme === "dark"
                              ? "border-white/10 bg-black/20"
                              : "border-emerald-100 en-bg-elevated"
                          }`}
                        >
                          {!isQuestionExpanded ? (
                            <button
                              type="button"
                              onClick={() => toggleQuestion(questionKey)}
                              className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left ${
                                theme === "dark" ? "text-gray-200" : "text-gray-800"
                              }`}
                            >
                              <span className="min-w-0 truncate text-sm">
                                <span
                                  className={`mr-2 font-semibold ${
                                    theme === "dark" ? "text-emerald-400" : "text-teal-700"
                                  }`}
                                >
                                  Q{localIndex + 1}
                                </span>
                                {questionPreview(question)}
                              </span>
                              <ChevronDown size={16} className="shrink-0 opacity-60" />
                            </button>
                          ) : (
                            <div className="p-1">
                              <button
                                type="button"
                                onClick={() => toggleQuestion(questionKey)}
                                className={`mb-1 flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium ${
                                  theme === "dark" ? "text-gray-400" : "text-gray-500"
                                }`}
                              >
                                Collapse question
                                <ChevronUp size={14} />
                              </button>
                              <QuestionBuilderCard
                                question={question}
                                index={localIndex}
                                examType={section.type}
                                showAlternatives={showAlternatives}
                                onUpdate={(field, value) =>
                                  onUpdateQuestion(globalIndex, field, value)
                                }
                                onUpdateChoice={(choiceIndex, value) =>
                                  onUpdateChoice(globalIndex, choiceIndex, value)
                                }
                                onUpdateEnumAnswer={(answerIndex, value) =>
                                  onUpdateEnumAnswer(globalIndex, answerIndex, value)
                                }
                                onAddEnumAnswer={() => onAddEnumAnswer(globalIndex)}
                                onRemoveEnumAnswer={(answerIndex) =>
                                  onRemoveEnumAnswer(globalIndex, answerIndex)
                                }
                                onAddAlternativeAnswer={() =>
                                  onAddAlternativeAnswer(globalIndex)
                                }
                                onUpdateAlternativeAnswer={(answerIndex, value) =>
                                  onUpdateAlternativeAnswer(globalIndex, answerIndex, value)
                                }
                                onRemoveAlternativeAnswer={(answerIndex) =>
                                  onRemoveAlternativeAnswer(globalIndex, answerIndex)
                                }
                                onDelete={() => onDeleteQuestion(globalIndex)}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
