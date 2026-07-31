const {
  assertGeminiConfigured,
  assertPromptAiConfigured,
  requestPromptChatCompletion,
  requestDocumentChatCompletion,
  getAiServiceStatus,
} = require("./aiProvider");
const { planDocumentSteps } = require("./documentBlocks");

const VALID_TYPES = new Set([
  "multiple_choice",
  "enumeration",
  "identification",
  "true_false",
  "essay",
]);

const ALL_FORMATS = [...VALID_TYPES];

const TYPE_LABELS = {
  multiple_choice: "Multiple Choice",
  enumeration: "Enumeration",
  identification: "Identification",
  true_false: "True or False",
  essay: "Essay",
};

const MAX_QUESTIONS = 150;
const MIN_QUESTIONS = 1;
const DEFAULT_QUESTIONS = 8;
const MAX_SOURCE_CHARS = 14000;
const MAX_PROMPT_CHARS = 4000;
const DEFAULT_BATCH_DELAY_MS = 4000;
const DEFAULT_GROQ_BATCH_DELAY_MS = 750;
const DEFAULT_CHUNK_SIZE = 5;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getBatchDelayMs() {
  const configured = Number(process.env.GEMINI_BATCH_DELAY_MS);
  if (Number.isFinite(configured) && configured >= 0) {
    return configured;
  }
  // Groq free tier allows higher RPM than Gemini free; keep only a short gap.
  if (String(process.env.GROQ_API_KEY || "").trim()) {
    return DEFAULT_GROQ_BATCH_DELAY_MS;
  }
  return DEFAULT_BATCH_DELAY_MS;
}

function getChunkSize() {
  const configured = Number.parseInt(process.env.GEMINI_CHUNK_SIZE, 10);
  if (Number.isFinite(configured) && configured >= 1) {
    return Math.min(10, configured);
  }
  return DEFAULT_CHUNK_SIZE;
}

function questionDedupeKey(question) {
  return String(question?.question || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function questionsLookSimilar(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  // Near-exact only: one string almost fully contains the other after normalization.
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (shorter.length >= 24 && longer.includes(shorter)) return true;

  const wordsA = new Set(a.split(" ").filter((w) => w.length > 2));
  const wordsB = new Set(b.split(" ").filter((w) => w.length > 2));
  if (wordsA.size < 4 || wordsB.size < 4) return false;
  let overlap = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) overlap += 1;
  }
  const ratio = overlap / Math.min(wordsA.size, wordsB.size);
  // High threshold so related-but-distinct items on the same topic are kept.
  return ratio >= 0.9;
}

function isDuplicateQuestion(question, seenKeys, existingKeys = []) {
  const key = questionDedupeKey(question);
  if (!key) return true;
  if (seenKeys.has(key)) return true;
  for (const existing of existingKeys) {
    if (questionsLookSimilar(key, existing)) return true;
  }
  for (const existing of seenKeys) {
    if (questionsLookSimilar(key, existing)) return true;
  }
  return false;
}

function clampQuestionCount(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_QUESTIONS;
  return Math.min(MAX_QUESTIONS, Math.max(MIN_QUESTIONS, parsed));
}

const FORMAT_KEYWORDS = [
  { value: "multiple_choice", patterns: [/multiple\s*choice/i, /\bmcq\b/i, /\bmultiple-choice\b/i] },
  { value: "enumeration", patterns: [/enumeration/i, /\benumerate\b/i, /\blist\s+all\b/i] },
  { value: "identification", patterns: [/identification/i, /\bidentify\b/i, /\bfill\s+in\b/i] },
  { value: "true_false", patterns: [/true\s*or\s*false/i, /\btrue\/false\b/i, /\bt\/f\b/i] },
  {
    value: "essay",
    patterns: [/essay/i, /\bshort\s+answer\b/i, /\bexplain\b/i, /\bdiscuss\b/i],
  },
];

function parsePromptPreferences(prompt) {
  const text = String(prompt || "");
  const lower = text.toLowerCase();

  let questionCount = null;
  const countPatterns = [
    /(\d+)\s*(?:questions?|items?|problems?|qs?)\b/i,
    /(?:create|make|generate|write)\s+(\d+)\b/i,
    /(\d+)\s*[- ]?(?:item|question)\b/i,
  ];

  for (const pattern of countPatterns) {
    const match = text.match(pattern);
    if (match) {
      const parsed = Number.parseInt(match[1], 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        questionCount = Math.min(MAX_QUESTIONS, parsed);
        break;
      }
    }
  }

  // Sum explicit per-format counts when present (e.g. "5 MCQ and 5 essay").
  const perFormatCounts = [
    ...text.matchAll(
      /(\d+)\s*(?:multiple\s*choice|mcq|enumeration|identification|true\s*or\s*false|true\/false|t\/f|essay|short\s+answer)s?\b/gi
    ),
  ];
  if (perFormatCounts.length > 1) {
    const summed = perFormatCounts.reduce(
      (total, match) => total + (Number.parseInt(match[1], 10) || 0),
      0
    );
    if (summed > 0) {
      questionCount = Math.min(MAX_QUESTIONS, summed);
    }
  }

  let difficulty = null;
  if (/\b(hard|difficult|advanced|challenging)\b/i.test(lower)) {
    difficulty = "hard";
  } else if (/\b(easy|basic|simple|beginner)\b/i.test(lower)) {
    difficulty = "easy";
  } else if (/\b(medium|moderate|intermediate)\b/i.test(lower)) {
    difficulty = "medium";
  }

  const formats = [];
  for (const { value, patterns } of FORMAT_KEYWORDS) {
    if (patterns.some((pattern) => pattern.test(text))) {
      formats.push(value);
    }
  }

  return { questionCount, difficulty, formats };
}

function resolvePromptGenerationSettings({
  prompt,
  questionCount,
  difficulty,
  formats,
  lockQuestionCount = false,
}) {
  const parsed = parsePromptPreferences(prompt);
  const uiFormats =
    Array.isArray(formats) && formats.length > 0 ? parseFormats(formats) : [];
  const promptFormats =
    parsed.formats.length > 0 ? parseFormats(parsed.formats) : [];

  // Prompt-named formats win when present; otherwise use UI chips / defaults.
  const finalFormats =
    promptFormats.length > 0
      ? promptFormats
      : uiFormats.length > 0
        ? uiFormats
        : parseFormats(null);

  const uiCount = Number.parseInt(questionCount, 10);
  const hasUiCount = Number.isFinite(uiCount) && uiCount > 0;
  const rawCount = lockQuestionCount
    ? hasUiCount
      ? uiCount
      : null
    : parsed.questionCount ?? (hasUiCount ? uiCount : null);

  return {
    questionCount: rawCount == null ? null : clampQuestionCount(rawCount),
    difficulty: parsed.difficulty || difficulty || "medium",
    formats: finalFormats,
  };
}

function parseFormats(raw) {
  let formats = raw;

  if (typeof formats === "string") {
    try {
      formats = JSON.parse(formats);
    } catch {
      formats = formats.split(",").map((item) => item.trim());
    }
  }

  if (!Array.isArray(formats) || formats.length === 0) {
    return ["multiple_choice", "enumeration", "identification", "true_false"];
  }

  const normalized = [
    ...new Set(
      formats
        .map((item) => String(item || "").trim().toLowerCase())
        .filter((item) => VALID_TYPES.has(item))
    ),
  ];

  return normalized.length ? normalized : ["multiple_choice"];
}

function stripJsonFences(text) {
  return String(text || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function tryParseJson(text) {
  const cleaned = stripJsonFences(text);

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("Invalid JSON");
  }
}

function normalizeTrueFalseAnswer(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "true" || normalized === "t" || normalized === "yes") {
    return "true";
  }
  if (normalized === "false" || normalized === "f" || normalized === "no") {
    return "false";
  }
  return "";
}

function trimField(value, max = 2000) {
  return String(value || "").trim().slice(0, max);
}

function extractQuestionText(raw) {
  return trimField(raw?.question || raw?.text || raw?.prompt);
}

function stripChoicePrefix(value) {
  return String(value || "")
    .trim()
    .replace(/^[A-D][.)]\s*/i, "")
    .trim();
}

function extractMultipleChoiceOptions(raw) {
  if (Array.isArray(raw?.choices)) {
    return raw.choices.map((item) => trimField(stripChoicePrefix(item), 500));
  }

  if (Array.isArray(raw?.options)) {
    return raw.options.map((item) => trimField(stripChoicePrefix(item), 500));
  }

  const fromOptionKeys = [raw?.option_a, raw?.option_b, raw?.option_c, raw?.option_d].map(
    (item) => trimField(stripChoicePrefix(item), 500)
  );
  if (fromOptionKeys.some(Boolean)) {
    return fromOptionKeys;
  }

  const fromLetterKeys = ["A", "B", "C", "D"].map((letter) =>
    trimField(stripChoicePrefix(raw?.[letter]), 500)
  );
  if (fromLetterKeys.some(Boolean)) {
    return fromLetterKeys;
  }

  return [];
}

function normalizeLetterAnswer(value) {
  const raw = String(value || "").trim();
  const leading = raw.match(/^([A-D])[.)]/i);
  if (leading) {
    return leading[1].toUpperCase();
  }

  const letter = raw.toUpperCase().replace(/[^A-D]/g, "");

  if (letter.length === 1 && ["A", "B", "C", "D"].includes(letter)) {
    return letter;
  }

  const asNumber = Number.parseInt(raw, 10);
  if (asNumber >= 1 && asNumber <= 4) {
    return ["A", "B", "C", "D"][asNumber - 1];
  }

  return "";
}

function normalizeQuestion(raw, allowedFormats) {
  const type = String(raw?.type || raw?.question_type || "")
    .trim()
    .toLowerCase();

  if (!VALID_TYPES.has(type) || !allowedFormats.includes(type)) {
    return null;
  }

  const question = extractQuestionText(raw);
  if (!question) return null;

  const base = { type, question };

  if (type === "multiple_choice") {
    const choices = extractMultipleChoiceOptions(raw);

    while (choices.length < 4) choices.push("");
    const four = choices.slice(0, 4);
    if (four.some((choice) => !choice)) return null;

    let answer = normalizeLetterAnswer(
      raw?.answer || raw?.correct_answer || raw?.correctChoice || raw?.correct
    );

    if (!answer && raw?.correct_choice) {
      answer = normalizeLetterAnswer(raw.correct_choice);
    }

    if (!answer) return null;

    return { ...base, choices: four, answer };
  }

  if (type === "enumeration") {
    const answers = (
      Array.isArray(raw?.answers)
        ? raw.answers
        : Array.isArray(raw?.correct_answers)
          ? raw.correct_answers
          : []
    )
      .map((item) => trimField(item, 500))
      .filter(Boolean);

    if (!answers.length) return null;
    return { ...base, answers };
  }

  if (type === "true_false") {
    const answer = normalizeTrueFalseAnswer(raw?.answer || raw?.correct_answer);
    if (!answer) return null;
    return { ...base, answer };
  }

  if (type === "essay") {
    return base;
  }

  const answer = trimField(raw?.answer || raw?.correct_answer, 500);
  if (!answer) return null;
  return { ...base, answer };
}

function normalizeAiPayload(payload, allowedFormats) {
  let questionsRaw = Array.isArray(payload?.questions) ? payload.questions : [];

  if (!questionsRaw.length) {
    const nested = payload?.question;
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      // Compact shape: { question: { type, question, ... } }
      questionsRaw = [nested];
    } else if (payload && typeof payload === "object" && (payload.type || payload.question_type)) {
      // Flat single-question shape: { type, question, choices, answer }
      questionsRaw = [payload];
    }
  }

  const questions = [];

  for (const item of questionsRaw) {
    if (!item || typeof item !== "object") continue;
    const normalized = normalizeQuestion(item, allowedFormats);
    if (normalized) {
      questions.push(normalized);
    }
  }

  return {
    suggestedTitle: trimField(payload?.suggestedTitle || payload?.title, 200),
    suggestedDescription: trimField(
      payload?.suggestedDescription || payload?.description,
      2000
    ),
    questions,
  };
}

function pickFormatForStep(formats, stepIndex) {
  if (!formats?.length) return "multiple_choice";
  return formats[stepIndex % formats.length];
}

function buildCompactSystemPrompt(format, difficulty) {
  const examples = {
    multiple_choice:
      '{"type":"multiple_choice","question":"What is photosynthesis?","choices":["Making food using light","Burning glucose","Digesting proteins","Absorbing minerals"],"answer":"A"}',
    enumeration:
      '{"type":"enumeration","question":"List the stages of mitosis in order","answers":["prophase","metaphase","anaphase","telophase"]}',
    identification:
      '{"type":"identification","question":"What gas do plants release during photosynthesis?","answer":"oxygen"}',
    true_false:
      '{"type":"true_false","question":"Plants need sunlight for photosynthesis.","answer":"true"}',
    essay:
      '{"type":"essay","question":"Explain how photosynthesis supports life on Earth."}',
  };

  return `Return JSON only. Write one ${format} question. Difficulty: ${difficulty}.
Preferred flat shape example:
${examples[format] || examples.multiple_choice}
You may also wrap it as {"question":{...},"suggestedTitle":"...","suggestedDescription":"..."}.
Use "question" for the stem text (not "text"). Include "answer" for auto-graded types. Choices must be plain text without A/B/C/D prefixes.`;
}

function buildCompactUserPrompt({
  sourceText,
  topicPrompt,
  additionalInstructions,
  format,
  stepIndex,
  totalSteps,
}) {
  const parts = [`Write question ${stepIndex + 1} of ${totalSteps}. Use type "${format}".`];

  if (topicPrompt) {
    parts.push(`Topic: ${topicPrompt.slice(0, 2000)}`);
  }

  if (sourceText) {
    parts.push(`Source:\n${sourceText.slice(0, 6000)}`);
  }

  if (additionalInstructions) {
    parts.push(`Notes: ${String(additionalInstructions).slice(0, 800)}`);
  }

  if (stepIndex === 0) {
    parts.push('Also include "suggestedTitle" and "suggestedDescription" at the top level.');
  }

  return parts.join("\n\n");
}

async function parseAiResponse(content, allowedFormats) {
  try {
    return normalizeAiPayload(tryParseJson(content), allowedFormats);
  } catch (firstError) {
    const repair = await requestPromptChatCompletion({
      temperature: 0,
      jsonMode: true,
      messages: [
        {
          role: "system",
          content:
            'Return valid JSON only. Prefer a flat question object {"type","question",...} or {"questions":[...]} or {"question":{...}}.',
        },
        { role: "user", content: String(content || "") },
      ],
    });

    try {
      return normalizeAiPayload(tryParseJson(repair.content), allowedFormats);
    } catch {
      const error = new Error("AI returned an invalid response. Please try again.");
      error.statusCode = 502;
      error.cause = firstError;
      throw error;
    }
  }
}

async function requestSingleAiQuestion({
  sourceText = "",
  topicPrompt = "",
  additionalInstructions = "",
  format,
  difficulty = "medium",
  stepIndex = 0,
  totalSteps = 1,
  mode = "prompt",
}) {
  assertPromptAiConfigured();

  const allowedFormats = parseFormats([format]);
  const targetFormat = pickFormatForStep(allowedFormats, 0);
  const userPrompt = buildCompactUserPrompt({
    sourceText,
    topicPrompt,
    additionalInstructions,
    format: targetFormat,
    stepIndex,
    totalSteps,
  });

  const response = await requestPromptChatCompletion({
    temperature: 0.3,
    jsonMode: true,
    messages: [
      { role: "system", content: buildCompactSystemPrompt(targetFormat, difficulty) },
      { role: "user", content: userPrompt },
    ],
  });

  const payload = await parseAiResponse(response.content, allowedFormats);
  const question = payload.questions[0];

  if (!question) {
    if (process.env.DEBUG_AI === "1") {
      console.error("AI raw response:", response.content);
      console.error("Normalized payload:", JSON.stringify(payload, null, 2));
    }
    const error = new Error("AI could not produce a valid question. Try again.");
    error.statusCode = 422;
    throw error;
  }

  return {
    question,
    suggestedTitle: payload.suggestedTitle,
    suggestedDescription: payload.suggestedDescription,
    provider: response.provider,
    model: response.model,
  };
}

async function requestAiQuestionsBatched({
  sourceText = "",
  topicPrompt = "",
  additionalInstructions = "",
  formats,
  questionCount,
  difficulty = "medium",
}) {
  const allowedFormats = parseFormats(formats);
  const count = clampQuestionCount(questionCount);
  const delayMs = getBatchDelayMs();
  const chunkSize = getChunkSize();
  const mode = topicPrompt ? "prompt" : "document";

  const questions = [];
  const seen = new Set();
  let droppedDuplicates = 0;
  let suggestedTitle = "";
  let suggestedDescription = "";
  let provider = "gemini";
  let model = "";

  const absorbQuestions = (items) => {
    for (const item of items) {
      const key = questionDedupeKey(item);
      if (!key) continue;
      if (isDuplicateQuestion(item, seen)) {
        droppedDuplicates += 1;
        continue;
      }
      seen.add(key);
      questions.push(item);
      if (questions.length >= count) break;
    }
  };

  let chunkRound = 0;
  const maxChunkRounds = Math.ceil(count / chunkSize) + 3;
  let emptyStreak = 0;

  while (questions.length < count && chunkRound < maxChunkRounds) {
    if (chunkRound > 0) {
      await sleep(delayMs);
    }
    chunkRound += 1;

    const need = Math.min(chunkSize, count - questions.length);
    const continuation =
      questions.length > 0
        ? `Already created ${questions.length} of ${count} questions. Add ${need} NEW distinct questions without repeating topics or wording.`
        : "";

    const result = await requestAiQuestions({
      sourceText,
      topicPrompt,
      additionalInstructions: [additionalInstructions, continuation]
        .filter(Boolean)
        .join("\n"),
      formats: allowedFormats,
      questionCount: need,
      difficulty,
      mode,
    });

    provider = result.meta?.provider || provider;
    model = result.meta?.model || model;
    if (!suggestedTitle && result.suggestedTitle) {
      suggestedTitle = result.suggestedTitle;
    }
    if (!suggestedDescription && result.suggestedDescription) {
      suggestedDescription = result.suggestedDescription;
    }

    const before = questions.length;
    absorbQuestions(result.questions);
    if (questions.length === before) {
      emptyStreak += 1;
      if (emptyStreak >= 2) {
        break;
      }
    } else {
      emptyStreak = 0;
    }
  }

  let singleStep = 0;
  const maxSingleSteps = count - questions.length + 5;

  while (questions.length < count && singleStep < maxSingleSteps) {
    await sleep(delayMs);
    singleStep += 1;

    const step = questions.length;
    const format = pickFormatForStep(allowedFormats, step);
    const recent = questions
      .map((item) => item.question)
      .filter(Boolean)
      .slice(-12)
      .join(" | ");

    const result = await requestSingleAiQuestion({
      sourceText,
      topicPrompt,
      additionalInstructions: [
        additionalInstructions,
        recent
          ? `Do not repeat or paraphrase any of these existing questions: ${recent}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
      format,
      difficulty,
      stepIndex: step,
      totalSteps: count,
      mode,
    });

    provider = result.provider || provider;
    model = result.model || model;
    if (!suggestedTitle && result.suggestedTitle) {
      suggestedTitle = result.suggestedTitle;
    }
    if (!suggestedDescription && result.suggestedDescription) {
      suggestedDescription = result.suggestedDescription;
    }

    const key = questionDedupeKey(result.question);
    if (!key) continue;
    if (isDuplicateQuestion(result.question, seen)) {
      droppedDuplicates += 1;
      continue;
    }
    seen.add(key);
    questions.push(result.question);
  }

  if (!questions.length) {
    const error = new Error(
      "AI could not produce valid questions. Try fewer questions or wait a minute and retry."
    );
    error.statusCode = 422;
    throw error;
  }

  return {
    suggestedTitle,
    suggestedDescription,
    questions: questions.slice(0, count),
    meta: {
      requestedCount: count,
      generatedCount: Math.min(questions.length, count),
      droppedDuplicates,
      formats: allowedFormats,
      provider,
      model,
      batched: true,
      chunkSize,
      batchDelayMs: delayMs,
    },
  };
}

function buildSystemPrompt({ formats, questionCount, difficulty, mode }) {
  const formatList = formats.map((type) => `- ${type}: ${TYPE_LABELS[type]}`).join("\n");

  return `You are an expert teacher assistant for ExamNexus, a school assessment platform.
Generate assessment questions that can be saved directly to a database.

Rules:
- Return ONLY valid JSON. No markdown fences or commentary.
- Use only these question types:\n${formatList}
- Generate exactly ${questionCount} questions unless the source material is too short; never exceed ${questionCount}.
- Mix formats naturally when multiple types are allowed.
- multiple_choice: exactly 4 non-empty choices; answer must be A, B, C, or D. Choice strings must NOT include letter prefixes like "A." or "B)".
- enumeration: provide an "answers" array with every required item in order.
- identification: provide a single correct "answer" string.
- true_false: answer must be "true" or "false".
- essay: no answer field required.
- Questions must be clear, classroom-appropriate, and aligned with the ${mode} content.
- Difficulty target: ${difficulty}.
- Every question must be unique. Do not repeat the same stem or near-paraphrase.
- Prefer distinct concepts across the set; never create copy-paste variations of the same question.
JSON shape:
{
  "suggestedTitle": "short title",
  "suggestedDescription": "one sentence summary",
  "questions": [
    {
      "type": "multiple_choice",
      "question": "text",
      "choices": ["Making food using light", "Burning glucose", "Digesting proteins", "Absorbing minerals"],
      "answer": "A"
    }
  ]
}`;
}

function buildUserPrompt({ sourceText, topicPrompt, additionalInstructions }) {
  const parts = [];

  if (sourceText) {
    parts.push(`SOURCE MATERIAL:\n${sourceText.slice(0, MAX_SOURCE_CHARS)}`);
  }

  if (topicPrompt) {
    parts.push(`TEACHER REQUEST:\n${topicPrompt.slice(0, MAX_PROMPT_CHARS)}`);
  }

  if (additionalInstructions) {
    parts.push(
      `ADDITIONAL INSTRUCTIONS:\n${String(additionalInstructions).slice(0, 1500)}`
    );
  }

  return parts.join("\n\n");
}

function buildDocumentAnalysisSystemPrompt({
  isQuestionnaire = true,
  formats = ALL_FORMATS,
  questionCount,
  difficulty,
} = {}) {
  const formatList = (formats?.length ? formats : ALL_FORMATS)
    .map((value) => TYPE_LABELS[value] || value)
    .join(", ");

  if (isQuestionnaire) {
    return `You are an expert at reading teacher documents and converting them into structured exam questions for ExamNexus.

Your job:
1. Read the uploaded document carefully (exam papers, quizzes, worksheets with numbered items).
2. The document ALREADY contains questions — convert EACH one into a structured question. Keep the original wording when possible.
3. Detect the correct question type from layout:
   - A/B/C/D or multiple choices → multiple_choice (4 choices, answer as A, B, C, or D)
   - True/False statements → true_false
   - Fill-in-the-blank or identification lines → identification
   - Enumerate, list, or ordered answer sets → enumeration
   - Long answer, explain, or essay prompts → essay
4. Include every question found. Do not invent extra items beyond what is in the document.
5. Infer overall difficulty from vocabulary, grade level, and complexity.

Rules:
- Return ONLY valid JSON. No markdown fences or commentary.
- multiple_choice: exactly 4 non-empty choices; answer must be A, B, C, or D.
- enumeration: provide an "answers" array with every required item in order.
- identification: provide a single correct "answer" string.
- true_false: answer must be "true" or "false".
- essay: no answer field required.

JSON shape:
{
  "suggestedTitle": "short title from document topic",
  "suggestedDescription": "one sentence summary",
  "analysis": {
    "sourceType": "existing_exam",
    "questionCount": 0,
    "inferredDifficulty": "easy, medium, or hard"
  },
  "questions": [
    {
      "type": "multiple_choice",
      "question": "text",
      "choices": ["A text", "B text", "C text", "D text"],
      "answer": "A"
    }
  ]
}`;
  }

  const countLine =
    questionCount != null && String(questionCount).trim() !== ""
      ? `Create exactly ${clampQuestionCount(questionCount)} questions.`
      : "Create a suitable number of questions from the material (typically 5–15, never exceed 150).";

  return `You are an expert exam writer for ExamNexus.

The uploaded file is NOT a ready-made questionnaire. It may be a topic outline, story, report, study guide, handout, or presentation (.pptx).

Your job:
1. Read the source carefully and invent high-quality assessment questions from its content.
2. ${countLine}
3. Target difficulty: ${String(difficulty || "medium")}.
4. Use ONLY these question formats: ${formatList}.
5. Mix the allowed formats when more than one is selected.

Rules:
- Return ONLY valid JSON. No markdown fences or commentary.
- multiple_choice: exactly 4 non-empty choices; answer must be A, B, C, or D.
- enumeration: provide an "answers" array with every required item in order.
- identification: provide a single correct "answer" string.
- true_false: answer must be "true" or "false".
- essay: no answer field required.
- Ground every question in the source material (topics, stories, reports, slides).

JSON shape:
{
  "suggestedTitle": "short title from document topic",
  "suggestedDescription": "one sentence summary",
  "analysis": {
    "sourceType": "study_material",
    "questionCount": 0,
    "inferredDifficulty": "easy, medium, or hard"
  },
  "questions": [
    {
      "type": "multiple_choice",
      "question": "text",
      "choices": ["A text", "B text", "C text", "D text"],
      "answer": "A"
    }
  ]
}`;
}

async function classifyDocumentContent(sourceText) {
  assertGeminiConfigured();

  const resolvedSource = String(sourceText || "").trim();
  if (!resolvedSource) {
    const error = new Error("The document did not contain readable text.");
    error.statusCode = 400;
    throw error;
  }

  const response = await requestDocumentChatCompletion({
    temperature: 0.1,
    jsonMode: true,
    messages: [
      {
        role: "system",
        content: `You classify teacher-uploaded documents for ExamNexus assessment generation.

Return ONLY valid JSON:
{
  "documentKind": "questionnaire" | "topic" | "story" | "report" | "presentation" | "study_material" | "other",
  "isQuestionnaire": true or false,
  "summary": "one short sentence about what the document contains",
  "suggestedTitle": "short title"
}

Rules:
- isQuestionnaire = true ONLY when the document already contains numbered/labeled exam or quiz questions that can be converted as-is.
- Topics, stories, reports, slide decks, handouts, and reading material without ready-made questions must set isQuestionnaire = false.
- Prefer presentation for PowerPoint-style slide notes/outlines.`,
      },
      {
        role: "user",
        content: `Classify this document:\n\n${resolvedSource.slice(0, MAX_SOURCE_CHARS)}`,
      },
    ],
  });

  let parsed = {};
  try {
    parsed = JSON.parse(String(response.content || "").trim());
  } catch {
    parsed = {};
  }

  const kind = String(parsed.documentKind || "other")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  const isQuestionnaire =
    parsed.isQuestionnaire === true ||
    kind === "questionnaire" ||
    kind === "existing_exam" ||
    kind === "exam" ||
    kind === "quiz";

  return {
    documentKind: isQuestionnaire ? "questionnaire" : kind || "study_material",
    isQuestionnaire,
    summary: String(parsed.summary || "").trim(),
    suggestedTitle: String(parsed.suggestedTitle || "").trim(),
    meta: {
      provider: response.provider,
      model: response.model,
      mode: "document_classify",
    },
  };
}

async function requestDocumentQuestions({
  sourceText = "",
  questionCount,
  difficulty,
  formats,
  isQuestionnaire = true,
}) {
  assertGeminiConfigured();

  const resolvedSource = String(sourceText || "").trim();
  if (!resolvedSource) {
    const error = new Error("The document did not contain readable text.");
    error.statusCode = 400;
    throw error;
  }

  const allowedFormats = parseFormats(formats);
  const guidance = [];
  if (!isQuestionnaire && questionCount != null && String(questionCount).trim() !== "") {
    guidance.push(
      `Create approximately ${clampQuestionCount(questionCount)} questions.`
    );
  }
  if (difficulty) {
    guidance.push(`Target difficulty level: ${String(difficulty).trim()}.`);
  }
  if (!isQuestionnaire && allowedFormats.length) {
    guidance.push(
      `Allowed formats only: ${allowedFormats
        .map((value) => TYPE_LABELS[value] || value)
        .join(", ")}.`
    );
  }

  const userPrompt = buildUserPrompt({
    sourceText: resolvedSource,
    additionalInstructions: guidance.join("\n"),
  });
  const response = await requestDocumentChatCompletion({
    temperature: isQuestionnaire ? 0.2 : 0.35,
    jsonMode: true,
    messages: [
      {
        role: "system",
        content: buildDocumentAnalysisSystemPrompt({
          isQuestionnaire,
          formats: allowedFormats,
          questionCount,
          difficulty,
        }),
      },
      { role: "user", content: userPrompt },
    ],
  });

  const normalized = await parseAiResponse(
    response.content,
    isQuestionnaire ? ALL_FORMATS : allowedFormats
  );

  if (!normalized.questions.length) {
    const error = new Error(
      "AI could not extract or build questions from this document. Try a clearer PDF, Word, or PowerPoint file."
    );
    error.statusCode = 422;
    throw error;
  }

  return {
    ...normalized,
    meta: {
      generatedCount: normalized.questions.length,
      formats: [...new Set(normalized.questions.map((item) => item.type))],
      provider: response.provider,
      model: response.model,
      mode: isQuestionnaire ? "document_questionnaire" : "document_source_material",
      isQuestionnaire: Boolean(isQuestionnaire),
    },
  };
}

async function requestDocumentQuestionsStepwise({
  sourceText,
  additionalInstructions = "",
  onProgress,
}) {
  const plan = planDocumentSteps(sourceText);
  const steps = plan.steps;
  const questions = [];
  let suggestedTitle = "";
  let suggestedDescription = "";
  let provider = "gemini";
  let model = "";

  for (let step = 0; step < steps.length; step += 1) {
    onProgress?.({
      current: step + 1,
      total: steps.length,
      phase: plan.mode,
    });

    const stepConfig = steps[step];
    const format =
      stepConfig.format || pickFormatForStep(ALL_FORMATS, step);

    const result = await requestSingleAiQuestion({
      sourceText: stepConfig.sourceText,
      additionalInstructions,
      format,
      difficulty: "medium",
      stepIndex: step,
      totalSteps: steps.length,
      mode: "document",
    });

    questions.push(result.question);
    provider = result.provider || provider;
    model = result.model || model;

    if (!suggestedTitle && result.suggestedTitle) {
      suggestedTitle = result.suggestedTitle;
    }
    if (!suggestedDescription && result.suggestedDescription) {
      suggestedDescription = result.suggestedDescription;
    }
  }

  if (!questions.length) {
    const error = new Error(
      "AI could not extract or build questions from this document. Try a clearer PDF or Word file."
    );
    error.statusCode = 422;
    throw error;
  }

  return {
    suggestedTitle,
    suggestedDescription,
    questions,
    meta: {
      generatedCount: questions.length,
      formats: [...new Set(questions.map((item) => item.type))],
      provider,
      model,
      mode: "document_stepwise",
      planMode: plan.mode,
      stepCount: steps.length,
    },
  };
}

function getDocumentPlan(sourceText) {
  const resolvedSource = String(sourceText || "").trim();
  if (!resolvedSource) {
    const error = new Error("The document did not contain readable text.");
    error.statusCode = 400;
    throw error;
  }

  const plan = planDocumentSteps(resolvedSource);
  return {
    mode: plan.mode,
    stepCount: plan.steps.length,
    steps: plan.steps.map((step, index) => ({
      index,
      format: step.format,
      sourceText: step.sourceText,
      preview: String(step.sourceText || "").slice(0, 160),
    })),
  };
}

async function requestAiQuestions({
  sourceText = "",
  topicPrompt = "",
  additionalInstructions = "",
  formats,
  questionCount,
  difficulty = "medium",
  mode = "document",
}) {
  assertPromptAiConfigured();

  const allowedFormats = parseFormats(formats);
  const count = clampQuestionCount(questionCount);
  const userPrompt = buildUserPrompt({ sourceText, topicPrompt, additionalInstructions });

  if (!userPrompt.trim()) {
    const error = new Error("Provide source text or a teacher prompt.");
    error.statusCode = 400;
    throw error;
  }

  const systemPrompt = buildSystemPrompt({
    formats: allowedFormats,
    questionCount: count,
    difficulty,
    mode,
  });

  const response = await requestPromptChatCompletion({
    temperature: 0.4,
    jsonMode: true,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const content = response.content;
  const normalized = await parseAiResponse(content, allowedFormats);

  if (!normalized.questions.length) {
    const error = new Error(
      "AI could not produce valid questions for the selected formats. Adjust your prompt or formats and try again."
    );
    error.statusCode = 422;
    throw error;
  }

  return {
    ...normalized,
    meta: {
      requestedCount: count,
      generatedCount: normalized.questions.length,
      formats: allowedFormats,
      provider: response.provider,
      model: response.model,
    },
  };
}

module.exports = {
  VALID_TYPES,
  ALL_FORMATS,
  clampQuestionCount,
  parseFormats,
  parsePromptPreferences,
  resolvePromptGenerationSettings,
  requestAiQuestions,
  requestAiQuestionsBatched,
  requestDocumentQuestions,
  requestDocumentQuestionsStepwise,
  classifyDocumentContent,
  getDocumentPlan,
  requestSingleAiQuestion,
  assertGeminiConfigured,
  getAiServiceStatus,
};
