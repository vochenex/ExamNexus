import {
  createDefaultGradingOptions,
  normalizeGradingOptions,
  getQuestionType,
  getQuestionValidationMessage,
  isQuestionComplete,
  answersMatch,
  getAcceptedIdentificationAnswers,
} from "./questionGrading";

export {
  getQuestionType,
  getQuestionValidationMessage,
  isQuestionComplete,
};

export const EXAM_TYPES = [
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "enumeration", label: "Enumeration" },
  { value: "identification", label: "Identification" },
  { value: "true_false", label: "True or False" },
  { value: "essay", label: "Essay" },
];

export const EXAM_TYPE_LABELS = Object.fromEntries(
  EXAM_TYPES.map(({ value, label }) => [value, label])
);

EXAM_TYPE_LABELS.mixed = "Mixed formats";

export const VALID_EXAM_TYPES = [
  ...EXAM_TYPES.map(({ value }) => value),
  "mixed",
];

export function normalizeExamTypeForDb(examType, fallback = "multiple_choice") {
  const normalized = String(examType || fallback).trim().toLowerCase();

  if (VALID_EXAM_TYPES.includes(normalized)) {
    return normalized;
  }

  if (["exam", "quiz", "activity"].includes(normalized)) {
    return fallback;
  }

  return fallback;
}

export function createEmptyQuestion(examType, sectionId = null, gradingDefaults = null) {
  return {
    question: "",
    type: examType,
    sectionId,
    choices: examType === "multiple_choice" ? ["", "", "", ""] : [],
    answers: examType === "enumeration" ? [""] : [],
    answer: "",
    grading: createDefaultGradingOptions(gradingDefaults || undefined),
  };
}

function tryParseAnswerList(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function deserializeQuestion(dbRow, examType) {
  const fallbackType =
    examType && examType !== "mixed" ? examType : "multiple_choice";
  const type = dbRow.question_type || fallbackType;
  const grading = normalizeGradingOptions(dbRow.grading_options);

  if (type === "multiple_choice") {
    return {
      id: dbRow.id,
      question: dbRow.question || "",
      type,
      choices: [
        dbRow.option_a || "",
        dbRow.option_b || "",
        dbRow.option_c || "",
        dbRow.option_d || "",
      ],
      answer: dbRow.correct_answer || "",
      answers: [],
      grading,
    };
  }

  if (type === "enumeration") {
    const fromJson =
      dbRow.correct_answers ||
      tryParseAnswerList(dbRow.correct_answer) ||
      [dbRow.option_a, dbRow.option_b, dbRow.option_c, dbRow.option_d].filter(
        Boolean
      );

    return {
      id: dbRow.id,
      question: dbRow.question || "",
      type,
      choices: [],
      answers: fromJson.length ? fromJson : [""],
      answer: "",
      grading,
    };
  }

  if (type === "essay") {
    return {
      id: dbRow.id,
      question: dbRow.question || "",
      type,
      choices: [],
      answers: [],
      answer: "",
      grading,
    };
  }

  return {
    id: dbRow.id,
    question: dbRow.question || "",
    type,
    choices: [],
    answers: [],
    answer: dbRow.correct_answer || "",
    grading,
  };
}

export function serializeQuestionForDb(question, examType) {
  const type = getQuestionType(question, examType);
  const grading = normalizeGradingOptions(question.grading);
  const base = {
    question: question.question?.trim() || "",
    question_type: type,
    grading_options: grading,
  };

  if (type === "multiple_choice") {
    return {
      ...base,
      option_a: question.choices?.[0] || "",
      option_b: question.choices?.[1] || "",
      option_c: question.choices?.[2] || "",
      option_d: question.choices?.[3] || "",
      correct_answer: question.answer || "",
      correct_answers: null,
    };
  }

  if (type === "enumeration") {
    const answers = (question.answers || [])
      .map((a) => a.trim())
      .filter(Boolean);

    return {
      ...base,
      option_a: "",
      option_b: "",
      option_c: "",
      option_d: "",
      correct_answer: answers.length ? JSON.stringify(answers) : "",
      correct_answers: answers,
    };
  }

  if (type === "essay") {
    return {
      ...base,
      option_a: "",
      option_b: "",
      option_c: "",
      option_d: "",
      correct_answer: "",
      correct_answers: null,
    };
  }

  return {
    ...base,
    option_a: "",
    option_b: "",
    option_c: "",
    option_d: "",
    correct_answer: question.answer?.trim() || "",
    correct_answers: null,
  };
}

export function isAutoGradedType(examType) {
  return examType !== "essay";
}

export function getExpectedEnumerationAnswers(question) {
  if (question.correct_answers?.length) {
    return question.correct_answers;
  }

  const parsed = tryParseAnswerList(question.correct_answer);
  if (parsed?.length) return parsed;

  return [question.option_a, question.option_b, question.option_c, question.option_d].filter(
    Boolean
  );
}

/** Display-ready correct answers for faculty review (supports mixed formats). */
export function formatQuestionCorrectAnswers(question, examType) {
  const type = getQuestionType(question, examType);

  if (type === "multiple_choice") {
    const letter = String(question.correct_answer || "").trim().toUpperCase();
    const choiceMap = {
      A: question.option_a,
      B: question.option_b,
      C: question.option_c,
      D: question.option_d,
    };
    const text = choiceMap[letter];
    if (letter && text) return [`${letter}. ${text}`];
    if (letter) return [letter];
    return [];
  }

  if (type === "enumeration") {
    return getExpectedEnumerationAnswers(question).filter(Boolean);
  }

  if (type === "true_false") {
    const value = String(question.correct_answer || "").toLowerCase();
    if (value === "true") return ["True"];
    if (value === "false") return ["False"];
    return [];
  }

  if (type === "identification") {
    const grading = normalizeGradingOptions(question.grading_options);
    const primary = String(question.correct_answer || "").trim();
    const extras =
      grading.accept_alternatives && grading.alternatives?.length
        ? grading.alternatives.map((item) => String(item || "").trim()).filter(Boolean)
        : [];
    return [...new Set([primary, ...extras].filter(Boolean))];
  }

  if (type === "essay") {
    return [];
  }

  const fallback = String(question.correct_answer || "").trim();
  return fallback ? [fallback] : [];
}

function gradeEnumerationAnswer(question, rawAnswer) {
  const expected = getExpectedEnumerationAnswers(question);
  const grading = normalizeGradingOptions(question.grading || question.grading_options);

  let studentAnswers = rawAnswer;
  if (typeof studentAnswers === "string") {
    studentAnswers = tryParseAnswerList(studentAnswers) || [studentAnswers];
  }

  if (!Array.isArray(studentAnswers) || studentAnswers.length !== expected.length) {
    return false;
  }

  if (grading.ignore_order) {
    const remaining = [...expected];
    return studentAnswers.every((studentAnswer) => {
      const matchIndex = remaining.findIndex((expectedAnswer) =>
        answersMatch(studentAnswer, expectedAnswer, grading)
      );
      if (matchIndex === -1) return false;
      remaining.splice(matchIndex, 1);
      return true;
    });
  }

  return expected.every((answer, index) =>
    answersMatch(studentAnswers[index], answer, grading)
  );
}

export function gradeStudentAnswer(question, examType, rawAnswer) {
  const type = getQuestionType(question, examType);
  const grading = normalizeGradingOptions(question.grading || question.grading_options);
  const questionWithGrading = { ...question, grading };

  if (type === "essay") {
    return { isCorrect: null, pendingReview: true };
  }

  if (type === "multiple_choice") {
    const selected = String(rawAnswer || "").toUpperCase();
    const expected = String(question.correct_answer || "").toUpperCase();
    return { isCorrect: selected === expected && selected !== "", pendingReview: false };
  }

  if (type === "true_false") {
    const selected = String(rawAnswer || "").toLowerCase();
    const expected = String(question.correct_answer || "").toLowerCase();
    return { isCorrect: selected === expected && selected !== "", pendingReview: false };
  }

  if (type === "identification") {
    const accepted = getAcceptedIdentificationAnswers({
      ...questionWithGrading,
      answer: question.correct_answer || question.answer,
    });

    const isCorrect = accepted.some((expected) =>
      answersMatch(rawAnswer, expected, grading)
    );

    return { isCorrect, pendingReview: false };
  }

  if (type === "enumeration") {
    return {
      isCorrect: gradeEnumerationAnswer(questionWithGrading, rawAnswer),
      pendingReview: false,
    };
  }

  return { isCorrect: false, pendingReview: false };
}

export function formatStoredAnswer(rawAnswer, examType) {
  if (examType === "enumeration" && Array.isArray(rawAnswer)) {
    return JSON.stringify(rawAnswer);
  }

  return rawAnswer ?? "";
}

export function parseStoredAnswer(rawAnswer, examType) {
  if (examType === "enumeration") {
    return tryParseAnswerList(rawAnswer) || [];
  }

  return rawAnswer || "";
}
