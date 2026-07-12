import { supabase } from "../supabaseClient";
import { canFacultyManageSubjects, FACULTY_AVATAR_REQUIRED_MESSAGE } from "./avatar";
import {
  normalizeTargetSections,
  isVisibleToSection,
  normalizeSectionCount,
  getSubjectSections,
} from "./sections";
import {
  normalizeAssessmentCategory,
  embedAssessmentCategoryInDescription,
  enrichExamRecord,
} from "./assessmentCategories";
import { getAuthSession } from "./authUser";
import {
  gradeStudentAnswer,
  formatStoredAnswer,
  isAutoGradedType,
  normalizeExamTypeForDb,
} from "./assessmentQuestions";
import {
  normalizeResultRow,
  buildStudentAnalytics,
  mergeSectionStandings,
} from "./studentAnalytics";
import { getAssessmentStatus } from "./assessmentStatus";
import { buildSubjectClassAnalytics } from "./subjectClassAnalytics";
import { normalizeYearLevelForStorage } from "./yearLevels";
import { durationFieldsForDb } from "./assessmentDuration";
import { dedupeExamQuestions } from "./assessmentTake";
import {
  dispatchPushToUsers,
  dispatchSubjectAnnouncementPush,
} from "./pushDispatch.js";
import {
  buildExamFacultyAnalytics,
  buildSubmissionAlertRankings,
} from "./examAnalytics";
import { INTEGRITY_EVENT_TYPES } from "./examIntegrity";
import {
  computeSubmissionTotals,
  getQuestionMaxPoints,
} from "./facultyGrading";

function isMissingRpcError(error) {
  const message = error?.message || "";
  return (
    message.includes("Could not find the function") ||
    message.includes("schema cache")
  );
}

function dedupeSubjectsById(subjects) {
  const seen = new Map();
  for (const subject of subjects || []) {
    if (subject?.id && !seen.has(subject.id)) {
      seen.set(subject.id, subject);
    }
  }
  return [...seen.values()];
}

async function enrichSubjectsWithFaculty(subjects) {
  const deduped = dedupeSubjectsById(subjects);
  if (!deduped.length) return [];

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "get_student_enrolled_subjects"
  );

  if (!rpcError && Array.isArray(rpcData) && rpcData.length) {
    const rpcById = new Map(rpcData.map((subject) => [subject.id, subject]));
    return deduped.map((subject) => {
      const fromRpc = rpcById.get(subject.id);
      return fromRpc ? { ...subject, ...fromRpc } : subject;
    });
  }

  const schoolIds = [
    ...new Set(deduped.map((s) => s.teacher_school_id).filter(Boolean)),
  ];

  if (!schoolIds.length) return deduped;

  const { data: facultyRows, error: facultyError } = await supabase
    .from("users")
    .select("school_id, first_name, last_name, avatar_url")
    .in("school_id", schoolIds)
    .ilike("role", "faculty");

  if (facultyError || !facultyRows?.length) return deduped;

  const facultyBySchool = new Map();
  for (const faculty of facultyRows) {
    if (!facultyBySchool.has(faculty.school_id)) {
      facultyBySchool.set(faculty.school_id, faculty);
    }
  }

  return deduped.map((subject) => {
    const faculty = facultyBySchool.get(subject.teacher_school_id);
    if (!faculty) return subject;

    return {
      ...subject,
      faculty_first_name: faculty.first_name,
      faculty_last_name: faculty.last_name,
      faculty_avatar_url: faculty.avatar_url,
    };
  });
}

export function generateInviteCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function requireSession() {
  const session = await getAuthSession();

  if (!session) {
    throw new Error("Your session expired. Please log out and log in again.");
  }

  return session;
}

function normalizeClassmatesList(data, currentUserId) {
  let list = [];

  if (Array.isArray(data)) {
    list = data;
  } else if (data && typeof data === "object") {
    if (Array.isArray(data.classmates)) {
      list = data.classmates;
    } else if (data.id || data.student_id) {
      list = [data];
    }
  } else if (typeof data === "string") {
    try {
      return normalizeClassmatesList(JSON.parse(data), currentUserId);
    } catch {
      list = [];
    }
  }

  return list.map((row) => ({
    ...row,
    id: row.id || row.student_id,
    section: String(row.section || "A").toUpperCase(),
    is_you:
      row.id === currentUserId ||
      row.student_id === currentUserId ||
      row.is_you === true,
  }));
}

async function fetchSubjectClassmatesDirect(
  subjectId,
  currentUserId,
  sectionFilter = null
) {
  const { data: enrollments, error: enrollmentError } = await supabase
    .from("subject_students")
    .select("student_id, section")
    .eq("subject_id", subjectId);

  if (enrollmentError) throw enrollmentError;

  const normalizedSection = sectionFilter
    ? String(sectionFilter).toUpperCase()
    : null;

  const scopedEnrollments = (enrollments || []).filter((row) => {
    if (!normalizedSection) return true;
    return String(row.section || "A").toUpperCase() === normalizedSection;
  });

  const studentIds = [
    ...new Set(scopedEnrollments.map((row) => row.student_id).filter(Boolean)),
  ];

  if (!studentIds.length) return [];

  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, first_name, last_name, avatar_url, school_id")
    .in("id", studentIds);

  if (usersError) throw usersError;

  const usersById = new Map((users || []).map((user) => [user.id, user]));
  const sectionByStudent = new Map(
    scopedEnrollments.map((row) => [
      row.student_id,
      String(row.section || "A").toUpperCase(),
    ])
  );

  return studentIds.map((studentId) => {
    const user = usersById.get(studentId);

    return {
      id: studentId,
      first_name: user?.first_name || "Student",
      last_name: user?.last_name || "",
      avatar_url: user?.avatar_url || null,
      school_id: user?.school_id || null,
      section: sectionByStudent.get(studentId) || "A",
      is_you: studentId === currentUserId,
    };
  });
}

export async function createSubject(name, teacherSchoolId, yearLevel, sectionCount = 3) {
  await requireSession();

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user?.id) {
    const { data: facultyUser, error: facultyError } = await supabase
      .from("users")
      .select("role, avatar_url")
      .eq("id", session.user.id)
      .single();

    if (!facultyError && facultyUser && !canFacultyManageSubjects(facultyUser)) {
      throw new Error(FACULTY_AVATAR_REQUIRED_MESSAGE);
    }
  }

  const normalizedSectionCount = normalizeSectionCount(sectionCount);

  const row = {
    name: name.trim(),
    teacher_school_id: teacherSchoolId,
    invite_code: generateInviteCode(),
    year_level: yearLevel || "1st_year",
    section_count: normalizedSectionCount,
  };

  let { data, error } = await supabase
    .from("subjects")
    .insert([row])
    .select()
    .single();

  if (error?.message?.includes("year_level") || error?.message?.includes("section_count")) {
    const fallbackRow = {
      name: name.trim(),
      teacher_school_id: teacherSchoolId,
      invite_code: generateInviteCode(),
    };

    if (!error?.message?.includes("year_level")) {
      fallbackRow.year_level = yearLevel || "1st_year";
    }

    if (!error?.message?.includes("section_count")) {
      fallbackRow.section_count = normalizedSectionCount;
    }

    ({ data, error } = await supabase
      .from("subjects")
      .insert([fallbackRow])
      .select()
      .single());
  }

  if (error) throw error;
  return data;
}

export async function updateSubject(subjectId, updates) {
  await requireSession();

  const payload = { ...updates };

  if (payload.section_count !== undefined) {
    payload.section_count = normalizeSectionCount(payload.section_count);
  }

  let { data, error } = await supabase
    .from("subjects")
    .update(payload)
    .eq("id", subjectId)
    .select()
    .single();

  if (error?.message?.includes("section_count") && payload.section_count !== undefined) {
    const { section_count: _removed, ...rest } = payload;
    ({ data, error } = await supabase
      .from("subjects")
      .update(rest)
      .eq("id", subjectId)
      .select()
      .single());
  }

  if (error) throw error;
  return data;
}

export async function deleteSubjectById(subjectId) {
  await requireSession();

  const { error } = await supabase
    .from("subjects")
    .delete()
    .eq("id", subjectId);

  if (error) throw error;
}

export async function fetchTeacherSubjects(teacherSchoolId) {
  await requireSession();

  const { data, error } = await supabase
    .from("subjects")
    .select("*")
    .eq("teacher_school_id", teacherSchoolId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchSubject(subjectId) {
  await requireSession();

  const { data, error } = await supabase
    .from("subjects")
    .select("*")
    .eq("id", subjectId)
    .single();

  if (error) throw error;
  return data;
}

export async function fetchSubjectFaculty(subject) {
  if (!subject?.teacher_school_id) return null;

  const { data, error } = await supabase
    .from("users")
    .select("id, first_name, last_name, email, avatar_url, department, school_id")
    .eq("school_id", subject.teacher_school_id)
    .ilike("role", "faculty")
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchSubjectClassmates(subjectId, { sectionFilter = null } = {}) {
  const session = await requireSession();
  const currentUserId = session.user.id;

  const { data, error } = await supabase.rpc("get_subject_classmates", {
    p_subject_id: subjectId,
  });

  if (!error && data) {
    const classmates = normalizeClassmatesList(data, currentUserId);
    if (classmates.length > 0) {
      return filterClassmatesBySection(classmates, sectionFilter);
    }
  }

  if (
    error &&
    !error.message?.includes("Could not find the function") &&
    !error.message?.includes("Not authenticated") &&
    !error.message?.includes("Access denied")
  ) {
    console.warn("get_subject_classmates RPC failed, using direct query:", error.message);
  }

  const resolvedSection =
    sectionFilter ||
    (await fetchStudentEnrollmentSection(currentUserId, subjectId));

  return fetchSubjectClassmatesDirect(
    subjectId,
    currentUserId,
    resolvedSection
  );
}

function filterClassmatesBySection(classmates, section) {
  if (!section) return classmates;

  const normalized = String(section).toUpperCase();
  return classmates.filter(
    (row) => String(row.section || "A").toUpperCase() === normalized
  );
}

export async function unenrollStudentFromSubject(subjectId) {
  await requireSession();

  const { data, error } = await supabase.rpc("unenroll_student_from_subject", {
    p_subject_id: subjectId,
  });

  if (error) {
    if (error.message?.includes("unenroll_student_from_subject")) {
      const session = await requireSession();
      const { error: deleteError } = await supabase
        .from("subject_students")
        .delete()
        .eq("subject_id", subjectId)
        .eq("student_id", session.user.id);

      if (deleteError) throw deleteError;
      return { subject_id: subjectId };
    }

    throw error;
  }

  return data;
}

export async function fetchStudentEnrollmentSection(studentId, subjectId) {
  const { data, error } = await supabase
    .from("subject_students")
    .select("section")
    .eq("student_id", studentId)
    .eq("subject_id", subjectId)
    .maybeSingle();

  if (error) throw error;
  return data?.section || "A";
}

export async function fetchSubjectAssessments(subjectId) {
  await requireSession();

  const { data, error } = await supabase
    .from("exams")
    .select("*")
    .eq("subject_id", subjectId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(enrichExamRecord);
}

export async function fetchSubjectClassAnalytics(subjectId) {
  await requireSession();

  const exams = await fetchSubjectAssessments(subjectId);
  const examIds = exams.map((exam) => exam.id);

  if (!examIds.length) {
    return buildSubjectClassAnalytics([], []);
  }

  const { data: results, error } = await supabase
    .from("exam_results")
    .select("exam_id, score, total, student_id")
    .in("exam_id", examIds);

  if (error) throw error;

  return buildSubjectClassAnalytics(exams, results || []);
}

function profileFieldsFromSession(session, fields = {}) {
  const meta = session.user.user_metadata || {};

  return {
    first_name: String(fields.first_name ?? meta.first_name ?? "").trim(),
    last_name: String(fields.last_name ?? meta.last_name ?? "").trim(),
    email: String(fields.email ?? session.user.email ?? "").trim(),
    school_id: String(fields.school_id ?? meta.school_id ?? meta.schoolId ?? "").trim(),
    role: String(fields.role ?? meta.role ?? "Student").trim(),
    gender: fields.gender ?? meta.gender ?? null,
    department: fields.department ?? meta.department ?? null,
    course: fields.course ?? meta.course ?? null,
    year_level: fields.year_level ?? meta.year_level ?? null,
    avatar_url: fields.avatar_url ?? null,
  };
}

async function ensureUserProfileRow() {
  const { error } = await supabase.rpc("ensure_user_profile");
  if (error) {
    console.warn("ensure_user_profile:", error.message);
  }
}

export async function updateUserAvatar(avatarUrl) {
  const session = await requireSession();
  const userId = session.user.id;
  const url = String(avatarUrl || "").trim();

  if (!url) {
    throw new Error("Avatar URL is required.");
  }

  await ensureUserProfileRow();

  const { data: rpcData, error: rpcError } = await supabase.rpc("update_user_avatar", {
    p_avatar_url: url,
  });

  if (!rpcError && rpcData) {
    return rpcData;
  }

  const base = profileFieldsFromSession(session);
  const { data: upserted, error: upsertError } = await supabase.rpc(
    "upsert_signup_profile",
    {
      p_first_name: base.first_name,
      p_last_name: base.last_name,
      p_email: base.email,
      p_school_id: base.school_id,
      p_role: base.role,
      p_gender: base.gender,
      p_department: base.department,
      p_course: base.course,
      p_year_level: base.year_level,
      p_age: null,
      p_avatar_url: url,
    }
  );

  if (!upsertError && upserted) {
    return upserted;
  }

  const { data: updated, error: updateError } = await supabase
    .from("users")
    .update({ avatar_url: url })
    .eq("id", userId)
    .select("*")
    .maybeSingle();

  if (!updateError && updated) {
    return updated;
  }

  throw new Error(
    rpcError?.message ||
      upsertError?.message ||
      updateError?.message ||
      "Failed to save avatar."
  );
}

export async function updateUserProfile(userId, fields) {
  const session = await requireSession();

  if (session.user.id !== userId) {
    throw new Error("You can only update your own profile.");
  }

  await ensureUserProfileRow();

  const base = profileFieldsFromSession(session, fields);
  const ageValue = fields.age;
  const parsedAge =
    ageValue === "" || ageValue === null || ageValue === undefined
      ? null
      : Number(ageValue);

  const yearLevel = normalizeYearLevelForStorage(fields.year_level);

  const payload = {
    p_first_name: base.first_name,
    p_last_name: base.last_name,
    p_gender: fields.gender || null,
    p_department: fields.department || null,
    p_course: fields.course || null,
    p_year_level: yearLevel,
    p_age:
      ageValue === "" || ageValue === null || ageValue === undefined
        ? null
        : Number.isFinite(parsedAge)
          ? String(parsedAge)
          : null,
    p_avatar_url: fields.avatar_url || null,
  };

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "update_user_editable_profile",
    payload
  );

  if (!rpcError && rpcData) {
    return rpcData;
  }

  const { data: upserted, error: upsertError } = await supabase.rpc(
    "upsert_signup_profile",
    {
      p_first_name: base.first_name,
      p_last_name: base.last_name,
      p_email: base.email,
      p_school_id: base.school_id,
      p_role: base.role,
      p_gender: fields.gender || null,
      p_department: fields.department || null,
      p_course: fields.course || null,
      p_year_level: yearLevel,
      p_age: Number.isFinite(parsedAge) ? parsedAge : null,
      p_avatar_url: fields.avatar_url || null,
    }
  );

  if (!upsertError && upserted) {
    return upserted;
  }

  const { data, error } = await supabase
    .from("users")
    .update({
      first_name: base.first_name || null,
      last_name: base.last_name || null,
      gender: fields.gender || null,
      department: fields.department || null,
      course: fields.course || null,
      year_level: yearLevel,
      age: Number.isFinite(parsedAge) ? parsedAge : null,
      avatar_url: fields.avatar_url || null,
    })
    .eq("id", userId)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to save profile.");
  }

  if (!data) {
    throw new Error(
      rpcError?.message ||
        upsertError?.message ||
        "Profile update was blocked. Run database/fix_avatar_upload.sql in Supabase."
    );
  }

  return data;
}

export async function createExam(examPayload, questions) {
  await requireSession();

  let exam = null;

  const category = normalizeAssessmentCategory(examPayload.assessment_category);
  const descriptionWithCategory = embedAssessmentCategoryInDescription(
    examPayload.description || "",
    category
  );

  const durationFields = durationFieldsForDb(examPayload);

  const examRow = {
    subject_id: examPayload.subject_id,
    title: examPayload.title,
    description: descriptionWithCategory,
    exam_type: normalizeExamTypeForDb(examPayload.exam_type),
    assessment_category: category,
    start_datetime: examPayload.start_datetime,
    end_datetime: examPayload.end_datetime,
    created_by: examPayload.created_by || null,
    target_sections: normalizeTargetSections(examPayload.target_sections),
    instructions: examPayload.instructions || "",
    shuffle_questions: Boolean(examPayload.shuffle_questions),
    lock_completed_sections:
      Boolean(examPayload.lock_completed_sections) ||
      Boolean(examPayload.shuffle_questions),
    allow_review: examPayload.allow_review !== false,
    allow_student_view: examPayload.show_result !== false,
    allow_question_review:
      examPayload.show_result !== false && examPayload.show_question_review !== false,
    allow_show_correct_answers:
      examPayload.show_result !== false &&
      examPayload.show_question_review !== false &&
      examPayload.show_correct_answers !== false,
    duration_value: durationFields.duration_value,
    duration_unit: durationFields.duration_unit,
  };

  const { data: createdExam, error: examError } = await supabase
    .from("exams")
    .insert([examRow])
    .select()
    .single();

  if (examError?.message?.includes("assessment_category")) {
    const { assessment_category, ...fallbackRow } = examRow;
    const { data: fallbackExam, error: fallbackError } = await supabase
      .from("exams")
      .insert([fallbackRow])
      .select()
      .single();

    if (fallbackError) throw fallbackError;
    exam = fallbackExam;
  } else if (examError?.message?.includes("column")) {
    const rowWithoutVisibility = { ...examRow };
    delete rowWithoutVisibility.allow_question_review;
    delete rowWithoutVisibility.allow_student_view;
    delete rowWithoutVisibility.allow_show_correct_answers;
    delete rowWithoutVisibility.lock_completed_sections;

    const fallbackRows = [
      rowWithoutVisibility,
      {
        subject_id: examRow.subject_id,
        title: examRow.title,
        description: descriptionWithCategory,
        exam_type: examRow.exam_type,
        assessment_category: category,
        start_datetime: examRow.start_datetime,
        end_datetime: examRow.end_datetime,
        created_by: examRow.created_by,
        target_sections: examRow.target_sections,
        instructions: examRow.instructions,
        shuffle_questions: examRow.shuffle_questions,
        allow_review: examRow.allow_review,
        duration_value: examRow.duration_value,
        duration_unit: examRow.duration_unit,
      },
      {
        subject_id: examRow.subject_id,
        title: examRow.title,
        description: descriptionWithCategory,
        exam_type: examRow.exam_type,
        start_datetime: examRow.start_datetime,
        end_datetime: examRow.end_datetime,
        created_by: examRow.created_by,
        target_sections: examRow.target_sections,
        duration_value: examRow.duration_value,
        duration_unit: examRow.duration_unit,
      },
      {
        subject_id: examRow.subject_id,
        title: examRow.title,
        description: descriptionWithCategory,
        exam_type: examRow.exam_type,
        start_datetime: examRow.start_datetime,
        end_datetime: examRow.end_datetime,
        created_by: examRow.created_by,
        target_sections: examRow.target_sections,
      },
    ];

    let fallbackExam = null;
    let fallbackError = examError;

    for (const row of fallbackRows) {
      const { data, error } = await supabase.from("exams").insert([row]).select().single();
      if (!error) {
        fallbackExam = data;
        break;
      }
      fallbackError = error;
    }

    if (!fallbackExam) throw fallbackError;
    exam = fallbackExam;
  } else if (examError) {
    if (examError.message?.includes("exams_exam_type_check")) {
      throw new Error(
        "Invalid question format for this assessment. Run database/exam_type_check.sql in Supabase SQL Editor, then try again."
      );
    }
    throw examError;
  } else {
    exam = createdExam;
  }

  const formattedQuestions = questions
    .filter((q) => q.question?.trim())
    .map((q) => {
      const row = {
        exam_id: exam.id,
        question: q.question,
        option_a: q.option_a || "",
        option_b: q.option_b || "",
        option_c: q.option_c || "",
        option_d: q.option_d || "",
        correct_answer: q.correct_answer || "",
      };

      if (q.question_type) {
        row.question_type = q.question_type;
      }

      if (q.correct_answers !== undefined && q.correct_answers !== null) {
        row.correct_answers = q.correct_answers;
      }

      if (q.grading_options) {
        row.grading_options = q.grading_options;
      }

      return row;
    });

  if (formattedQuestions.length === 0) {
    throw new Error("No questions provided");
  }

  await insertExamQuestions(exam.id, formattedQuestions);

  try {
    const { data: enrolled } = await supabase
      .from("subject_students")
      .select("student_id, section")
      .eq("subject_id", exam.subject_id);

    const sections = normalizeTargetSections(exam.target_sections);
    const recipientIds = (enrolled || [])
      .filter((row) => isVisibleToSection(sections, row.section))
      .map((row) => row.student_id);

    await dispatchPushToUsers({
      userIds: recipientIds,
      title: exam.title || "New assessment",
      body: "A new assessment was posted. Open ExamNexus to view details.",
      data: {
        kind: "assessment",
        path: `/student/assessments?focus=${exam.id}`,
        exam_id: exam.id,
        subject_id: exam.subject_id || "",
      },
    });
  } catch (err) {
    console.warn("Assessment push skipped:", err?.message || err);
  }

  return exam;
}

async function insertExamQuestions(examId, formattedQuestions) {
  const attempts = [
    (rows) => rows,
    (rows) => rows.map(({ correct_answers, ...rest }) => rest),
    (rows) => rows.map(({ grading_options, ...rest }) => rest),
    (rows) =>
      rows.map(({ question_type, grading_options, correct_answers, ...rest }) => rest),
  ];

  let lastError = null;

  for (const transform of attempts) {
    const payload = transform(formattedQuestions).map((row) => ({
      ...row,
      exam_id: examId,
    }));

    const { error } = await supabase.from("questions").insert(payload);

    if (!error) {
      return;
    }

    lastError = error;

    const retryable =
      error.message?.includes("column") ||
      error.message?.includes("Could not find") ||
      error.message?.includes("schema cache");

    if (!retryable) {
      break;
    }

    await supabase.from("questions").delete().eq("exam_id", examId);
  }

  throw lastError || new Error("Failed to save assessment questions.");
}

export async function fetchExamWithQuestions(examId) {
  await requireSession();

  const { data: exam, error: examError } = await supabase
    .from("exams")
    .select("*")
    .eq("id", examId)
    .single();

  if (examError) throw examError;

  const { data: questions, error: qError } = await supabase
    .from("questions")
    .select("*")
    .eq("exam_id", examId)
    .order("created_at", { ascending: true });

  if (qError) throw qError;

  return {
    exam: enrichExamRecord(exam),
    questions: dedupeExamQuestions(questions || []),
  };
}

async function updateExamRowWithColumnFallback(examId, examUpdate) {
  const attempts = [
    examUpdate,
    (() => {
      const next = { ...examUpdate };
      delete next.lock_completed_sections;
      return next;
    })(),
    (() => {
      const next = { ...examUpdate };
      delete next.lock_completed_sections;
      delete next.assessment_category;
      return next;
    })(),
    {
      title: examUpdate.title,
      description: examUpdate.description,
      exam_type: examUpdate.exam_type,
      start_datetime: examUpdate.start_datetime,
      end_datetime: examUpdate.end_datetime,
      target_sections: examUpdate.target_sections,
      instructions: examUpdate.instructions,
      shuffle_questions: examUpdate.shuffle_questions,
      allow_review: examUpdate.allow_review,
      allow_student_view: examUpdate.allow_student_view,
      allow_question_review: examUpdate.allow_question_review,
      allow_show_correct_answers: examUpdate.allow_show_correct_answers,
      duration_value: examUpdate.duration_value,
      duration_unit: examUpdate.duration_unit,
    },
    {
      title: examUpdate.title,
      description: examUpdate.description,
      exam_type: examUpdate.exam_type,
      start_datetime: examUpdate.start_datetime,
      end_datetime: examUpdate.end_datetime,
      target_sections: examUpdate.target_sections,
      allow_student_view: examUpdate.allow_student_view,
      allow_question_review: examUpdate.allow_question_review,
      allow_show_correct_answers: examUpdate.allow_show_correct_answers,
    },
    {
      title: examUpdate.title,
      description: examUpdate.description,
      exam_type: examUpdate.exam_type,
      start_datetime: examUpdate.start_datetime,
      end_datetime: examUpdate.end_datetime,
      target_sections: examUpdate.target_sections,
    },
  ];

  let lastError = null;
  for (const payload of attempts) {
    const cleaned = Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== undefined)
    );
    const { error } = await supabase.from("exams").update(cleaned).eq("id", examId);
    if (!error) return;
    lastError = error;
    if (!error.message?.includes("column")) {
      throw error;
    }
  }

  throw lastError;
}

/** Student result detail with question review (RPC with direct-query fallback). */
export async function fetchStudentExamResultReview(examId, studentId) {
  await requireSession();

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "get_student_exam_result_review",
    {
      p_exam_id: examId,
      p_student_id: studentId || null,
    }
  );

  if (!rpcError && rpcData) {
    return {
      exam: rpcData.exam || null,
      result: rpcData.result || null,
      questions: dedupeExamQuestions(rpcData.questions || []),
      answers: rpcData.answers || [],
      showScore: rpcData.show_score !== false,
      showQuestionReview: rpcData.show_question_review !== false,
      showCorrectAnswers: rpcData.show_correct_answers !== false,
      source: "rpc",
    };
  }

  const [
    { data: examData, error: examError },
    { data: resultData, error: resultError },
    { data: questionData, error: questionError },
    { data: answerData, error: answerError },
  ] = await Promise.all([
    supabase.from("exams").select("*").eq("id", examId).single(),
    supabase
      .from("exam_results")
      .select("*")
      .eq("exam_id", examId)
      .eq("student_id", studentId)
      .single(),
    supabase
      .from("questions")
      .select("*")
      .eq("exam_id", examId)
      .order("created_at", { ascending: true }),
    supabase
      .from("student_answers")
      .select("*")
      .eq("exam_id", examId)
      .eq("student_id", studentId),
  ]);

  if (examError) throw examError;
  if (resultError) throw resultError;
  if (questionError) throw questionError;
  if (answerError) throw answerError;

  const showScore = examData?.allow_student_view !== false;
  const showQuestionReview =
    showScore && examData?.allow_question_review !== false;
  const showCorrectAnswers =
    showQuestionReview && examData?.allow_show_correct_answers !== false;

  let questions = dedupeExamQuestions(questionData || []);
  if (!showCorrectAnswers) {
    questions = questions.map((question) => ({
      ...question,
      correct_answer: null,
      correct_answers: null,
      grading_options: null,
    }));
  }

  return {
    exam: examData
      ? {
          ...examData,
          allow_student_view: showScore,
          allow_question_review: showQuestionReview,
          allow_show_correct_answers: showCorrectAnswers,
        }
      : null,
    result: resultData,
    questions: showQuestionReview ? questions : [],
    answers: showQuestionReview ? answerData || [] : [],
    showScore,
    showQuestionReview,
    showCorrectAnswers,
    source: "direct",
  };
}

export async function updateExam(examId, exam, questions) {
  await requireSession();

  const category = normalizeAssessmentCategory(exam.assessment_category);
  const descriptionWithCategory = embedAssessmentCategoryInDescription(
    exam.description || "",
    category
  );

  const durationFields = durationFieldsForDb(exam);

  const examUpdate = {
    title: exam.title,
    description: descriptionWithCategory,
    exam_type: normalizeExamTypeForDb(exam.exam_type),
    assessment_category: category,
    start_datetime: exam.start_datetime,
    end_datetime: exam.end_datetime,
    target_sections: normalizeTargetSections(exam.target_sections),
    instructions: exam.instructions || "",
    shuffle_questions: Boolean(exam.shuffle_questions),
    lock_completed_sections:
      Boolean(exam.lock_completed_sections) || Boolean(exam.shuffle_questions),
    allow_review: exam.allow_review !== false,
    allow_student_view: exam.show_result !== false,
    allow_question_review:
      exam.show_result !== false && exam.show_question_review !== false,
    allow_show_correct_answers:
      exam.show_result !== false &&
      exam.show_question_review !== false &&
      exam.show_correct_answers !== false,
    duration_value: durationFields.duration_value,
    duration_unit: durationFields.duration_unit,
  };

  const { error: examError } = await supabase
    .from("exams")
    .update(examUpdate)
    .eq("id", examId);

  if (examError?.message?.includes("assessment_category")) {
    const { assessment_category, ...fallbackUpdate } = examUpdate;
    const { error: fallbackError } = await supabase
      .from("exams")
      .update(fallbackUpdate)
      .eq("id", examId);

    if (fallbackError?.message?.includes("column")) {
      await updateExamRowWithColumnFallback(examId, fallbackUpdate);
    } else if (fallbackError) {
      throw fallbackError;
    }
  } else if (examError?.message?.includes("column")) {
    await updateExamRowWithColumnFallback(examId, examUpdate);
  } else if (examError) {
    throw examError;
  }

  const { data: existingQuestions, error: existingError } = await supabase
    .from("questions")
    .select("id")
    .eq("exam_id", examId);

  if (existingError) throw existingError;

  const incomingIds = questions.filter((q) => q.id).map((q) => q.id);
  const deletedIds = (existingQuestions || [])
    .filter((q) => !incomingIds.includes(q.id))
    .map((q) => q.id);

  if (deletedIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("questions")
      .delete()
      .in("id", deletedIds);

    if (deleteError) throw deleteError;
  }

  for (const q of questions) {
    const row = {
      question: q.question,
      option_a: q.option_a || "",
      option_b: q.option_b || "",
      option_c: q.option_c || "",
      option_d: q.option_d || "",
      correct_answer: q.correct_answer || "",
    };

    if (q.question_type) {
      row.question_type = q.question_type;
    }

    if (q.correct_answers !== undefined && q.correct_answers !== null) {
      row.correct_answers = q.correct_answers;
    }

    if (q.grading_options) {
      row.grading_options = q.grading_options;
    }

    if (q.id) {
      let { error: qError } = await supabase
        .from("questions")
        .update(row)
        .eq("id", q.id);

      if (qError?.message?.includes("question_type")) {
        const { question_type: _removed, ...fallbackRow } = row;
        ({ error: qError } = await supabase
          .from("questions")
          .update(fallbackRow)
          .eq("id", q.id));
      }

      if (qError) throw qError;
    } else if (q.question?.trim()) {
      let { error: qError } = await supabase.from("questions").insert([
        {
          exam_id: examId,
          ...row,
        },
      ]);

      if (qError?.message?.includes("question_type")) {
        const { question_type: _removed, ...fallbackRow } = row;
        ({ error: qError } = await supabase.from("questions").insert([
          {
            exam_id: examId,
            ...fallbackRow,
          },
        ]));
      }

      if (qError) throw qError;
    }
  }
}

export async function submitStudentExam({
  examId,
  studentId: _legacyStudentId,
  examType,
  questions,
  answersByQuestionId,
  answersByIndex,
  timeSpentByQuestionId = {},
  autoSubmitted = false,
}) {
  const session = await requireSession();
  const studentId = session.user.id;

  let score = 0;
  let total = 0;
  const answerLogs = [];

  questions.forEach((question, index) => {
    const rawAnswer =
      answersByQuestionId?.[question.id] ?? answersByIndex?.[index];
    const questionType = question.question_type || examType;
    const { isCorrect, pendingReview } = gradeStudentAnswer(
      question,
      questionType,
      rawAnswer
    );

    if (!pendingReview) {
      total += 1;
      if (isCorrect) score += 1;
    }

    const timeSpent = Number(timeSpentByQuestionId?.[question.id]);
    const log = {
      question_id: question.id,
      student_id: studentId,
      exam_id: examId,
      answer: formatStoredAnswer(rawAnswer, questionType),
      is_correct: pendingReview ? null : isCorrect,
    };

    if (Number.isFinite(timeSpent) && timeSpent >= 0) {
      log.time_spent_seconds = Math.round(timeSpent);
    } else if (Object.prototype.hasOwnProperty.call(timeSpentByQuestionId, question.id)) {
      log.time_spent_seconds = 0;
    }

    answerLogs.push(log);
  });

  await supabase.rpc("prepare_retake_submission", { p_exam_id: examId });

  const { data: existingResult, error: existingError } = await supabase
    .from("exam_results")
    .select("id")
    .eq("exam_id", examId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existingResult?.id) {
    throw new Error("You have already submitted this assessment.");
  }

  const resultRow = {
    exam_id: examId,
    student_id: studentId,
    score,
    total: total || questions.length,
  };

  if (autoSubmitted) {
    resultRow.auto_submitted = true;
  }

  let { error: resultError } = await supabase.from("exam_results").insert([resultRow]);

  if (
    resultError?.message?.includes("auto_submitted") ||
    resultError?.message?.includes("does not exist")
  ) {
    const { auto_submitted: _removed, ...fallbackRow } = resultRow;
    ({ error: resultError } = await supabase.from("exam_results").insert([fallbackRow]));
  }

  if (resultError) throw resultError;

  let { error: answersError } = await supabase
    .from("student_answers")
    .insert(answerLogs);

  if (
    answersError?.message?.includes("time_spent_seconds") ||
    answersError?.message?.includes("does not exist")
  ) {
    const fallbackLogs = answerLogs.map(
      ({ time_spent_seconds: _removed, ...rest }) => rest
    );
    ({ error: answersError } = await supabase
      .from("student_answers")
      .insert(fallbackLogs));
  }

  if (answersError) throw answersError;

  if (autoSubmitted) {
    const { error: integrityError } = await supabase.from("exam_integrity_events").insert([
      {
        exam_id: examId,
        student_id: studentId,
        event_type: INTEGRITY_EVENT_TYPES.AUTO_SUBMIT,
        description:
          "Assessment auto-submitted after reaching the maximum number of integrity violations.",
        metadata: { auto_submitted: true },
      },
    ]);

    if (integrityError && !integrityError.message?.includes("exam_integrity_events")) {
      console.warn("auto_submit integrity log:", integrityError.message);
    }
  }

  await supabase.rpc("mark_retake_fulfilled", { p_exam_id: examId }).then(({ error }) => {
    if (error && !error.message?.includes("mark_retake_fulfilled")) {
      console.warn("mark_retake_fulfilled:", error.message);
    }
  });

  const pendingEssays = questions.filter(
    (question) => (question.question_type || examType) === "essay"
  ).length;

  return {
    score,
    total: total || questions.length,
    pendingEssays,
    autoGraded: pendingEssays < questions.length,
  };
}

export async function logExamIntegrityEvent({
  examId,
  eventType,
  description,
  metadata = {},
}) {
  const session = await requireSession();

  const { error } = await supabase.from("exam_integrity_events").insert([
    {
      exam_id: examId,
      student_id: session.user.id,
      event_type: eventType,
      description: description || "",
      metadata,
    },
  ]);

  if (error) throw error;
}

export async function fetchExamIntegrityEvents(examId) {
  await requireSession();

  const { data, error } = await supabase
    .from("exam_integrity_events")
    .select(`
      id,
      event_type,
      description,
      metadata,
      created_at,
      student_id,
      users:student_id (
        id,
        first_name,
        last_name,
        school_id
      )
    `)
    .eq("exam_id", examId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

function mapRpcAnalyticsResults(rows = []) {
  return rows.map((row) => ({
    id: row.id,
    score: row.score,
    total: row.total,
    student_id: row.student_id,
    users: {
      id: row.student_id,
      first_name: row.first_name,
      last_name: row.last_name,
      school_id: row.school_id,
    },
  }));
}

async function loadExamFacultyAnalyticsPayload(examId) {
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "get_exam_faculty_analytics",
    { p_exam_id: examId }
  );

  if (!rpcError && rpcData) {
    return {
      results: mapRpcAnalyticsResults(rpcData.results || []),
      studentAnswers: rpcData.student_answers || [],
      integrityEvents: rpcData.integrity_events || [],
    };
  }

  if (rpcError && !isMissingRpcError(rpcError)) {
    console.warn("Exam analytics RPC unavailable, falling back to direct query.", rpcError);
  }

  const { data: results, error: resultsError } = await supabase
    .from("exam_results")
    .select(`
      id,
      score,
      total,
      student_id,
      users:student_id (
        id,
        first_name,
        last_name,
        school_id
      )
    `)
    .eq("exam_id", examId);

  if (resultsError) throw resultsError;

  let studentAnswers = [];
  const { data: answers, error: answersError } = await supabase
    .from("student_answers")
    .select("question_id, student_id, is_correct, time_spent_seconds")
    .eq("exam_id", examId);

  if (!answersError) {
    studentAnswers = answers || [];
  } else if (
    !answersError?.message?.includes("student_answers") &&
    !answersError?.message?.includes("does not exist")
  ) {
    throw answersError;
  }

  let integrityEvents = [];
  try {
    integrityEvents = await fetchExamIntegrityEvents(examId);
  } catch {
    integrityEvents = [];
  }

  return {
    results: results || [],
    studentAnswers,
    integrityEvents,
  };
}

export async function fetchExamFacultyAnalytics(examId, questions = [], examType = "multiple_choice") {
  await requireSession();

  const payload = await loadExamFacultyAnalyticsPayload(examId);
  let retakeRequests = [];
  try {
    retakeRequests = await fetchExamRetakeRequests(examId);
  } catch {
    retakeRequests = [];
  }

  return buildExamFacultyAnalytics(
    payload.results,
    payload.studentAnswers,
    questions,
    examType,
    retakeRequests
  );
}

export async function fetchExamSubmissionAlerts(examId) {
  await requireSession();

  const payload = await loadExamFacultyAnalyticsPayload(examId);

  return buildSubmissionAlertRankings(payload.results, payload.integrityEvents);
}

function mapAutoSubmittedStudentRow(row) {
  const user = row.users || {};
  const name =
    `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
    user.school_id ||
    "Student";
  const score = Number(row.score) || 0;
  const total = Number(row.total) || 0;

  return {
    studentId: row.student_id,
    name,
    schoolId: user.school_id || "",
    score,
    total,
    scorePct: total > 0 ? Math.round((score / total) * 1000) / 10 : 0,
    submittedAt: row.created_at || null,
  };
}

export async function fetchExamAutoSubmittedStudents(examId) {
  await requireSession();

  const resultSelect = `
    id,
    score,
    total,
    created_at,
    auto_submitted,
    student_id,
    users:student_id (
      id,
      first_name,
      last_name,
      school_id
    )
  `;

  const resultSelectWithoutAuto = `
    id,
    score,
    total,
    created_at,
    student_id,
    users:student_id (
      id,
      first_name,
      last_name,
      school_id
    )
  `;

  let { data, error } = await supabase
    .from("exam_results")
    .select(resultSelect)
    .eq("exam_id", examId)
    .eq("auto_submitted", true)
    .order("created_at", { ascending: false });

  if (error?.message?.includes("auto_submitted")) {
    const events = await fetchExamIntegrityEvents(examId);
    const autoStudentIds = [
      ...new Set(
        events
          .filter((event) => event.event_type === INTEGRITY_EVENT_TYPES.AUTO_SUBMIT)
          .map((event) => event.student_id)
          .filter(Boolean)
      ),
    ];

    if (autoStudentIds.length === 0) {
      return [];
    }

    const { data: fallbackRows, error: fallbackError } = await supabase
      .from("exam_results")
      .select(resultSelectWithoutAuto)
      .eq("exam_id", examId)
      .in("student_id", autoStudentIds)
      .order("created_at", { ascending: false });

    if (fallbackError) throw fallbackError;
    return (fallbackRows || []).map(mapAutoSubmittedStudentRow);
  }

  if (error) throw error;
  return (data || []).map(mapAutoSubmittedStudentRow);
}

export async function fetchStudentSubmissionReview(examId, studentId) {
  await requireSession();

  const [resultRes, answersRes, userRes] = await Promise.all([
    supabase
      .from("exam_results")
      .select("id, score, total, student_id")
      .eq("exam_id", examId)
      .eq("student_id", studentId)
      .maybeSingle(),
    supabase
      .from("student_answers")
      .select("id, question_id, answer, is_correct, points_awarded")
      .eq("exam_id", examId)
      .eq("student_id", studentId),
    supabase
      .from("users")
      .select("id, first_name, last_name, school_id")
      .eq("id", studentId)
      .maybeSingle(),
  ]);

  if (resultRes.error) throw resultRes.error;
  if (answersRes.error) throw answersRes.error;
  if (userRes.error) throw userRes.error;

  const user = userRes.data;
  const name =
    `${user?.first_name || ""} ${user?.last_name || ""}`.trim() ||
    user?.school_id ||
    "Student";

  return {
    studentId,
    name,
    result: resultRes.data,
    answers: answersRes.data || [],
  };
}

export async function saveFacultyQuestionScores({
  examId,
  studentId,
  questionScores = [],
  questions = [],
  examType = "multiple_choice",
}) {
  await requireSession();

  const scoresPayload = questionScores.map((entry) => {
    const question = questions.find((row) => row.id === entry.questionId);
    const maxPoints = question
      ? getQuestionMaxPoints(question, examType)
      : Number(entry.maxPoints) || 1;
    const pointsAwarded = Math.max(
      0,
      Math.min(maxPoints, Number(entry.pointsAwarded) || 0)
    );

    return {
      question_id: entry.questionId,
      points_awarded: pointsAwarded,
    };
  });

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "save_faculty_question_scores",
    {
      p_exam_id: examId,
      p_student_id: studentId,
      p_scores: scoresPayload,
    }
  );

  if (!rpcError && rpcData) {
    return {
      score: Number(rpcData.score) || 0,
      total: Number(rpcData.total) || 0,
      scorePct:
        rpcData.score_pct != null ? Number(rpcData.score_pct) : null,
      pendingCount: Number(rpcData.pending_count) || 0,
      isFullyGraded: Boolean(rpcData.is_fully_graded),
    };
  }

  const rpcMissing =
    rpcError?.message?.includes("save_faculty_question_scores") ||
    rpcError?.message?.includes("Could not find the function") ||
    rpcError?.code === "42883";

  if (rpcError && !rpcMissing) {
    throw new Error(rpcError.message || "Failed to save scores.");
  }

  for (const entry of questionScores) {
    const question = questions.find((row) => row.id === entry.questionId);
    if (!question) continue;

    const maxPoints = getQuestionMaxPoints(question, examType);
    const pointsAwarded = Math.max(
      0,
      Math.min(maxPoints, Number(entry.pointsAwarded) || 0)
    );

    const payload = {
      is_correct: pointsAwarded >= maxPoints,
      points_awarded: pointsAwarded,
    };

    let { data: updatedRows, error } = await supabase
      .from("student_answers")
      .update(payload)
      .eq("exam_id", examId)
      .eq("student_id", studentId)
      .eq("question_id", entry.questionId)
      .select("id");

    if (
      error?.message?.includes("points_awarded") ||
      error?.message?.includes("does not exist")
    ) {
      ({ data: updatedRows, error } = await supabase
        .from("student_answers")
        .update({ is_correct: payload.is_correct })
        .eq("exam_id", examId)
        .eq("student_id", studentId)
        .eq("question_id", entry.questionId)
        .select("id"));
    }

    if (error) throw error;

    if (!updatedRows?.length) {
      throw new Error(
        "Could not save scores — permission denied or answer not found. Run database/faculty_save_scores_rpc.sql and database/faculty_grading_policies.sql in Supabase."
      );
    }
  }

  const { data: answers, error: answersError } = await supabase
    .from("student_answers")
    .select("id, question_id, is_correct, points_awarded")
    .eq("exam_id", examId)
    .eq("student_id", studentId);

  if (answersError) throw answersError;

  const answersByQuestionId = Object.fromEntries(
    (answers || []).map((row) => [row.question_id, row])
  );
  const totals = computeSubmissionTotals(questions, answersByQuestionId, examType);

  const { data: updatedResults, error: resultError } = await supabase
    .from("exam_results")
    .update({
      score: totals.score,
      total: totals.total,
    })
    .eq("exam_id", examId)
    .eq("student_id", studentId)
    .select("id");

  if (resultError) throw resultError;

  if (!updatedResults?.length) {
    throw new Error(
      "Scores saved for answers but exam result could not be updated. Run database/faculty_grading_policies.sql in Supabase."
    );
  }

  return totals;
}

export async function fetchStudentIntegrityAlerts(examId, studentId) {
  const events = await fetchExamIntegrityEvents(examId);
  return events
    .filter((event) => event.student_id === studentId)
    .sort(
      (a, b) =>
        new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
    );
}

export async function deleteExam(examId) {
  await requireSession();

  const { error } = await supabase.from("exams").delete().eq("id", examId);
  if (error) throw error;
}

export async function getStudentRetakeStatus(examId) {
  await requireSession();

  const { data, error } = await supabase.rpc("get_student_retake_status", {
    p_exam_id: examId,
  });

  if (error && !error.message?.includes("get_student_retake_status")) {
    throw error;
  }

  return data || null;
}

export async function prepareRetakeSubmission(examId) {
  await requireSession();

  const { error } = await supabase.rpc("prepare_retake_submission", {
    p_exam_id: examId,
  });

  if (error && !error.message?.includes("prepare_retake_submission")) {
    throw error;
  }
}

export async function hasStudentSubmittedExam(examId, studentId) {
  const session = await requireSession();
  const resolvedId = studentId || session.user.id;

  const retakeStatus = await getStudentRetakeStatus(examId);

  if (retakeStatus === "approved") {
    return false;
  }

  const { data, error } = await supabase
    .from("exam_results")
    .select("id")
    .eq("exam_id", examId)
    .eq("student_id", resolvedId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data?.id);
}

export async function getStudentEnrolledSubjects(studentId) {
  let result = [];

  const { data: joined, error: joinError } = await supabase
    .from("subject_students")
    .select(`
      subject_id,
      section,
      subjects (
        id,
        name,
        invite_code,
        teacher_school_id,
        year_level,
        subject_type
      )
    `)
    .eq("student_id", studentId);

  if (!joinError && joined?.length) {
    const fromJoin = dedupeSubjectsById(
      joined.map((row) => ({
        ...row.subjects,
        section: row.section || "A",
      })).filter((s) => s?.id)
    );
    if (fromJoin.length > 0) result = fromJoin;
  }

  if (!result.length) {
    const { data: links, error: linkError } = await supabase
      .from("subject_students")
      .select("subject_id")
      .eq("student_id", studentId);

    if (linkError) throw linkError;

    const subjectIds = [
      ...new Set((links || []).map((row) => row.subject_id)),
    ];

    if (subjectIds.length > 0) {
      const { data: subjects, error: subjectsError } = await supabase
        .from("subjects")
        .select("id, name, invite_code, teacher_school_id, year_level, subject_type")
        .in("id", subjectIds);

      if (subjectsError) throw subjectsError;
      result = dedupeSubjectsById(subjects || []);
    }
  }

  if (!result.length) {
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "get_student_enrolled_subjects"
    );

    if (!rpcError) {
      result = dedupeSubjectsById(Array.isArray(rpcData) ? rpcData : []);
    } else if (!isMissingRpcError(rpcError)) {
      throw rpcError;
    } else if (joinError) {
      throw joinError;
    }
  }

  return enrichSubjectsWithFaculty(result);
}

export async function isStudentEnrolledInSubject(studentId, subjectId) {
  const { data, error } = await supabase
    .from("subject_students")
    .select("subject_id")
    .eq("student_id", studentId)
    .eq("subject_id", subjectId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

export async function findSubjectByInviteCode(inviteCode) {
  const normalized = String(inviteCode || "").trim().toLowerCase();
  if (!normalized) return null;

  const { data, error } = await supabase
    .from("subjects")
    .select("id, name, invite_code, teacher_school_id, section_count")
    .eq("invite_code", normalized)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getStudentDashboardStats(studentId) {
  const { data, error } = await supabase.rpc("get_student_dashboard_stats");

  if (!error && data) {
    return {
      enrolledSubjects: data.enrolled_subjects ?? 0,
      completedAssessments: data.completed_assessments ?? 0,
      upcomingAssessments: data.upcoming_assessments ?? 0,
    };
  }

  if (error && !isMissingRpcError(error)) {
    throw error;
  }

  const subjects = await getStudentEnrolledSubjects(studentId);
  const subjectIds = subjects.map((s) => s.id);

  let upcomingCount = 0;
  let completedCount = 0;

  if (subjectIds.length > 0) {
    const { data: exams, error: examsError } = await supabase
      .from("exams")
      .select("id, start_datetime, end_datetime")
      .in("subject_id", subjectIds);

    if (examsError) throw examsError;

    const now = new Date();
    upcomingCount = (exams || []).filter((exam) => {
      const start = exam.start_datetime
        ? new Date(exam.start_datetime)
        : null;
      const end = exam.end_datetime ? new Date(exam.end_datetime) : null;

      if (start && now < start) return true;
      if (start && end && now >= start && now <= end) return true;
      if (!start && end && now <= end) return true;
      if (!start && !end) return true;
      return false;
    }).length;
  }

  const { data: results, error: resultsError } = await supabase
    .from("exam_results")
    .select("id")
    .eq("student_id", studentId);

  if (resultsError && !isMissingRpcError(resultsError)) {
    throw resultsError;
  }

  completedCount = results?.length || 0;

  return {
    enrolledSubjects: subjects.length,
    completedAssessments: completedCount,
    upcomingAssessments: upcomingCount,
  };
}

export async function fetchStudentResultsDetailed(studentId) {
  await requireSession();

  const baseSelect = `
      id,
      score,
      total,
      exam_id,
      exam:exam_id (
        id,
        title,
        subject_id,
        assessment_category,
        description,
        subjects:subject_id ( id, name, subject_type )
      )
    `;

  const withTimestamp = await supabase
    .from("exam_results")
    .select(`${baseSelect}, created_at`)
    .eq("student_id", studentId)
    .order("created_at", { ascending: true });

  if (
    withTimestamp.error?.message?.includes("created_at") ||
    withTimestamp.error?.message?.includes("does not exist")
  ) {
    const fallback = await supabase
      .from("exam_results")
      .select(baseSelect)
      .eq("student_id", studentId)
      .order("id", { ascending: true });

    if (fallback.error) throw fallback.error;
    return fallback.data || [];
  }

  if (withTimestamp.error) throw withTimestamp.error;
  return withTimestamp.data || [];
}

export async function fetchStudentSectionStandings() {
  await requireSession();

  const { data, error } = await supabase.rpc("get_student_section_standings");

  if (!error && data) {
    return Array.isArray(data) ? data : [];
  }

  if (isMissingRpcError(error)) {
    return [];
  }

  if (error) throw error;
  return [];
}

export async function fetchStudentAnalytics(studentId) {
  const [stats, rawResults, upcomingExams, standings, enrolledSubjects] =
    await Promise.all([
      getStudentDashboardStats(studentId),
      fetchStudentResultsDetailed(studentId),
      fetchStudentAssessments(studentId),
      fetchStudentSectionStandings(),
      getStudentEnrolledSubjects(studentId),
    ]);

  const results = rawResults.map((row) => normalizeResultRow(row));
  const upcomingWithStatus = upcomingExams.map((exam) => ({
    ...exam,
    status: getAssessmentStatus(exam),
  }));

  const analytics = buildStudentAnalytics(
    results,
    upcomingWithStatus,
    stats,
    enrolledSubjects
  );
  return mergeSectionStandings(analytics, standings);
}

export async function getFacultyDashboardStats(teacherSchoolId) {
  if (!teacherSchoolId) {
    return {
      totalSubjects: 0,
      totalAssessments: 0,
      totalStudents: 0,
    };
  }

  const subjects = await fetchTeacherSubjects(teacherSchoolId);
  const subjectIds = subjects.map((subject) => subject.id);

  let totalAssessments = 0;
  let totalStudents = 0;

  if (subjectIds.length > 0) {
    const { count, error: examsError } = await supabase
      .from("exams")
      .select("*", { count: "exact", head: true })
      .in("subject_id", subjectIds);

    if (examsError) throw examsError;
    totalAssessments = count || 0;

    const { data: enrollments, error: enrollError } = await supabase
      .from("subject_students")
      .select("student_id")
      .in("subject_id", subjectIds);

    if (enrollError) throw enrollError;
    totalStudents = new Set(
      (enrollments || []).map((row) => row.student_id)
    ).size;
  }

  return {
    totalSubjects: subjects.length,
    totalAssessments,
    totalStudents,
  };
}

export async function fetchFacultyDashboardAnalytics(teacherSchoolId) {
  if (!teacherSchoolId) {
    return {
      totalSubmissions: 0,
      submissionsByDate: [],
      submissionsBySection: [],
      assessmentActivity: [],
    };
  }

  const subjects = await fetchTeacherSubjects(teacherSchoolId);
  const subjectIds = subjects.map((subject) => subject.id);
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));

  if (!subjectIds.length) {
    return {
      totalSubmissions: 0,
      submissionsByDate: [],
      submissionsBySection: [],
      assessmentActivity: [],
    };
  }

  const { data: exams, error: examsError } = await supabase
    .from("exams")
    .select("id, title, subject_id, start_datetime, target_sections")
    .in("subject_id", subjectIds)
    .order("start_datetime", { ascending: false })
    .limit(40);

  if (examsError) throw examsError;

  const examList = exams || [];
  const examIds = examList.map((exam) => exam.id);

  const { data: enrollments, error: enrollError } = await supabase
    .from("subject_students")
    .select("subject_id, student_id, section")
    .in("subject_id", subjectIds);

  if (enrollError) throw enrollError;

  let results = [];
  if (examIds.length > 0) {
    const { data: resultRows, error: resultsError } = await supabase
      .from("exam_results")
      .select("exam_id, student_id, created_at")
      .in("exam_id", examIds);

    if (resultsError) throw resultsError;
    results = resultRows || [];
  }

  const sectionByEnrollment = new Map();
  for (const row of enrollments || []) {
    sectionByEnrollment.set(
      `${row.subject_id}:${row.student_id}`,
      String(row.section || "A").toUpperCase()
    );
  }

  const dateCounts = {};
  const today = new Date();
  for (let offset = 13; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - offset);
    dateCounts[day.toISOString().slice(0, 10)] = 0;
  }

  const sectionCounts = {};
  const submissionsPerExam = {};
  const sectionSet = new Set();
  const submissions = [];

  for (const row of results) {
    const exam = examList.find((item) => item.id === row.exam_id);
    if (!exam) continue;

    submissionsPerExam[row.exam_id] = (submissionsPerExam[row.exam_id] || 0) + 1;

    const section =
      sectionByEnrollment.get(`${exam.subject_id}:${row.student_id}`) || "—";
    sectionCounts[section] = (sectionCounts[section] || 0) + 1;
    if (section !== "—") sectionSet.add(section);

    const submittedAt = row.created_at ? new Date(row.created_at) : new Date();
    const dateKey = submittedAt.toISOString().slice(0, 10);
    if (Object.prototype.hasOwnProperty.call(dateCounts, dateKey)) {
      dateCounts[dateKey] += 1;
    }

    const subject = subjectById.get(exam.subject_id);
    submissions.push({
      examId: row.exam_id,
      subjectId: exam.subject_id,
      yearLevel: subject?.year_level ?? null,
      section,
      dateKey,
    });
  }

  for (const enrollment of enrollments || []) {
    const section = String(enrollment.section || "A").toUpperCase();
    sectionSet.add(section);
  }

  const submissionsByDate = Object.entries(dateCounts).map(([date, value]) => ({
    key: date,
    label: new Date(`${date}T12:00:00`).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
    }),
    value,
  }));

  const submissionsBySection = Object.entries(sectionCounts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, value]) => ({
      key: label,
      label: label === "—" ? "Unknown" : `Sec ${label}`,
      value,
    }));

  const enrolledPerExam = {};
  const enrolledBySectionPerExam = {};
  for (const exam of examList) {
    const subject = subjectById.get(exam.subject_id);
    const allowedSections = getSubjectSections(subject);
    let count = 0;
    const bySection = {};

    for (const enrollment of enrollments || []) {
      if (enrollment.subject_id !== exam.subject_id) continue;
      const section = String(enrollment.section || "A").toUpperCase();
      if (isVisibleToSection(exam.target_sections, section, allowedSections)) {
        count += 1;
        bySection[section] = (bySection[section] || 0) + 1;
      }
    }

    enrolledPerExam[exam.id] = count;
    enrolledBySectionPerExam[exam.id] = bySection;
  }

  const assessmentsAll = examList.map((exam) => {
    const title = exam.title || "Assessment";
    const shortTitle = title.length > 20 ? `${title.slice(0, 18)}…` : title;

    return {
      key: exam.id,
      examId: exam.id,
      label: shortTitle,
      fullTitle: title,
      subjectId: exam.subject_id,
      subjectName: subjectById.get(exam.subject_id)?.name || "Subject",
      yearLevel: subjectById.get(exam.subject_id)?.year_level ?? null,
      submitted: submissionsPerExam[exam.id] || 0,
      enrolled: enrolledPerExam[exam.id] || 0,
      enrolledBySection: enrolledBySectionPerExam[exam.id] || {},
      date: exam.start_datetime,
      value: submissionsPerExam[exam.id] || 0,
    };
  });

  const assessmentActivity = assessmentsAll.slice(0, 8);

  const subjectMeta = subjects.map((subject) => ({
    id: subject.id,
    name: subject.name,
    yearLevel: subject.year_level ?? null,
  }));

  const sections = Array.from(sectionSet).sort((left, right) =>
    left.localeCompare(right)
  );

  return {
    totalSubmissions: results.length,
    submissionsByDate,
    submissionsBySection,
    assessmentActivity,
    assessments: assessmentsAll,
    subjects: subjectMeta,
    sections,
    submissions,
  };
}

export async function getFacultySubjectCount(teacherSchoolId) {
  const stats = await getFacultyDashboardStats(teacherSchoolId);
  return stats.totalSubjects;
}

export async function fetchStudentAssessments(studentId) {
  await requireSession();

  const { data: enrollments, error: enrollmentError } = await supabase
    .from("subject_students")
    .select("subject_id, section")
    .eq("student_id", studentId);

  if (enrollmentError) throw enrollmentError;

  const subjectIds = (enrollments || []).map((row) => row.subject_id);
  if (!subjectIds.length) return [];

  const sectionBySubject = new Map(
    (enrollments || []).map((row) => [
      row.subject_id,
      String(row.section || "A").toUpperCase(),
    ])
  );

  const { data: exams, error: examError } = await supabase
    .from("exams")
    .select("*, subjects:subject_id ( id, name )")
    .in("subject_id", subjectIds)
    .order("start_datetime", { ascending: false });

  if (examError) throw examError;

  const visibleExams = (exams || []).filter((exam) =>
    isVisibleToSection(
      exam.target_sections,
      sectionBySubject.get(exam.subject_id) || "A"
    )
  );

  const examIds = visibleExams.map((exam) => exam.id);
  let submittedExamIds = new Set();
  let retakeByExamId = new Map();

  if (examIds.length > 0) {
    const [{ data: results, error: resultsError }, { data: retakeRows, error: retakeError }] =
      await Promise.all([
        supabase
          .from("exam_results")
          .select("exam_id")
          .eq("student_id", studentId)
          .in("exam_id", examIds),
        supabase
          .from("exam_retake_requests")
          .select("exam_id, status")
          .eq("student_id", studentId)
          .in("exam_id", examIds),
      ]);

    if (resultsError) throw resultsError;
    if (retakeError && !retakeError.message?.includes("exam_retake_requests")) {
      throw retakeError;
    }

    submittedExamIds = new Set((results || []).map((row) => row.exam_id));
    retakeByExamId = new Map(
      (retakeRows || []).map((row) => [row.exam_id, row.status])
    );
  }

  const { data: subjects, error: subjectsError } = await supabase
    .from("subjects")
    .select("id, name")
    .in("id", subjectIds);

  if (subjectsError) throw subjectsError;

  const subjectNameById = new Map(
    (subjects || []).map((subject) => [subject.id, subject.name])
  );

  return visibleExams.map((exam) => {
    const retakeStatus = retakeByExamId.get(exam.id) || null;
    const submitted =
      submittedExamIds.has(exam.id) && retakeStatus !== "approved";
    const studentSection = sectionBySubject.get(exam.subject_id) || "A";

    return enrichExamRecord({
      ...exam,
      subject_name:
        exam.subjects?.name ||
        subjectNameById.get(exam.subject_id) ||
        "Unknown Subject",
      student_section: studentSection,
      student_section_label: `Section ${studentSection}`,
      submitted,
      retake_status: retakeStatus,
      retake_approved: retakeStatus === "approved",
    });
  });
}

export async function fetchStudentSubjectAssessments(studentId, subjectId) {
  await requireSession();

  const section = await fetchStudentEnrollmentSection(studentId, subjectId);
  const exams = await fetchSubjectAssessments(subjectId);

  return (exams || []).filter((exam) =>
    isVisibleToSection(exam.target_sections, section || "A")
  );
}

function normalizeAnnouncementsList(data) {
  if (Array.isArray(data)) return data;
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export async function fetchSubjectAnnouncements(subjectId) {
  await requireSession();

  const { data, error } = await supabase.rpc("get_subject_announcements", {
    p_subject_id: subjectId,
  });

  if (!error && data) {
    return normalizeAnnouncementsList(data);
  }

  if (error?.message?.includes("Could not find the function")) {
    const { data: rows, error: directError } = await supabase
      .from("announcements")
      .select("*")
      .eq("subject_id", subjectId)
      .order("created_at", { ascending: false });

    if (directError) throw directError;
    return rows || [];
  }

  if (error) throw error;
  return [];
}

/** Recent announcements posted by the signed-in faculty across their subjects. */
export async function fetchFacultyAnnouncements(limit = 40, teacherSchoolId = null) {
  await requireSession();

  let schoolId = teacherSchoolId;
  if (!schoolId) {
    const cached = JSON.parse(localStorage.getItem("examnexus_user") || "{}");
    schoolId = cached.school_id || null;
  }
  if (!schoolId) {
    const session = await requireSession();
    const { data: profile } = await supabase
      .from("users")
      .select("school_id")
      .eq("id", session.user.id)
      .maybeSingle();
    schoolId = profile?.school_id || null;
  }

  const subjects = await fetchTeacherSubjects(schoolId);
  const subjectIds = (subjects || []).map((s) => s.id).filter(Boolean);
  if (!subjectIds.length) return [];

  const subjectNameById = Object.fromEntries(
    (subjects || []).map((s) => [s.id, s.name || "Subject"])
  );

  let { data, error } = await supabase
    .from("announcements")
    .select("id, subject_id, title, body, target_sections, created_at, created_by")
    .in("subject_id", subjectIds)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error?.message?.includes("created_by")) {
    ({ data, error } = await supabase
      .from("announcements")
      .select("id, subject_id, title, body, target_sections, created_at")
      .in("subject_id", subjectIds)
      .order("created_at", { ascending: false })
      .limit(limit));
  }

  if (error) throw error;

  return (data || []).map((row) => ({
    ...row,
    subject_name: subjectNameById[row.subject_id] || "Subject",
  }));
}

export async function createAnnouncement({
  subjectId,
  title,
  body,
  targetSections,
  createdBy,
  skipPush = false,
}) {
  await requireSession();

  const payload = {
    subject_id: subjectId,
    title: String(title || "").trim(),
    body: String(body || "").trim(),
    target_sections: normalizeTargetSections(targetSections),
    created_by: createdBy || null,
  };

  if (!payload.title) {
    throw new Error("Announcement title is required.");
  }

  const { data, error } = await supabase
    .from("announcements")
    .insert([payload])
    .select("*")
    .single();

  if (error) throw error;

  if (!skipPush) {
    await dispatchAnnouncementPush({
      subjectIds: [subjectId],
      title,
      body,
      targetSections,
    });
  }

  return data;
}

export async function deleteAnnouncement(announcementId) {
  await requireSession();

  const { error } = await supabase
    .from("announcements")
    .delete()
    .eq("id", announcementId);

  if (error) throw error;
}

export async function fetchPlatformAnnouncements() {
  await requireSession();
  const { data, error } = await supabase.rpc("get_platform_announcements");
  if (!error && data) return normalizeJsonList(data);

  if (error?.message?.includes("Could not find the function")) {
    const { data: rows, error: directError } = await supabase
      .from("admin_announcements")
      .select("*")
      .order("created_at", { ascending: false });
    if (directError) throw directError;
    return (rows || []).map((row) => ({
      ...row,
      heart_count: 0,
      comment_count: 0,
      user_reacted: false,
      author_first_name: "ExamNexus",
      author_last_name: "Admin",
    }));
  }

  if (error) throw error;
  return [];
}

export async function fetchAdminAnnouncementComments(announcementId) {
  await requireSession();
  const { data, error } = await supabase.rpc("get_admin_announcement_comments", {
    p_announcement_id: announcementId,
  });
  if (!error && data) return normalizeJsonList(data);
  if (error) throw error;
  return [];
}

export async function postAdminAnnouncementComment(announcementId, body) {
  await requireSession();
  const { data, error } = await supabase.rpc("add_admin_announcement_comment", {
    p_announcement_id: announcementId,
    p_body: body,
  });
  if (error) throw error;

  try {
    const cached = JSON.parse(localStorage.getItem("examnexus_user") || "{}");
    const actorName =
      [cached.first_name, cached.last_name].filter(Boolean).join(" ").trim() ||
      "Someone";
    const session = await requireSession();
    const actorId = session?.user?.id;

    const { data: announcement } = await supabase
      .from("admin_announcements")
      .select("id, title, created_by")
      .eq("id", announcementId)
      .maybeSingle();

    const { data: priorComments } = await supabase
      .from("admin_announcement_comments")
      .select("user_id")
      .eq("announcement_id", announcementId)
      .neq("user_id", actorId)
      .limit(40);

    const otherIds = [
      ...new Set((priorComments || []).map((row) => row.user_id).filter(Boolean)),
    ];
    const authorId =
      announcement?.created_by && announcement.created_by !== actorId
        ? announcement.created_by
        : null;
    const peerIds = otherIds.filter((id) => id !== authorId);

    if (authorId) {
      await dispatchPushToUsers({
        userIds: [authorId],
        title: "New comment",
        body: `${actorName} commented on "${announcement?.title || "announcement"}"`,
        data: {
          kind: "comment",
          platform: "1",
          path: `/admin/announcements`,
          announcement_id: announcementId,
        },
      });
    }

    if (peerIds.length) {
      await dispatchPushToUsers({
        userIds: peerIds,
        title: `${actorName} also commented`,
        body: `${actorName} also commented on the announcement you commented on ("${announcement?.title || "announcement"}").`,
        data: {
          kind: "comment",
          platform: "1",
          path: `/student/platform-announcements?highlight=${announcementId}&comments=1`,
          announcement_id: announcementId,
        },
      });
    }
  } catch (err) {
    console.warn("Admin comment push skipped:", err?.message || err);
  }

  return data;
}

export async function toggleAdminAnnouncementHeart(announcementId) {
  await requireSession();
  const { data, error } = await supabase.rpc("toggle_admin_announcement_reaction", {
    p_announcement_id: announcementId,
  });
  if (error) throw error;
  return data;
}

function normalizeJsonList(data) {
  if (Array.isArray(data)) return data;
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export async function fetchUserNotifications(limit = 40) {
  await requireSession();

  const { data, error } = await supabase.rpc("get_user_notifications", {
    p_limit: limit,
  });

  let items = [];
  if (!error && data) {
    items = normalizeJsonList(data);
  } else if (error && !error.message?.includes("Could not find the function")) {
    throw error;
  }

  // Fallback / merge: admin broadcasts (works even before SQL migration is applied)
  try {
    const user = JSON.parse(localStorage.getItem("examnexus_user") || "{}");
    const role = String(user.role || "").toLowerCase();
    const { data: broadcasts } = await supabase
      .from("admin_announcements")
      .select("id, title, body, audience, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    const adminItems = (broadcasts || [])
      .filter((row) => {
        const audience = String(row.audience || "all").toLowerCase();
        if (audience === "all") return role === "faculty" || role === "student";
        if (audience === "faculty") return role === "faculty";
        if (audience === "students") return role === "student";
        return false;
      })
      .map((row) => ({
        kind: "admin_announcement",
        id: row.id,
        title: row.title,
        body: String(row.body || "").slice(0, 160),
        created_at: row.created_at,
        audience: row.audience,
        status: "posted",
        subject_name: "ExamNexus",
      }));

    const seen = new Set(
      items
        .filter((item) => item.kind === "admin_announcement")
        .map((item) => String(item.id))
    );
    for (const item of adminItems) {
      if (!seen.has(String(item.id))) items.push(item);
    }
  } catch {
    // ignore if table/policy unavailable
  }

  items.sort(
    (a, b) =>
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );

  return items.slice(0, limit);
}

export async function toggleAnnouncementHeart(announcementId) {
  await requireSession();

  const { data, error } = await supabase.rpc("toggle_announcement_reaction", {
    p_announcement_id: announcementId,
  });

  if (error) throw error;

  try {
    if (data?.user_reacted) {
      const { data: announcement } = await supabase
        .from("announcements")
        .select("id, title, created_by, subject_id")
        .eq("id", announcementId)
        .maybeSingle();

      const session = await requireSession();
      const actorId = session?.user?.id;
      if (
        announcement?.created_by &&
        announcement.created_by !== actorId
      ) {
        await dispatchPushToUsers({
          userIds: [announcement.created_by],
          title: "New reaction",
          body: `Someone reacted to "${announcement.title}"`,
          data: {
            kind: "reaction",
            path: `/faculty/subject/${announcement.subject_id}/social?highlight=${announcement.id}`,
            announcement_id: announcement.id,
            subject_id: announcement.subject_id || "",
          },
        });
      }
    }
  } catch (err) {
    console.warn("Reaction push skipped:", err?.message || err);
  }

  return data;
}

export async function fetchAnnouncementComments(announcementId) {
  await requireSession();

  const { data, error } = await supabase.rpc("get_announcement_comments", {
    p_announcement_id: announcementId,
  });

  if (!error && data) {
    return normalizeJsonList(data);
  }

  if (error?.message?.includes("Could not find the function")) {
    const { data: rows, error: directError } = await supabase
      .from("announcement_comments")
      .select("*")
      .eq("announcement_id", announcementId)
      .order("created_at", { ascending: true });

    if (directError) throw directError;
    return rows || [];
  }

  if (error) throw error;
  return [];
}

export async function postAnnouncementComment(announcementId, body) {
  await requireSession();

  const { data, error } = await supabase.rpc("add_announcement_comment", {
    p_announcement_id: announcementId,
    p_body: body,
  });

  if (error) throw error;

  try {
    const { data: announcement } = await supabase
      .from("announcements")
      .select("id, title, created_by, subject_id")
      .eq("id", announcementId)
      .maybeSingle();

    const session = await requireSession();
    const actorId = session?.user?.id;
    const cached = JSON.parse(localStorage.getItem("examnexus_user") || "{}");
    const actorName =
      [cached.first_name, cached.last_name].filter(Boolean).join(" ").trim() ||
      "Someone";
    const authorId =
      announcement?.created_by && announcement.created_by !== actorId
        ? announcement.created_by
        : null;

    const { data: priorComments } = await supabase
      .from("announcement_comments")
      .select("user_id")
      .eq("announcement_id", announcementId)
      .neq("user_id", actorId)
      .limit(40);

    const otherIds = [
      ...new Set(
        (priorComments || [])
          .map((row) => row.user_id)
          .filter((id) => id && id !== authorId)
      ),
    ];

    const facultyPath = `/faculty/subject/${announcement?.subject_id}/social?highlight=${announcementId}&comments=1`;
    const studentPath = `/student/subject/${announcement?.subject_id}/social?highlight=${announcementId}&comments=1`;

    if (authorId) {
      await dispatchPushToUsers({
        userIds: [authorId],
        title: "New comment",
        body: `${actorName} commented on "${announcement?.title || "announcement"}"`,
        actorName,
        data: {
          kind: "comment",
          path: facultyPath,
          announcement_id: announcementId,
          subject_id: announcement?.subject_id || "",
          actor_name: actorName,
        },
      });
    }

    if (otherIds.length && announcement?.subject_id) {
      await dispatchPushToUsers({
        userIds: otherIds,
        title: `${actorName} also commented`,
        body: `${actorName} also commented on the announcement you commented on ("${announcement?.title || "announcement"}").`,
        actorName,
        data: {
          kind: "comment",
          path: studentPath,
          announcement_id: announcementId,
          subject_id: announcement.subject_id,
          actor_name: actorName,
        },
      });
    }
  } catch (err) {
    console.warn("Comment push skipped:", err?.message || err);
  }

  return data;
}

async function dispatchAnnouncementPush({
  subjectIds = [],
  title,
  body,
  targetSections,
}) {
  await dispatchSubjectAnnouncementPush({
    subjectIds,
    title,
    body,
    targetSections: normalizeTargetSections(targetSections),
  });
}

export async function createFacultyAnnouncements({
  subjectIds,
  title,
  body,
  targetSections,
}) {
  await requireSession();

  const payload = {
    p_subject_ids: subjectIds && subjectIds.length ? subjectIds : null,
    p_title: String(title || "").trim(),
    p_body: String(body || "").trim(),
    p_target_sections: normalizeTargetSections(targetSections),
  };

  const { data, error } = await supabase.rpc("create_faculty_announcements", payload);

  if (!error && data) {
    const rows = normalizeJsonList(data);
    const createdSubjectIds = [
      ...new Set(rows.map((row) => row.subject_id).filter(Boolean)),
    ];
    await dispatchAnnouncementPush({
      subjectIds: createdSubjectIds.length ? createdSubjectIds : subjectIds || [],
      title,
      body,
      targetSections,
    });
    return { count: rows.length, rows };
  }

  if (error?.message?.includes("Could not find the function")) {
    const user = JSON.parse(localStorage.getItem("examnexus_user") || "{}");
    const ids = subjectIds?.length
      ? subjectIds
      : (await fetchTeacherSubjects(user.school_id)).map((s) => s.id);

    const createdRows = [];

    for (const subjectId of ids) {
      const row = await createAnnouncement({
        subjectId,
        title,
        body,
        targetSections,
        createdBy: user.id,
        skipPush: true,
      });
      createdRows.push(row);
    }

    await dispatchAnnouncementPush({
      subjectIds: ids,
      title,
      body,
      targetSections,
    });

    return { count: createdRows.length, rows: createdRows };
  }

  if (error) throw error;
  return { count: 0, rows: [] };
}

export async function requestExamRetake(examId, message = "") {
  await requireSession();

  const { data, error } = await supabase.rpc("request_exam_retake", {
    p_exam_id: examId,
    p_message: message || null,
  });

  if (error) throw error;
  return data;
}

export async function fetchExamRetakeRequests(examId) {
  await requireSession();

  const { data, error } = await supabase.rpc("get_exam_retake_requests", {
    p_exam_id: examId,
  });

  if (error) throw error;
  return Array.isArray(data) ? data : data ? JSON.parse(JSON.stringify(data)) : [];
}

export async function reviewExamRetakeRequests(examId, requestIds, action, note = "") {
  await requireSession();

  const { data, error } = await supabase.rpc("review_exam_retake_requests", {
    p_exam_id: examId,
    p_request_ids: requestIds,
    p_action: action,
    p_note: note || null,
  });

  if (error) throw error;
  return data;
}
