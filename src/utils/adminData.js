import { supabase } from "../supabaseClient";
import { requireSession, generateInviteCode } from "./supabaseData";
import { normalizeSectionCount } from "./sections";
import { normalizeYearLevelForStorage as normalizeYearLevel } from "./yearLevels";
import {
  dispatchBroadcastPush,
  dispatchPushToUsers,
} from "./pushDispatch";

function isMissingRpcError(error) {
  const message = error?.message || "";
  return (
    message.includes("Could not find the function") ||
    message.includes("schema cache")
  );
}

function normalizeJson(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : parsed;
    } catch {
      return [];
    }
  }
  return value ?? [];
}

export async function fetchAdminDashboardStats() {
  await requireSession();
  const { data, error } = await supabase.rpc("admin_get_dashboard_stats");
  if (error) throw error;
  return data || {};
}

export async function fetchAdminDashboardAnalytics() {
  await requireSession();
  const { data, error } = await supabase.rpc("admin_get_dashboard_analytics");

  if (error) {
    if (isMissingRpcError(error)) {
      return {
        teachers_active_today: [],
        exams_per_day: [],
        teachers_active_today_total: 0,
        exams_today: 0,
        unavailable: true,
      };
    }
    throw error;
  }

  return {
    teachers_active_today: normalizeJson(data?.teachers_active_today),
    exams_per_day: normalizeJson(data?.exams_per_day),
    teachers_active_today_total: Number(data?.teachers_active_today_total) || 0,
    exams_today: Number(data?.exams_today) || 0,
    unavailable: false,
  };
}

export async function fetchAdminUsers(role = null, status = null) {
  await requireSession();

  let { data, error } = await supabase.rpc("admin_list_users", {
    p_role: role || null,
    p_status: status || null,
  });

  if (error && isMissingRpcError(error)) {
    ({ data, error } = await supabase.rpc("admin_list_users", {
      p_role: role || null,
    }));

    if (!error && status) {
      data = (data || []).filter(
        (user) => getAccountStatus(user) === status
      );
    }
  }

  if (error) throw error;
  return data || [];
}

export async function reviewAdminAccount(userId, action) {
  await requireSession();
  const { data, error } = await supabase.rpc("admin_review_account", {
    p_user_id: userId,
    p_action: action,
  });
  if (error) throw error;

  const approved = String(action || "").toLowerCase() === "approve";
  await dispatchPushToUsers({
    userIds: [userId],
    title: approved ? "Account approved" : "Account not approved",
    body: approved
      ? "Your ExamNexus account was approved. You can sign in now."
      : "Your ExamNexus registration was not approved. Contact an administrator if you need help.",
    data: {
      kind: "account",
      path: "/login",
      status: approved ? "approved" : "rejected",
    },
  });

  return data;
}

export async function updateAdminUser(userId, fields) {
  await requireSession();
  const { data, error } = await supabase.rpc("admin_update_user", {
    p_user_id: userId,
    p_role: fields.role ?? null,
    p_department: fields.department ?? null,
    p_course: fields.course ?? null,
    p_year_level: fields.year_level ?? null,
    p_first_name: fields.first_name ?? null,
    p_last_name: fields.last_name ?? null,
  });
  if (error) throw error;
  return data;
}

export async function deleteAdminUser(userId) {
  await requireSession();
  const { error } = await supabase.rpc("delete_user_account", {
    p_user_id: userId,
  });
  if (error) throw error;
}

export async function fetchAdminFaculty() {
  await requireSession();
  const { data, error } = await supabase.rpc("admin_list_faculty");
  if (error) throw error;
  return data || [];
}

export async function fetchAdminSubjectsWithFaculty() {
  await requireSession();
  const { data, error } = await supabase.rpc("admin_list_subjects_with_faculty");
  if (error) throw error;
  return normalizeJson(data);
}

export async function adminCreateSubject({
  name,
  teacherSchoolId,
  yearLevel = "1st_year",
  sectionCount = 3,
}) {
  await requireSession();

  const row = {
    name: String(name || "").trim(),
    teacher_school_id: teacherSchoolId,
    invite_code: generateInviteCode(),
    year_level: normalizeYearLevel(yearLevel),
    section_count: normalizeSectionCount(sectionCount),
  };

  const { data, error } = await supabase.from("subjects").insert([row]).select().single();
  if (error) throw error;
  return data;
}

export async function adminUpdateSubject(subjectId, updates) {
  await requireSession();
  const payload = { ...updates };
  if (payload.section_count !== undefined) {
    payload.section_count = normalizeSectionCount(payload.section_count);
  }
  const { data, error } = await supabase
    .from("subjects")
    .update(payload)
    .eq("id", subjectId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function adminDeleteSubject(subjectId) {
  await requireSession();
  const { error } = await supabase.from("subjects").delete().eq("id", subjectId);
  if (error) throw error;
}

export async function adminAssignSubjectFaculty(subjectId, facultySchoolId) {
  await requireSession();
  const trimmed = String(facultySchoolId || "").trim();

  if (!trimmed) {
    return adminUpdateSubject(subjectId, { teacher_school_id: null });
  }

  const { data, error } = await supabase.rpc("admin_assign_subject_faculty", {
    p_subject_id: subjectId,
    p_faculty_school_id: trimmed,
  });
  if (error) throw error;
  return data;
}

export async function fetchAdminCatalog() {
  await requireSession();
  const { data, error } = await supabase.rpc("admin_get_catalog");
  if (error) throw error;
  return normalizeJson(data);
}

export async function upsertAdminCatalogItem(item) {
  await requireSession();
  const { data, error } = await supabase.rpc("admin_upsert_catalog_item", {
    p_id: item.id || null,
    p_item_type: item.item_type,
    p_code: item.code,
    p_label: item.label,
    p_parent_code: item.parent_code || null,
    p_sort_order: item.sort_order ?? 0,
    p_is_active: item.is_active !== false,
  });
  if (error) throw error;
  return data;
}

export async function deleteAdminCatalogItem(id) {
  await requireSession();
  const { error } = await supabase.rpc("admin_delete_catalog_item", { p_id: id });
  if (error) throw error;
}

export async function fetchAdminBroadcasts() {
  await requireSession();
  const { data, error } = await supabase.rpc("admin_list_broadcasts");
  if (error) throw error;
  return data || [];
}

export async function createAdminBroadcast({ title, body, audience }) {
  await requireSession();
  const { data, error } = await supabase.rpc("admin_create_broadcast", {
    p_title: title,
    p_body: body,
    p_audience: audience,
  });
  if (error) throw error;

  const audienceValue = audience || data?.audience || "all";
  await dispatchBroadcastPush({
    audience: audienceValue,
    title: title || "ExamNexus announcement",
    body: body || "You have a new platform announcement.",
    path:
      String(audienceValue).toLowerCase() === "faculty"
        ? "/faculty/dashboard"
        : "/student/dashboard",
  });

  return data;
}

export async function fetchAdminAssessments() {
  await requireSession();
  const { data, error } = await supabase.rpc("admin_list_assessments");
  if (error) throw error;
  return normalizeJson(data);
}

export async function fetchAdminExamLogs(limit = 200) {
  await requireSession();
  const { data, error } = await supabase.rpc("admin_list_exam_logs", {
    p_limit: limit,
  });
  if (error) throw error;
  return normalizeJson(data);
}

export async function fetchAdminExportAssessments() {
  await requireSession();
  const { data, error } = await supabase.rpc("admin_export_assessments");
  if (error) throw error;
  return normalizeJson(data);
}

export async function fetchAdminExportResults(examId = null) {
  await requireSession();
  const { data, error } = await supabase.rpc("admin_export_results", {
    p_exam_id: examId,
  });
  if (error) throw error;
  return normalizeJson(data);
}

/**
 * Full assessment report for HTML export.
 * Tries admin_export_assessment_report RPC; on any failure (including stale
 * SQL that still references q.options) composes the report from safe queries.
 */
export async function fetchAdminAssessmentReport(examId) {
  await requireSession();
  if (!examId) throw new Error("Assessment id is required.");

  try {
    const { data, error } = await supabase.rpc("admin_export_assessment_report", {
      p_exam_id: examId,
    });

    if (!error && data) {
      const report = typeof data === "string" ? JSON.parse(data) : data;
      const questions = Array.isArray(report.questions)
        ? report.questions.map((row) => ({
            ...row,
            question_text: row.question_text || row.question,
            options:
              (Array.isArray(row.options) && row.options.length
                ? row.options
                : null) ||
              [row.option_a, row.option_b, row.option_c, row.option_d].filter(Boolean),
            points: row.points ?? (Number(row.grading_options?.points) || 1),
          }))
        : [];
      return { ...report, questions };
    }
  } catch (err) {
    console.warn("admin_export_assessment_report RPC failed, using fallback:", err);
  }

  const [results, assessments, faculty] = await Promise.all([
    fetchAdminExportResults(examId),
    fetchAdminExportAssessments(),
    fetchAdminFaculty(),
  ]);

  const meta =
    assessments.find((row) => String(row.assessment_id) === String(examId)) ||
    {};
  const facultyMember = faculty.find(
    (row) => String(row.school_id) === String(meta.faculty_school_id || "")
  );

  let questions = [];
  try {
    const { data: questionRows, error: qError } = await supabase
      .from("questions")
      .select(
        "id, question, question_type, option_a, option_b, option_c, option_d, correct_answer, correct_answers, grading_options, created_at"
      )
      .eq("exam_id", examId)
      .order("created_at", { ascending: true });
    if (!qError) {
      questions = (questionRows || []).map((row) => ({
        ...row,
        question_text: row.question,
        options: [row.option_a, row.option_b, row.option_c, row.option_d].filter(Boolean),
        points: Number(row.grading_options?.points) || 1,
      }));
    }
  } catch {
    questions = [];
  }

  let description = "";
  try {
    const { data: examRow } = await supabase
      .from("exams")
      .select("description, instructions, exam_type, assessment_category, start_datetime, end_datetime")
      .eq("id", examId)
      .maybeSingle();
    description = examRow?.description || "";
    if (examRow) {
      meta.type = meta.type || examRow.exam_type;
      meta.category = meta.category || examRow.assessment_category;
      meta.start = meta.start || examRow.start_datetime;
      meta.end = meta.end || examRow.end_datetime;
    }
  } catch {
    /* ignore */
  }

  return {
    id: examId,
    title: meta.title || results[0]?.exam_title || "Assessment",
    description,
    type: meta.type,
    category: meta.category,
    subject: meta.subject || results[0]?.subject,
    faculty_school_id: meta.faculty_school_id,
    faculty_name: facultyMember
      ? [facultyMember.first_name, facultyMember.last_name].filter(Boolean).join(" ")
      : meta.faculty_school_id || "",
    start: meta.start,
    end: meta.end,
    pass_mark: 50,
    questions,
    students: results,
  };
}

export function getAccountStatus(profile) {
  const explicit = profile?.account_status;
  if (explicit) return explicit;

  const role = String(profile?.role || "").toLowerCase();
  if (role === "admin") return "approved";
  return "pending";
}

export function isAccountApproved(profile) {
  return getAccountStatus(profile) === "approved";
}

export function isAdminUser(user) {
  return String(user?.role || "").toLowerCase() === "admin";
}

export function canAccessPlatform(profile) {
  return isAccountApproved(profile) || isAdminUser(profile);
}

export async function fetchAccountAccess(supabase, userId) {
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "get_my_account_access"
  );

  if (!rpcError && rpcData && typeof rpcData === "object") {
    return {
      allowed: Boolean(rpcData.allowed),
      profile: {
        id: userId,
        role: rpcData.role,
        account_status: rpcData.account_status,
      },
      error: null,
    };
  }

  let { data, error } = await supabase
    .from("users")
    .select("id, role, account_status")
    .eq("id", userId)
    .maybeSingle();

  if (
    error &&
    /account_status|column|schema cache/i.test(String(error.message || ""))
  ) {
    ({ data, error } = await supabase
      .from("users")
      .select("id, role")
      .eq("id", userId)
      .maybeSingle());

    if (data) {
      data.account_status =
        String(data.role || "").toLowerCase() === "admin" ? "approved" : "pending";
    }
  }

  if (error) {
    return { allowed: false, profile: null, error };
  }

  if (!data) {
    return { allowed: false, profile: null, error: new Error("Profile not found") };
  }

  return {
    allowed: canAccessPlatform(data),
    profile: data,
    error: null,
  };
}
