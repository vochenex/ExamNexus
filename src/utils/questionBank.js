import { supabase } from "../supabaseClient";
import {
  deserializeQuestion,
  serializeQuestionForDb,
  getQuestionValidationMessage,
} from "./assessmentQuestions";
import { EXAM_TYPE_LABELS } from "./assessmentQuestions";
import { getAuthSession } from "./authUser";

function getCachedUser() {
  try {
    return JSON.parse(localStorage.getItem("examnexus_user") || "{}");
  } catch {
    return {};
  }
}

export function bankRowToBuilderQuestion(row) {
  const question = deserializeQuestion(row, row.question_type);
  const { id: _bankId, ...rest } = question;
  return {
    ...rest,
    type: row.question_type || question.type,
    bankId: row.id,
    bankTitle: row.title || "",
  };
}

export function builderQuestionToBankPayload(question, { teacherId, schoolId, title } = {}) {
  const type = question.type || question.question_type || "multiple_choice";
  const serialized = serializeQuestionForDb({ ...question, type }, type);
  const preview = String(serialized.question || "").trim();

  return {
    teacher_id: teacherId,
    school_id: schoolId,
    title: String(title || preview).trim().slice(0, 120) || "Untitled question",
    question_type: serialized.question_type,
    question: serialized.question,
    option_a: serialized.option_a,
    option_b: serialized.option_b,
    option_c: serialized.option_c,
    option_d: serialized.option_d,
    correct_answer: serialized.correct_answer,
    correct_answers: serialized.correct_answers,
    grading_options: serialized.grading_options,
    updated_at: new Date().toISOString(),
  };
}

export function getQuestionBankTypeLabel(type) {
  return EXAM_TYPE_LABELS[type] || type || "Question";
}

export async function fetchQuestionBank() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    throw new Error("Sign in to view your question bank.");
  }

  const { data, error } = await supabase
    .from("question_bank")
    .select("*")
    .eq("teacher_id", session.user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    if (
      error.message?.includes("Could not find the table") ||
      error.message?.includes("schema cache")
    ) {
      throw new Error(
        "Question bank is not set up yet. Run database/question_bank.sql in Supabase."
      );
    }
    throw error;
  }

  return data || [];
}

export async function saveQuestionToBank(question, title = "") {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    throw new Error("Sign in to save questions to your bank.");
  }

  const user = getCachedUser();
  const schoolId = user.school_id;
  if (!schoolId) {
    throw new Error("Your profile is missing a school ID.");
  }

  const validationMessage = getQuestionValidationMessage(question, question.type);
  if (validationMessage) {
    throw new Error(validationMessage);
  }

  const payload = builderQuestionToBankPayload(question, {
    teacherId: session.user.id,
    schoolId,
    title,
  });

  const { data, error } = await supabase
    .from("question_bank")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function updateQuestionBankEntry(bankId, question, title = "") {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    throw new Error("Sign in to update your question bank.");
  }

  const user = getCachedUser();
  const validationMessage = getQuestionValidationMessage(question, question.type);
  if (validationMessage) {
    throw new Error(validationMessage);
  }

  const payload = builderQuestionToBankPayload(question, {
    teacherId: session.user.id,
    schoolId: user.school_id,
    title,
  });

  const { data, error } = await supabase
    .from("question_bank")
    .update(payload)
    .eq("id", bankId)
    .eq("teacher_id", session.user.id)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function deleteQuestionBankEntry(bankId) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    throw new Error("Sign in to delete questions from your bank.");
  }

  const { error } = await supabase
    .from("question_bank")
    .delete()
    .eq("id", bankId)
    .eq("teacher_id", session.user.id);

  if (error) throw error;
}
