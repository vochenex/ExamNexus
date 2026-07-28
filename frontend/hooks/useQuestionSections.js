import { useMemo, useState, useCallback, useRef } from "react";
import { createEmptyQuestion, getQuestionValidationMessage } from "../utils/assessmentQuestions";
import {
  buildSectionsFromQuestions,
  createQuestionSection,
  getOrderedQuestions,
  inferSectionGradingDefaults,
  questionHasContent,
  resolveExamTypeForSave,
  sectionHasContent,
} from "../utils/questionSections";
import { normalizeGradingOptions, supportsGradingOptions, getQuestionType, ensureEnumAlternativesForAnswers } from "../utils/questionGrading";

function syncSectionGradingToQuestions(questions, sectionId, gradingDefaults) {
  const normalized = normalizeGradingOptions(gradingDefaults);

  return questions.map((question) => {
    if (question.sectionId !== sectionId) {
      return question;
    }

    const existing = normalizeGradingOptions(question.grading);

    return {
      ...question,
      grading: {
        ...existing,
        ...normalized,
        alternatives: normalized.accept_alternatives ? existing.alternatives : [],
        enum_alternatives: normalized.accept_alternatives
          ? ensureEnumAlternativesForAnswers(
              { ...existing, ...normalized },
              question.answers?.length || 0
            )
          : [],
      },
    };
  });
}

function enrichSectionsWithGrading(sections, questions) {
  return sections.map((section) => ({
    ...section,
    gradingDefaults: inferSectionGradingDefaults(questions, section.id),
  }));
}

export default function useQuestionSections(initialType = "multiple_choice") {
  const [questionSections, setQuestionSections] = useState(() => [
    createQuestionSection(initialType),
  ]);
  const [activeSectionId, setActiveSectionId] = useState(
    () => questionSections[0]?.id
  );
  const [questions, setQuestions] = useState([]);
  const [formatPrompt, setFormatPrompt] = useState(null);
  const sectionsRef = useRef(questionSections);

  sectionsRef.current = questionSections;

  const activeSection = useMemo(
    () =>
      questionSections.find((section) => section.id === activeSectionId) ||
      questionSections[0],
    [questionSections, activeSectionId]
  );

  const activeFormat = activeSection?.type || initialType;

  const initializeFromLoadedQuestions = useCallback((loadedQuestions, fallbackType) => {
    const cloned = loadedQuestions.map((question) => ({ ...question }));
    const sections = buildSectionsFromQuestions(cloned, fallbackType);
    const enrichedSections = enrichSectionsWithGrading(sections, cloned);
    setQuestionSections(enrichedSections);
    setActiveSectionId(enrichedSections[0]?.id);
    setQuestions(cloned);
  }, []);

  const resetForAiGeneration = useCallback(() => {
    setQuestionSections([]);
    setQuestions([]);
    setActiveSectionId(null);
    setFormatPrompt(null);
  }, []);

  const appendAiQuestion = useCallback((mappedQuestion) => {
    const type = getQuestionType(mappedQuestion, "multiple_choice");
    const question = { ...mappedQuestion, type };

    let sections = sectionsRef.current;
    let section = sections.find((item) => item.type === type);

    if (!section) {
      section = createQuestionSection(type);
      sections = [...sections, section];
      sectionsRef.current = sections;
      setQuestionSections(enrichSectionsWithGrading(sections, []));
      setActiveSectionId((current) => current || section.id);
    }

    question.sectionId = section.id;
    setQuestions((prev) => [...prev, question]);
  }, []);

  const importBankQuestions = useCallback((bankQuestions) => {
    if (!Array.isArray(bankQuestions) || bankQuestions.length === 0) return;

    let sections = [...sectionsRef.current];
    const toAdd = [];

    bankQuestions.forEach((incoming) => {
      const type = getQuestionType(incoming, incoming.type || "multiple_choice");
      let section = sections.find((item) => item.type === type);

      if (!section) {
        section = createQuestionSection(type);
        sections = [...sections, section];
      }

      const gradingDefaults = section.gradingDefaults || incoming.grading;
      const blank = createEmptyQuestion(type, section.id, gradingDefaults);

      toAdd.push({
        ...blank,
        ...incoming,
        type,
        sectionId: section.id,
        id: undefined,
        bankId: incoming.bankId,
      });
    });

    sectionsRef.current = sections;
    setQuestionSections((prev) => {
      const merged = [...prev];
      sections.forEach((section) => {
        if (!merged.some((item) => item.id === section.id)) {
          merged.push(section);
        }
      });
      return enrichSectionsWithGrading(merged, []);
    });
    setActiveSectionId((current) => current || sections[0]?.id);
    setQuestions((prev) => [...prev, ...toAdd]);
  }, []);

  const handleFormatChange = (nextType) => {
    if (nextType === activeFormat) return activeFormat;

    const existingSection = questionSections.find((section) => section.type === nextType);
    if (existingSection) {
      setActiveSectionId(existingSection.id);
      return nextType;
    }

    if (sectionHasContent(questions, activeSectionId)) {
      setFormatPrompt({ nextType, currentType: activeFormat });
      return activeFormat;
    }

    setQuestionSections((prev) =>
      prev.map((section) =>
        section.id === activeSectionId ? { ...section, type: nextType } : section
      )
    );
    return nextType;
  };

  const confirmAddFormatSection = () => {
    if (!formatPrompt?.nextType) return activeFormat;

    const newSection = createQuestionSection(formatPrompt.nextType);
    setQuestionSections((prev) => [...prev, newSection]);
    setActiveSectionId(newSection.id);
    setFormatPrompt(null);
    return formatPrompt.nextType;
  };

  const cancelFormatChange = () => {
    setFormatPrompt(null);
  };

  const addQuestionToSection = (sectionId, setError, clearError) => {
    const section =
      questionSections.find((item) => item.id === sectionId) || activeSection;

    if (!section) return null;

    const sectionQuestions = questions.filter(
      (question) => question.sectionId === section.id
    );

    if (sectionQuestions.length > 0) {
      const last = sectionQuestions[sectionQuestions.length - 1];
      const validationMessage = getQuestionValidationMessage(last, section.type);
      if (validationMessage) {
        setError(validationMessage);
        return null;
      }
    }

    clearError?.();
    setActiveSectionId(section.id);

    const newQuestion = createEmptyQuestion(
      section.type,
      section.id,
      section.gradingDefaults
    );

    setQuestions((prev) => [...prev, newQuestion]);
    return newQuestion;
  };

  const addQuestion = (setError, clearError) =>
    addQuestionToSection(activeSectionId, setError, clearError);

  const updateQuestion = (index, field, value, clearError) => {
    clearError?.();
    setQuestions((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const updateChoice = (qIndex, cIndex, value, clearError) => {
    clearError?.();
    setQuestions((prev) => {
      const updated = [...prev];
      updated[qIndex].choices[cIndex] = value;
      return updated;
    });
  };

  const updateEnumAnswer = (qIndex, aIndex, value, clearError) => {
    clearError?.();
    setQuestions((prev) => {
      const updated = [...prev];
      updated[qIndex].answers[aIndex] = value;
      return updated;
    });
  };

  const updateGrading = (index, grading, clearError) => {
    clearError?.();
    setQuestions((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], grading };
      return updated;
    });
  };

  const updateSectionGrading = (sectionId, gradingDefaults, clearError) => {
    clearError?.();
    const normalized = normalizeGradingOptions(gradingDefaults);

    setQuestionSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? { ...section, gradingDefaults: normalized }
          : section
      )
    );

    setQuestions((prev) => {
      const synced = syncSectionGradingToQuestions(prev, sectionId, normalized);

      if (!normalized.accept_alternatives) {
        return synced.map((question) =>
          question.sectionId === sectionId
            ? {
                ...question,
                grading: {
                  ...normalizeGradingOptions(question.grading),
                  alternatives: [],
                  enum_alternatives: [],
                },
              }
            : question
        );
      }

      return synced;
    });
  };

  const addEnumAnswer = (index) => {
    setQuestions((prev) =>
      prev.map((question, i) => {
        if (i !== index) return question;

        const grading = normalizeGradingOptions(question.grading);
        const enum_alternatives = ensureEnumAlternativesForAnswers(
          grading,
          question.answers.length + 1
        );

        return {
          ...question,
          answers: [...question.answers, ""],
          grading: { ...grading, enum_alternatives },
        };
      })
    );
  };

  const removeEnumAnswer = (qIndex, aIndex) => {
    setQuestions((prev) =>
      prev.map((question, i) => {
        if (i !== qIndex) return question;

        const grading = normalizeGradingOptions(question.grading);
        const enum_alternatives = ensureEnumAlternativesForAnswers(grading, question.answers.length)
          .filter((_, idx) => idx !== aIndex);

        return {
          ...question,
          answers: question.answers.filter((_, idx) => idx !== aIndex),
          grading: { ...grading, enum_alternatives },
        };
      })
    );
  };

  const addEnumSlotAlternative = (qIndex, answerIndex) => {
    setQuestions((prev) =>
      prev.map((question, i) => {
        if (i !== qIndex) return question;

        const grading = normalizeGradingOptions(question.grading);
        const enum_alternatives = ensureEnumAlternativesForAnswers(
          grading,
          question.answers.length
        );
        const slot = [...(enum_alternatives[answerIndex] || []), ""];
        enum_alternatives[answerIndex] = slot;

        return {
          ...question,
          grading: { ...grading, enum_alternatives },
        };
      })
    );
  };

  const updateEnumSlotAlternative = (qIndex, answerIndex, altIndex, value, clearError) => {
    clearError?.();
    setQuestions((prev) =>
      prev.map((question, i) => {
        if (i !== qIndex) return question;

        const grading = normalizeGradingOptions(question.grading);
        const enum_alternatives = ensureEnumAlternativesForAnswers(
          grading,
          question.answers.length
        );
        const slot = [...(enum_alternatives[answerIndex] || [])];
        slot[altIndex] = value;
        enum_alternatives[answerIndex] = slot;

        return {
          ...question,
          grading: { ...grading, enum_alternatives },
        };
      })
    );
  };

  const removeEnumSlotAlternative = (qIndex, answerIndex, altIndex) => {
    setQuestions((prev) =>
      prev.map((question, i) => {
        if (i !== qIndex) return question;

        const grading = normalizeGradingOptions(question.grading);
        const enum_alternatives = ensureEnumAlternativesForAnswers(
          grading,
          question.answers.length
        );
        enum_alternatives[answerIndex] = (enum_alternatives[answerIndex] || []).filter(
          (_, idx) => idx !== altIndex
        );

        return {
          ...question,
          grading: { ...grading, enum_alternatives },
        };
      })
    );
  };

  const addAlternativeAnswer = (index) => {
    setQuestions((prev) =>
      prev.map((question, i) => {
        if (i !== index) return question;

        const grading = normalizeGradingOptions(question.grading);
        return {
          ...question,
          grading: {
            ...grading,
            alternatives: [...grading.alternatives, ""],
          },
        };
      })
    );
  };

  const updateAlternativeAnswer = (qIndex, aIndex, value, clearError) => {
    clearError?.();
    setQuestions((prev) =>
      prev.map((question, i) => {
        if (i !== qIndex) return question;

        const grading = normalizeGradingOptions(question.grading);
        const alternatives = [...grading.alternatives];
        alternatives[aIndex] = value;

        return {
          ...question,
          grading: { ...grading, alternatives },
        };
      })
    );
  };

  const removeAlternativeAnswer = (qIndex, aIndex) => {
    setQuestions((prev) =>
      prev.map((question, i) => {
        if (i !== qIndex) return question;

        const grading = normalizeGradingOptions(question.grading);
        return {
          ...question,
          grading: {
            ...grading,
            alternatives: grading.alternatives.filter((_, idx) => idx !== aIndex),
          },
        };
      })
    );
  };

  const deleteQuestion = (index) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const validateAllQuestions = () => {
    const ordered = getOrderedQuestions(questions, questionSections);

    for (let i = 0; i < ordered.length; i++) {
      const validationMessage = getQuestionValidationMessage(ordered[i]);
      if (validationMessage) {
        return `Question ${i + 1}: ${validationMessage}`;
      }
    }

    return null;
  };

  const getQuestionsForSave = () => getOrderedQuestions(questions, questionSections);

  const getExamTypeForSave = () => resolveExamTypeForSave(questionSections);

  const gradingSections = useMemo(
    () => questionSections.filter((section) => supportsGradingOptions(section.type)),
    [questionSections]
  );

  return {
    questionSections,
    activeSectionId,
    activeFormat,
    questions,
    formatPrompt,
    gradingSections,
    setActiveSectionId,
    initializeFromLoadedQuestions,
    resetForAiGeneration,
    appendAiQuestion,
    importBankQuestions,
    handleFormatChange,
    confirmAddFormatSection,
    cancelFormatChange,
    addQuestion,
    addQuestionToSection,
    updateQuestion,
    updateChoice,
    updateEnumAnswer,
    updateGrading,
    updateSectionGrading,
    addEnumAnswer,
    removeEnumAnswer,
    addEnumSlotAlternative,
    updateEnumSlotAlternative,
    removeEnumSlotAlternative,
    addAlternativeAnswer,
    updateAlternativeAnswer,
    removeAlternativeAnswer,
    deleteQuestion,
    validateAllQuestions,
    getQuestionsForSave,
    getExamTypeForSave,
    questionHasContent,
  };
}
