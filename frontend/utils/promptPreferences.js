const FORMAT_KEYWORDS = [
  { value: "multiple_choice", patterns: [/multiple\s*choice/i, /\bmcq\b/i, /\bmultiple-choice\b/i] },
  { value: "enumeration", patterns: [/enumeration/i, /\benumerate\b/i, /\blist\s+all\b/i] },
  { value: "identification", patterns: [/identification/i, /\bidentify\b/i, /\bfill\s+in\b/i] },
  { value: "true_false", patterns: [/true\s*or\s*false/i, /\btrue\/false\b/i, /\bt\/f\b/i] },
  { value: "essay", patterns: [/essay/i, /\bexplain\b/i, /\bdiscuss\b/i, /\bshort\s+answer\b/i] },
];

export function parsePromptPreferences(prompt) {
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
        questionCount = Math.min(150, parsed);
        break;
      }
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

export function resolvePromptGenerationSettings({
  prompt,
  questionCount,
  difficulty,
  formats,
}) {
  const parsed = parsePromptPreferences(prompt);
  const uiCount = Number.parseInt(questionCount, 10);
  const hasUiCount = Number.isFinite(uiCount) && uiCount > 0;

  return {
    questionCount: parsed.questionCount ?? (hasUiCount ? uiCount : 8),
    difficulty: parsed.difficulty ?? difficulty ?? "medium",
    formats:
      Array.isArray(formats) && formats.length > 0
        ? formats
        : parsed.formats.length
          ? parsed.formats
          : formats,
  };
}
