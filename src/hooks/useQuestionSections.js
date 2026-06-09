import { useMemo, useState, useCallback } from "react";
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
import { normalizeGradingOptions, supportsGradingOptions } from "../utils/questionGrading";

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
        ...normalized,
        alternatives: normalized.accept_alternatives ? existing.alternatives : [],
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
      prev.map((question, i) =>
        i === index ? { ...question, answers: [...question.answers, ""] } : question
      )
    );
  };

  const removeEnumAnswer = (qIndex, aIndex) => {
    setQuestions((prev) =>
      prev.map((question, i) =>
        i === qIndex
          ? {
              ...question,
              answers: question.answers.filter((_, idx) => idx !== aIndex),
            }
          : question
      )
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
