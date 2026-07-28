import { EXAM_TYPE_LABELS } from "./assessmentQuestions";
import {
  createDefaultGradingOptions,
  getQuestionType,
  normalizeGradingOptions,
} from "./questionGrading";

let sectionIdCounter = 0;

export function createQuestionSection(type) {
  sectionIdCounter += 1;
  return {
    id: `section-${Date.now()}-${sectionIdCounter}`,
    type,
    gradingDefaults: createDefaultGradingOptions(),
  };
}

export function inferSectionGradingDefaults(questions, sectionId) {
  const sectionQuestions = questions.filter((question) => question.sectionId === sectionId);
  if (sectionQuestions.length === 0) {
    return createDefaultGradingOptions();
  }

  return normalizeGradingOptions(sectionQuestions[0].grading);
}

export function questionHasContent(question) {
  const type = getQuestionType(question);

  if (question.question?.trim()) return true;

  if (type === "multiple_choice") {
    return (
      question.choices?.some((choice) => String(choice || "").trim()) ||
      Boolean(question.answer?.trim())
    );
  }

  if (type === "enumeration") {
    return question.answers?.some((answer) => String(answer || "").trim());
  }

  if (type === "true_false") {
    return question.answer === "true" || question.answer === "false";
  }

  if (type === "essay") {
    return false;
  }

  return Boolean(String(question.answer || "").trim());
}

export function sectionHasContent(questions, sectionId) {
  return questions
    .filter((question) => question.sectionId === sectionId)
    .some((question) => questionHasContent(question));
}

export function buildSectionsFromQuestions(questions, fallbackType = "multiple_choice") {
  const sections = [];
  const typeToSectionId = new Map();

  for (const question of questions) {
    const type = getQuestionType(question, fallbackType);

    if (!typeToSectionId.has(type)) {
      const section = createQuestionSection(type);
      typeToSectionId.set(type, section.id);
      sections.push(section);
    }

    question.sectionId = question.sectionId || typeToSectionId.get(type);
    question.type = type;
  }

  if (sections.length === 0) {
    sections.push(createQuestionSection(fallbackType));
  }

  return sections;
}

export function resolveExamTypeForSave(questionSections) {
  if (!questionSections?.length) return "multiple_choice";
  if (questionSections.length === 1) {
    return questionSections[0].type || "multiple_choice";
  }

  const uniqueTypes = [
    ...new Set(questionSections.map((section) => section.type).filter(Boolean)),
  ];

  if (uniqueTypes.length === 1) {
    return uniqueTypes[0];
  }

  return "mixed";
}

export function getOrderedQuestions(questions, questionSections) {
  const ordered = [];

  for (const section of questionSections) {
    ordered.push(
      ...questions.filter((question) => question.sectionId === section.id)
    );
  }

  const knownIds = new Set(ordered.map((question) => question.id).filter(Boolean));
  const orphans = questions.filter(
    (question) => !question.sectionId || !knownIds.has(question.id)
  );

  return [...ordered, ...orphans];
}

export function getFormatLabel(type) {
  if (type === "mixed") return "Mixed formats";
  return EXAM_TYPE_LABELS[type] || type?.replace(/_/g, " ") || "Question";
}

export function getGlobalQuestionIndex(questions, questionSections, sectionId, localIndex) {
  let index = 0;

  for (const section of questionSections) {
    const sectionQuestions = questions.filter(
      (question) => question.sectionId === section.id
    );

    if (section.id === sectionId) {
      return index + localIndex;
    }

    index += sectionQuestions.length;
  }

  return index + localIndex;
}
