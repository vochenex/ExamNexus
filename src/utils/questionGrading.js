export const CASE_FORMAT_OPTIONS = [
  { value: "any", label: "Any casing" },
  { value: "upper", label: "UPPERCASE" },
  { value: "lower", label: "lowercase" },
  { value: "sentence", label: "Sentence case" },
];

export const DEFAULT_GRADING_OPTIONS = {
  case_sensitive: false,
  case_format: "any",
  accept_alternatives: false,
  alternatives: [],
  ignore_order: false,
  trim_whitespace: true,
  points: 1,
};

export function createDefaultGradingOptions(overrides = {}) {
  return {
    ...DEFAULT_GRADING_OPTIONS,
    alternatives: [],
    ...overrides,
  };
}

export function normalizeGradingOptions(raw) {
  if (!raw || typeof raw !== "object") {
    return createDefaultGradingOptions();
  }

  return createDefaultGradingOptions({
    ...raw,
    alternatives: Array.isArray(raw.alternatives) ? raw.alternatives : [],
    points: Number(raw.points) > 0 ? Number(raw.points) : 1,
  });
}

export function getQuestionType(question, examType) {
  return question?.question_type || question?.type || examType || "multiple_choice";
}

export function applyCaseFormat(value, caseFormat) {
  const text = String(value ?? "");
  if (!text) return text;

  switch (caseFormat) {
    case "upper":
      return text.toUpperCase();
    case "lower":
      return text.toLowerCase();
    case "sentence":
      return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    default:
      return text;
  }
}

export function normalizeAnswerForGrading(value, grading) {
  const options = normalizeGradingOptions(grading);
  let text = String(value ?? "");

  if (options.trim_whitespace) {
    text = text.trim();
  }

  if (options.case_sensitive) {
    return text;
  }

  if (options.case_format && options.case_format !== "any") {
    return applyCaseFormat(text, options.case_format);
  }

  return text.toLowerCase();
}

export function answersMatch(studentValue, expectedValue, grading) {
  const options = normalizeGradingOptions(grading);
  const normalizedStudent = normalizeAnswerForGrading(studentValue, options);
  const normalizedExpected = normalizeAnswerForGrading(expectedValue, options);

  if (options.case_sensitive) {
    const left = options.trim_whitespace
      ? String(studentValue ?? "").trim()
      : String(studentValue ?? "");
    const right = options.trim_whitespace
      ? String(expectedValue ?? "").trim()
      : String(expectedValue ?? "");
    return left === right && left !== "";
  }

  return normalizedStudent === normalizedExpected && normalizedStudent !== "";
}

export function getAcceptedIdentificationAnswers(question) {
  const primary = String(question.answer || question.correct_answer || "").trim();
  const grading = normalizeGradingOptions(question.grading);
  const extras = grading.accept_alternatives
    ? (grading.alternatives || []).map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  return [...new Set([primary, ...extras].filter(Boolean))];
}

export function getQuestionValidationMessage(question, examType) {
  const type = getQuestionType(question, examType);

  if (!question.question?.trim()) {
    return "Enter the question text.";
  }

  if (type === "multiple_choice") {
    if (!Array.isArray(question.choices) || question.choices.length !== 4) {
      return "Add four choices for this multiple choice question.";
    }

    const emptyChoice = question.choices.findIndex((choice) => !String(choice || "").trim());
    if (emptyChoice !== -1) {
      return `Fill in choice ${emptyChoice + 1}.`;
    }

    if (!String(question.answer || "").trim()) {
      return "Select the correct choice.";
    }

    return null;
  }

  if (type === "enumeration") {
    if (!Array.isArray(question.answers) || question.answers.length === 0) {
      return "Add at least one correct answer.";
    }

    const emptyAnswer = question.answers.findIndex((answer) => !String(answer || "").trim());
    if (emptyAnswer !== -1) {
      return `Fill in correct answer ${emptyAnswer + 1}.`;
    }

    return null;
  }

  if (type === "true_false") {
    if (question.answer !== "true" && question.answer !== "false") {
      return "Select True or False as the correct answer.";
    }

    return null;
  }

  if (type === "essay") {
    return null;
  }

  if (!String(question.answer || "").trim()) {
    return "Enter the correct answer.";
  }

  if (
    normalizeGradingOptions(question.grading).accept_alternatives &&
    normalizeGradingOptions(question.grading).alternatives.some(
      (alt) => !String(alt || "").trim()
    )
  ) {
    return "Remove empty alternative answers or turn off alternative matching.";
  }

  return null;
}

export function isQuestionComplete(question, examType) {
  return getQuestionValidationMessage(question, examType) === null;
}

export function supportsGradingOptions(type) {
  return type === "identification" || type === "enumeration";
}
