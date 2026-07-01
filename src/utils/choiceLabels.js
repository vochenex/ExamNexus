export const CHOICE_LETTERS = ["A", "B", "C", "D"];

export function stripChoicePrefix(value) {
  return String(value || "").replace(/^[A-D]\.\s*/i, "").trim();
}

export function choiceLabel(index) {
  return CHOICE_LETTERS[index] || String(index + 1);
}

export function formatChoiceOptionLabel(choice, index) {
  const letter = choiceLabel(index);
  const text = stripChoicePrefix(choice);
  return text ? `${letter} — ${text}` : `${letter} — Choice ${index + 1}`;
}
