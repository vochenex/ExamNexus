import { getFormatLabel } from "./questionSections";

export function dedupeExamQuestions(questions = []) {
  const sorted = [...questions].sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    if (aTime !== bTime) return aTime - bTime;
    return String(a.id || "").localeCompare(String(b.id || ""));
  });

  const seenIds = new Set();
  const seenTextKeys = new Set();
  const unique = [];

  for (const question of sorted) {
    if (question?.id) {
      if (seenIds.has(question.id)) continue;
      seenIds.add(question.id);
    }

    const textKey = [
      String(question.question || "").trim().toLowerCase(),
      question.question_type || "",
      question.option_a || "",
      question.option_b || "",
    ].join("|");

    if (textKey.replace(/\|/g, "") && seenTextKeys.has(textKey)) continue;
    if (textKey.replace(/\|/g, "")) seenTextKeys.add(textKey);

    unique.push(question);
  }

  return unique;
}

export function getQuestionFormatType(question, examType) {
  return question?.question_type || examType || "multiple_choice";
}

export function groupQuestionsForNavigation(questions, examType) {
  const groups = [];
  const groupIndex = new Map();

  questions.forEach((question, index) => {
    const type = getQuestionFormatType(question, examType);
    if (!groupIndex.has(type)) {
      groupIndex.set(type, groups.length);
      groups.push({
        type,
        label: getFormatLabel(type),
        items: [],
      });
    }

    const group = groups[groupIndex.get(type)];
    group.items.push({
      index,
      questionId: question.id,
      number: group.items.length + 1,
    });
  });

  return groups;
}

export function isAnswerProvided(value, questionType) {
  if (value === undefined || value === null) return false;

  if (questionType === "enumeration") {
    return (
      Array.isArray(value) &&
      value.some((entry) => String(entry || "").trim() !== "")
    );
  }

  if (questionType === "multiple_choice" || questionType === "true_false") {
    return String(value).trim() !== "";
  }

  if (questionType === "essay") {
    return String(value).trim() !== "";
  }

  return String(value).trim() !== "";
}

export function countAnsweredQuestions(questions, examType, answersByQuestionId) {
  return questions.reduce((count, question) => {
    const type = getQuestionFormatType(question, examType);
    return count + (isAnswerProvided(answersByQuestionId[question.id], type) ? 1 : 0);
  }, 0);
}

export function isQuestionAnswered(question, examType, answersByQuestionId) {
  const type = getQuestionFormatType(question, examType);
  return isAnswerProvided(answersByQuestionId[question.id], type);
}

/** First format section that still has at least one unanswered item. */
export function getActiveSectionIndex(navGroups, questions, examType, answersByQuestionId) {
  for (let groupIndex = 0; groupIndex < navGroups.length; groupIndex += 1) {
    const group = navGroups[groupIndex];
    const sectionComplete = group.items.every((item) =>
      isQuestionAnswered(questions[item.index], examType, answersByQuestionId)
    );
    if (!sectionComplete) {
      return groupIndex;
    }
  }
  return Math.max(0, navGroups.length - 1);
}

/** Unlocked sections: current active section and all completed sections before it. */
export function isIndexNavigable(index, navGroups, questions, examType, answersByQuestionId) {
  const activeSection = getActiveSectionIndex(
    navGroups,
    questions,
    examType,
    answersByQuestionId
  );

  for (let groupIndex = 0; groupIndex < navGroups.length; groupIndex += 1) {
    const inGroup = navGroups[groupIndex].items.some((item) => item.index === index);
    if (inGroup) {
      return groupIndex <= activeSection;
    }
  }

  return false;
}

export function getAllUnansweredIndices(questions, examType, answersByQuestionId) {
  return questions.reduce((indices, question, index) => {
    if (!isQuestionAnswered(question, examType, answersByQuestionId)) {
      indices.push(index);
    }
    return indices;
  }, []);
}

export function getNextUnansweredIndex(
  currentIndex,
  questions,
  examType,
  answersByQuestionId,
  navGroups
) {
  const navigable = questions
    .map((_, index) => index)
    .filter((index) =>
      isIndexNavigable(index, navGroups, questions, examType, answersByQuestionId)
    );

  const unanswered = navigable.filter(
    (index) => !isQuestionAnswered(questions[index], examType, answersByQuestionId)
  );

  const forward = unanswered.filter((index) => index > currentIndex);
  if (forward.length > 0) {
    return forward[0];
  }

  return unanswered.find((index) => index !== currentIndex) ?? null;
}

export function getPreviousNavigableIndex(
  currentIndex,
  navGroups,
  questions,
  examType,
  answersByQuestionId
) {
  const navigable = questions
    .map((_, index) => index)
    .filter(
      (index) =>
        index < currentIndex &&
        isIndexNavigable(index, navGroups, questions, examType, answersByQuestionId)
    );

  return navigable.length > 0 ? navigable[navigable.length - 1] : null;
}

/** Show submit when all items are answered, or when on the sole remaining unanswered item. */
export function shouldShowSubmitButton(
  currentIndex,
  questions,
  examType,
  answersByQuestionId
) {
  const unanswered = getAllUnansweredIndices(questions, examType, answersByQuestionId);

  if (unanswered.length === 0) {
    return questions.length > 0;
  }

  return unanswered.length === 1 && unanswered[0] === currentIndex;
}

export function isSectionLocked(
  groupIndex,
  navGroups,
  questions,
  examType,
  answersByQuestionId
) {
  const activeSection = getActiveSectionIndex(
    navGroups,
    questions,
    examType,
    answersByQuestionId
  );
  return groupIndex > activeSection;
}

function hashSeed(value) {
  let hash = 0;
  const text = String(value || "");
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || 1;
}

export function shuffleQuestionsForStudent(questions, examId, studentId) {
  const seed = hashSeed(`${examId}-${studentId}`);
  const shuffled = [...questions];
  let state = seed;

  const random = () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

export function orderQuestionsByIds(questions, orderedIds) {
  if (!orderedIds?.length) return questions;

  const byId = new Map(questions.map((question) => [question.id, question]));
  const ordered = orderedIds.map((id) => byId.get(id)).filter(Boolean);
  const seen = new Set(ordered.map((question) => question.id));

  for (const question of questions) {
    if (!seen.has(question.id)) {
      ordered.push(question);
    }
  }

  return ordered;
}
