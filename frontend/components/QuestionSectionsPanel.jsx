import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Download } from "lucide-react";
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
  fieldErrorsByIndex = {},
  onAddQuestionToSection,
  onUpdateQuestion,
  onUpdateChoice,
  onUpdateEnumAnswer,
  onAddEnumAnswer,
  onRemoveEnumAnswer,
  onAddEnumSlotAlternative,
  onUpdateEnumSlotAlternative,
  onRemoveEnumSlotAlternative,
  onAddAlternativeAnswer,
  onUpdateAlternativeAnswer,
  onRemoveAlternativeAnswer,
  onDeleteQuestion,
  onSelectSection,
  onSaveQuestionToBank,
  savingToBankId = null,
  onImportFromBank,
  /** Bump after AI generation completes to collapse all format sections + questions. */
  collapseAllToken = 0,
}) {
  const { theme } = useTheme();
  const [expandedSections, setExpandedSections] = useState(() => new Set());
  const [expandedQuestions, setExpandedQuestions] = useState(() => new Set());
  const scrollTargetRef = useRef(null);
  const previousQuestionCountRef = useRef(0);
  const suppressAutoExpandRef = useRef(false);

  useEffect(() => {
    if (!collapseAllToken) return;
    suppressAutoExpandRef.current = true;
    setExpandedSections(new Set());
    setExpandedQuestions(new Set());
  }, [collapseAllToken]);

  useEffect(() => {
    if (suppressAutoExpandRef.current) return;
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
    if (suppressAutoExpandRef.current) {
      previousQuestionCountRef.current = questions.length;
      return;
    }

    if (questions.length > previousQuestionCountRef.current) {
      const lastQuestion = questions[questions.length - 1];
      if (lastQuestion?.sectionId) {
        const sectionIndex = questions.filter(
          (question) => question.sectionId === lastQuestion.sectionId
        ).length - 1;
        const key = `${lastQuestion.sectionId}-${sectionIndex}`;

        setExpandedSections((prev) => new Set(prev).add(lastQuestion.sectionId));
        setExpandedQuestions((prev) => new Set(prev).add(key));
      }
    }

    previousQuestionCountRef.current = questions.length;
  }, [questions]);

  useEffect(() => {
    if (questions.length === 0) return;
    if (suppressAutoExpandRef.current) return;

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
    const invalidIndexes = Object.keys(fieldErrorsByIndex)
      .map(Number)
      .filter((index) => Array.isArray(fieldErrorsByIndex[index]) && fieldErrorsByIndex[index].length > 0);

    if (invalidIndexes.length === 0) return;

    suppressAutoExpandRef.current = false;
    setExpandedSections((prev) => {
      const next = new Set(prev);
      invalidIndexes.forEach((globalIndex) => {
        const question = questions[globalIndex];
        if (question?.sectionId) next.add(question.sectionId);
      });
      return next;
    });

    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      invalidIndexes.forEach((globalIndex) => {
        const question = questions[globalIndex];
        if (!question?.sectionId) return;
        const localIndex = questions
          .filter((item) => item.sectionId === question.sectionId)
          .findIndex((item) => item === question);
        if (localIndex >= 0) {
          next.add(`${question.sectionId}-${localIndex}`);
        }
      });
      return next;
    });

    requestAnimationFrame(() => {
      scrollTargetRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [fieldErrorsByIndex, questions]);

  const toggleSection = (sectionId) => {
    suppressAutoExpandRef.current = false;
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
    suppressAutoExpandRef.current = false;
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
    suppressAutoExpandRef.current = false;
    onSelectSection(sectionId);
    setExpandedSections((prev) => new Set(prev).add(sectionId));

    const sectionQuestions = questions.filter((question) => question.sectionId === sectionId);
    const newKey = `${sectionId}-${sectionQuestions.length}`;
    setExpandedQuestions((prev) => new Set(prev).add(newKey));

    onAddQuestionToSection(sectionId);

    requestAnimationFrame(() => {
      scrollTargetRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p
            className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${
              theme === "dark" ? "text-emerald-400/80" : "text-teal-700/80"
            }`}
          >
            Question hierarchy
          </p>
          <h2 className="mt-0.5 font-semibold">
            Formats → Questions ({questions.length})
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onImportFromBank && (
            <button
              type="button"
              onClick={onImportFromBank}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                theme === "dark"
                  ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                  : "en-bg-skeleton text-teal-800 hover:bg-emerald-200"
              }`}
            >
              <Download size={14} />
              Import from bank
            </button>
          )}
          {questionSections.length > 1 && (
            <p className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
              {questionSections.length} format sections
            </p>
          )}
        </div>
      </div>

      {questions.length === 0 && questionSections.length === 0 ? (
        <div
          className={`rounded-2xl border border-dashed p-8 text-center ${
            theme === "dark"
              ? "border-white/10 text-gray-400"
              : "border-emerald-200 text-gray-500"
          }`}
        >
          <p className="text-sm">
            Questions will appear here, grouped by format, as each one is generated.
          </p>
        </div>
      ) : questions.length === 0 && questionSections.length === 1 ? (
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
        <div className="space-y-5">
          {questionSections.map((section, sectionOrder) => {
            const sectionQuestions = questions.filter(
              (question) => question.sectionId === section.id
            );
            const isExpanded = expandedSections.has(section.id);
            const isActive = section.id === activeSectionId;
            const sectionGrading = normalizeGradingOptions(section.gradingDefaults);

            return (
              <div
                key={section.id}
                className={`overflow-hidden rounded-2xl border-2 shadow-sm ${
                  isActive
                    ? theme === "dark"
                      ? "border-emerald-400/45 bg-emerald-500/10"
                      : "border-teal-400/70 bg-emerald-50/70"
                    : theme === "dark"
                      ? "border-emerald-500/20 bg-[#071614]/80"
                      : "border-emerald-200 bg-white"
                }`}
              >
                <div
                  className={`flex items-center gap-2 border-b px-4 py-3.5 ${
                    theme === "dark"
                      ? "border-emerald-500/15 bg-emerald-500/10"
                      : "border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50/80"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span
                      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                        theme === "dark"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-teal-700 text-white"
                      }`}
                    >
                      {sectionOrder + 1}
                    </span>
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
                      <p
                        className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${
                          theme === "dark" ? "text-emerald-400/70" : "text-teal-700/70"
                        }`}
                      >
                        Format section
                      </p>
                      <h3
                        className={`text-base font-bold ${
                          theme === "dark" ? "text-emerald-200" : "text-teal-900"
                        }`}
                      >
                        {getFormatLabel(section.type)}
                      </h3>
                      <p
                        className={`mt-0.5 text-xs ${
                          theme === "dark" ? "text-gray-400" : "text-gray-600"
                        }`}
                      >
                        {sectionQuestions.length} question
                        {sectionQuestions.length === 1 ? "" : "s"}
                        {isExpanded ? "" : " · collapsed"}
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
                  <div
                    className={`space-y-2 border-l-4 py-3 pl-3 pr-3 sm:pl-4 ${
                      theme === "dark"
                        ? "border-emerald-500/35 bg-black/20"
                        : "border-teal-300/80 bg-emerald-50/30"
                    }`}
                  >
                    <p
                      className={`px-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                        theme === "dark" ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Questions in this format
                    </p>
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
                      const questionFieldErrors = fieldErrorsByIndex[globalIndex] || [];
                      const hasFieldErrors = questionFieldErrors.length > 0;
                      const isQuestionExpanded =
                        hasFieldErrors || expandedQuestions.has(questionKey);

                      const shouldScroll = hasFieldErrors;
                      const showAlternatives =
                        (section.type === "identification" ||
                          section.type === "enumeration") &&
                        sectionGrading.accept_alternatives;

                      return (
                        <div
                          key={question.id || questionKey}
                          ref={shouldScroll ? scrollTargetRef : null}
                          className={`ml-1 rounded-xl border sm:ml-2 ${
                            theme === "dark"
                              ? "border-white/10 bg-[#0a1211]"
                              : "border-emerald-100 bg-white shadow-sm"
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
                                  className={`mr-2 inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
                                    theme === "dark"
                                      ? "bg-emerald-500/15 text-emerald-300"
                                      : "bg-teal-100 text-teal-800"
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
                                  theme === "dark" ? "text-emerald-300" : "text-teal-800"
                                }`}
                              >
                                <span>Collapse Q{localIndex + 1}</span>
                                <ChevronUp size={14} />
                              </button>
                              <QuestionBuilderCard
                                question={question}
                                index={localIndex}
                                examType={section.type}
                                showAlternatives={showAlternatives}
                                invalidFields={questionFieldErrors}
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
                                onAddEnumSlotAlternative={(answerIndex) =>
                                  onAddEnumSlotAlternative?.(globalIndex, answerIndex)
                                }
                                onUpdateEnumSlotAlternative={(answerIndex, altIndex, value) =>
                                  onUpdateEnumSlotAlternative?.(
                                    globalIndex,
                                    answerIndex,
                                    altIndex,
                                    value
                                  )
                                }
                                onRemoveEnumSlotAlternative={(answerIndex, altIndex) =>
                                  onRemoveEnumSlotAlternative?.(
                                    globalIndex,
                                    answerIndex,
                                    altIndex
                                  )
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
                                onSaveToBank={
                                  onSaveQuestionToBank
                                    ? () => onSaveQuestionToBank(question)
                                    : undefined
                                }
                                savingToBank={
                                  Boolean(
                                    savingToBankId &&
                                      (savingToBankId === question.id ||
                                        savingToBankId === question._clientId ||
                                        savingToBankId === globalIndex)
                                  )
                                }
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
