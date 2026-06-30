import { supabase } from "../supabaseClient";
import { requireSession, generateInviteCode } from "./supabaseData";
import { normalizeSectionCount } from "./sections";
import { normalizeYearLevelForStorage as normalizeYearLevel } from "./yearLevels";

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
