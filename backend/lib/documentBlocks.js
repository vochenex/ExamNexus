const MAX_BLOCKS = 25;

function splitDocumentIntoBlocks(text) {
  const normalized = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const lineStarts = [];
  const linePattern = /^(?:(?:question|item|no\.?)\s*)?(\d{1,2})[.)]\s+(.+)/gim;
  let match;

  while ((match = linePattern.exec(normalized)) !== null) {
    lineStarts.push({ index: match.index, number: Number.parseInt(match[1], 10) });
  }

  if (lineStarts.length === 0) {
    return [];
  }

  const blocks = [];
  for (let i = 0; i < lineStarts.length; i += 1) {
    const start = lineStarts[i].index;
    const end =
      i + 1 < lineStarts.length ? lineStarts[i + 1].index : normalized.length;
    const block = normalized.slice(start, end).trim();
    if (block.length > 15) {
      blocks.push(block);
    }
  }

  return blocks.slice(0, MAX_BLOCKS);
}

function estimateQuestionCountFromText(text) {
  const words = String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  if (words < 250) return 5;
  if (words < 600) return 8;
  if (words < 1200) return 12;
  return Math.min(20, Math.ceil(words / 120));
}

function inferFormatFromBlock(block) {
  const text = String(block || "");

  if (/\b(true|false)\b/i.test(text) && /true\s*or\s*false/i.test(text)) {
    return "true_false";
  }
  if (/(?:^|\n)\s*[A-D][.)]\s+/m.test(text)) {
    return "multiple_choice";
  }
  if (/\b(enumerate|list\s+all|name\s+all)\b/i.test(text)) {
    return "enumeration";
  }
  if (/\b(identify|fill\s+in|blank)\b/i.test(text)) {
    return "identification";
  }
  if (/\b(explain|discuss|essay|describe\s+in\s+detail)\b/i.test(text)) {
    return "essay";
  }

  return null;
}

function planDocumentSteps(sourceText) {
  const blocks = splitDocumentIntoBlocks(sourceText);

  if (blocks.length > 0) {
    return {
      mode: "existing_questions",
      steps: blocks.map((block) => ({
        sourceText: block,
        format: inferFormatFromBlock(block),
      })),
    };
  }

  const count = estimateQuestionCountFromText(sourceText);
  return {
    mode: "study_material",
    steps: Array.from({ length: count }, () => ({
      sourceText: String(sourceText || "").slice(0, 8000),
      format: null,
    })),
  };
}

module.exports = {
  splitDocumentIntoBlocks,
  estimateQuestionCountFromText,
  inferFormatFromBlock,
  planDocumentSteps,
  MAX_BLOCKS,
};
