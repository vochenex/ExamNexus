import { createDefaultGradingOptions } from "./questionGrading";
import { VALID_EXAM_TYPES } from "./assessmentQuestions";

export const AI_FORMAT_OPTIONS = [
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "enumeration", label: "Enumeration" },
  { value: "identification", label: "Identification" },
  { value: "true_false", label: "True or False" },
  { value: "essay", label: "Essay" },
];

export const DEFAULT_AI_FORMATS = [
  "multiple_choice",
  "enumeration",
  "identification",
  "true_false",
];

function normalizeLetterAnswer(value) {
  const raw = String(value || "").trim();
  const leading = raw.match(/^([A-D])[.)]/i);
  if (leading) {
    return leading[1].toUpperCase();
  }

  const letter = raw.toUpperCase();
  if (["A", "B", "C", "D"].includes(letter)) {
    return letter;
  }

  return "";
}

function extractQuestionText(aiQuestion) {
  return String(aiQuestion?.question || aiQuestion?.text || aiQuestion?.prompt || "").trim();
}

function extractMultipleChoiceOptions(aiQuestion) {
  if (Array.isArray(aiQuestion?.choices)) {
    return aiQuestion.choices.map((item) =>
      String(item || "")
        .trim()
        .replace(/^[A-D][.)]\s*/i, "")
    );
  }

  if (Array.isArray(aiQuestion?.options)) {
    return aiQuestion.options.map((item) =>
      String(item || "")
        .trim()
        .replace(/^[A-D][.)]\s*/i, "")
    );
  }

  return [
    aiQuestion?.option_a,
    aiQuestion?.option_b,
    aiQuestion?.option_c,
    aiQuestion?.option_d,
  ].map((item) => String(item || "").trim());
}

export function mapAiQuestionToBuilder(aiQuestion) {
  const type = String(aiQuestion?.type || "").toLowerCase();
  if (!VALID_EXAM_TYPES.includes(type) || type === "mixed") {
    return null;
  }

  const grading = createDefaultGradingOptions();
  const question = extractQuestionText(aiQuestion);
  if (!question) return null;

  if (type === "multiple_choice") {
    const choices = extractMultipleChoiceOptions(aiQuestion);

    while (choices.length < 4) choices.push("");
    const four = choices.slice(0, 4);
    if (four.some((choice) => !choice)) return null;

    const answer = normalizeLetterAnswer(aiQuestion.answer || aiQuestion.correct_answer);
    if (!answer) return null;

    return {
      question,
      type,
      choices: four,
      answers: [],
      answer,
      grading,
    };
  }

  if (type === "enumeration") {
    const answers = (Array.isArray(aiQuestion.answers) ? aiQuestion.answers : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean);

    if (!answers.length) return null;

    return {
      question,
      type,
      choices: [],
      answers,
      answer: "",
      grading,
    };
  }

  if (type === "essay") {
    return {
      question,
      type,
      choices: [],
      answers: [],
      answer: "",
      grading,
    };
  }

  if (type === "true_false") {
    const answer = String(aiQuestion.answer || "").trim().toLowerCase();
    if (answer !== "true" && answer !== "false") return null;

    return {
      question,
      type,
      choices: [],
      answers: [],
      answer,
      grading,
    };
  }

  const answer = String(aiQuestion.answer || "").trim();
  if (!answer) return null;

  return {
    question,
    type,
    choices: [],
    answers: [],
    answer,
    grading,
  };
}

export function mapAiPayloadToBuilderQuestions(payload) {
  const questions = Array.isArray(payload?.questions) ? payload.questions : [];
  return questions
    .map((item) => mapAiQuestionToBuilder(item))
    .filter(Boolean);
}
