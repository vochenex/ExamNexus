import { DEFAULT_AVATAR_PATH } from "./avatar";
import { getAuthSession } from "./authUser";
import { normalizeSchoolId } from "./schoolIdRules";
import { normalizeYearLevelForStorage } from "./yearLevels";

import { formatSupabaseError } from "./supabaseErrors";
import { canAccessPlatform } from "./adminData";

const SIGNUP_SCHOOL_KEY_PREFIX = "examnexus_signup_school_";

export function buildUserProfileRow(userId, form) {
  const row = {
    id: userId,
    first_name: String(form.firstName || "").trim(),
    last_name: String(form.lastName || "").trim(),
    email: String(form.email || "").trim(),
    school_id: normalizeSchoolId(form.schoolId),
    role: form.role || "Student",
    gender: emptyToNull(form.gender),
    department: emptyToNull(form.department),
    age: toIntOrNull(form.age),
    avatar_url: DEFAULT_AVATAR_PATH,
    account_status: "pending",
  };

  if (form.role !== "Faculty") {
    row.course = emptyToNull(form.course);
    row.year_level = normalizeYearLevelForStorage(form.yearLevel);
  } else {
    row.course = null;
    row.year_level = null;
  }

  return row;
}

export function buildSignupMetadata(form) {
  const metadata = {
    first_name: String(form.firstName || "").trim(),
    last_name: String(form.lastName || "").trim(),
    school_id: normalizeSchoolId(form.schoolId),
    role: form.role || "Student",
    gender: emptyToNull(form.gender),
    department: emptyToNull(form.department),
    avatar_url: DEFAULT_AVATAR_PATH,
  };

  if (form.role !== "Faculty") {
    metadata.course = emptyToNull(form.course);
    metadata.year_level = normalizeYearLevelForStorage(form.yearLevel);
  }

  const age = toIntOrNull(form.age);
  if (age != null) {
    metadata.age = age;
  }

  return metadata;
}

function toIntOrNull(value) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }
  const parsed = Number.parseInt(String(value).trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeRpcAge(value) {
  return toIntOrNull(value);
}

function emptyToNull(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

function sanitizeProfileRowForDb(row) {
  return {
    ...row,
    gender: emptyToNull(row.gender),
    department: emptyToNull(row.department),
    course: emptyToNull(row.course),
    year_level: normalizeYearLevelForStorage(row.year_level),
    age: toIntOrNull(row.age),
  };
}

function buildUpsertSignupProfileParams(profileRow) {
  const row = sanitizeProfileRowForDb(profileRow);

  return {
    p_first_name: row.first_name,
    p_last_name: row.last_name,
    p_email: row.email,
    p_school_id: row.school_id,
    p_role: row.role,
    p_gender: row.gender,
    p_department: row.department,
    p_course: row.course,
    p_year_level: row.year_level,
    p_age: row.age == null ? null : String(row.age),
    p_avatar_url: row.avatar_url,
  };
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

export function needsSchoolIdRepair(schoolId) {
  const value = String(schoolId || "").trim();
  return !value || isUuid(value);
}

export function getSchoolIdFromAuthUser(authUser) {
  const meta = authUser?.user_metadata || {};
  return String(meta.school_id || meta.schoolId || "").trim();
}

export function saveSignupSchoolIdCache(userId, schoolId) {
  const value = String(schoolId || "").trim();
  if (!userId || !value) return;
  localStorage.setItem(`${SIGNUP_SCHOOL_KEY_PREFIX}${userId}`, value);
}

export function getSchoolIdFromSignupCache(userId) {
  if (!userId) return "";

  const cachedSchoolId = localStorage.getItem(
    `${SIGNUP_SCHOOL_KEY_PREFIX}${userId}`
  );
  if (cachedSchoolId && !needsSchoolIdRepair(cachedSchoolId)) {
    return cachedSchoolId.trim();
  }

  const cachedUser = JSON.parse(localStorage.getItem("examnexus_user") || "{}");
  if (
    cachedUser.id === userId &&
    cachedUser.school_id &&
    !needsSchoolIdRepair(cachedUser.school_id)
  ) {
    return String(cachedUser.school_id).trim();
  }

  return "";
}

export function resolveSchoolId(authUser, profile) {
  const candidates = [
    getSchoolIdFromAuthUser(authUser),
    getSchoolIdFromSignupCache(authUser?.id),
    String(profile?.school_id || "").trim(),
  ];

  return candidates.find((value) => value && !needsSchoolIdRepair(value)) || "";
}

export function mergeProfileWithAuthMetadata(profile, authUser) {
  if (!profile) return profile;

  const meta = authUser?.user_metadata || {};
  const schoolId = resolveSchoolId(authUser, profile);

  return {
    ...profile,
    first_name: profile.first_name || meta.first_name || "",
    last_name: profile.last_name || meta.last_name || "",
    email: profile.email || authUser?.email || "",
    school_id: schoolId,
    role: resolveProfileRole(profile, meta),
    gender: profile.gender || meta.gender || "",
    department: profile.department || meta.department || "",
    course: profile.course || meta.course || "",
    year_level:
      normalizeYearLevelForStorage(profile.year_level) ||
      normalizeYearLevelForStorage(meta.year_level) ||
      "",
    age: profile.age ?? meta.age ?? "",
    avatar_url: profile.avatar_url || meta.avatar_url || DEFAULT_AVATAR_PATH,
    account_status:
      String(resolveProfileRole(profile, meta) || "").toLowerCase() === "admin"
        ? "approved"
        : profile.account_status || "pending",
  };
}

async function persistSchoolIdToProfile(supabase, authUser, profile, schoolId) {
  const meta = authUser.user_metadata || {};
  const rpcParams = buildUpsertSignupProfileParams({
    id: authUser.id,
    first_name: profile.first_name || meta.first_name || "User",
    last_name: profile.last_name || meta.last_name || "",
    email: profile.email || authUser.email,
    school_id: schoolId,
    role: resolveProfileRole(profile, meta) || "Student",
    gender: profile.gender || authUser.user_metadata?.gender || null,
    department: profile.department || authUser.user_metadata?.department || null,
    course: profile.course || authUser.user_metadata?.course || null,
    year_level: profile.year_level || authUser.user_metadata?.year_level || null,
    age: profile.age ?? authUser.user_metadata?.age ?? null,
    avatar_url: profile.avatar_url || DEFAULT_AVATAR_PATH,
  });

  const { data, error } = await supabase.rpc("upsert_signup_profile", rpcParams);

  if (!error && data) {
    return data;
  }

  const { data: repaired, error: repairError } = await supabase.rpc(
    "repair_profile_school_id"
  );

  if (!repairError && repaired) {
    return repaired;
  }

  const { data: updated, error: updateError } = await supabase
    .from("users")
    .update({ school_id: schoolId })
    .eq("id", authUser.id)
    .select("*")
    .maybeSingle();

  if (!updateError && updated) {
    return updated;
  }

  return { ...profile, school_id: schoolId };
}

async function repairSchoolIdFromMetadata(supabase, authUser, profile) {
  const schoolId = resolveSchoolId(authUser, profile);

  if (!schoolId) {
    return mergeProfileWithAuthMetadata(profile, authUser);
  }

  if (!needsSchoolIdRepair(profile?.school_id)) {
    saveSignupSchoolIdCache(authUser.id, profile.school_id);
    return mergeProfileWithAuthMetadata(profile, authUser);
  }

  const persisted = await persistSchoolIdToProfile(
    supabase,
    authUser,
    profile,
    schoolId
  );

  saveSignupSchoolIdCache(authUser.id, schoolId);
  return mergeProfileWithAuthMetadata(persisted, authUser);
}

export function navigateForRole(navigate, role, options = {}) {
  const normalized = String(role || "").toLowerCase();
  if (normalized === "faculty") {
    navigate("/faculty/dashboard", options);
  } else if (normalized === "admin") {
    navigate("/admin/dashboard", options);
  } else {
    navigate("/student/dashboard", options);
  }
}

function resolveProfileRole(profile, meta = {}) {
  const dbRole = String(profile?.role || "").toLowerCase();
  if (dbRole === "admin" || dbRole === "faculty") {
    return profile.role;
  }
  return profile?.role || meta.role || "";
}

export async function syncProfileOnLogin(supabase) {
  const session = await getAuthSession().catch(() => null);
  const authUser = session?.user;

  if (!authUser) {
    return { profile: null, error: new Error("Not authenticated") };
  }

  let profile = null;
  let syncError = null;

  const { data: synced, error: rpcError } = await supabase.rpc(
    "ensure_user_profile"
  );

  if (!rpcError && synced) {
    profile = synced;
  } else {
    syncError = rpcError;
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", authUser.id)
      .maybeSingle();

    if (error) {
      return { profile: null, error: syncError || error };
    }

    profile = data;
  }

  if (!profile) {
    return {
      profile: null,
      error: syncError || new Error("Profile not found"),
      pendingApproval: false,
    };
  }

  if (!canAccessPlatform(profile)) {
    return {
      profile: null,
      error: null,
      pendingApproval: true,
    };
  }

  const previousCache = JSON.parse(
    localStorage.getItem("examnexus_user") || "{}"
  );
  if (
    previousCache.id === authUser.id &&
    previousCache.school_id &&
    !needsSchoolIdRepair(previousCache.school_id)
  ) {
    saveSignupSchoolIdCache(authUser.id, previousCache.school_id);
  }

  profile = await repairSchoolIdFromMetadata(supabase, authUser, profile);
  profile = mergeProfileWithAuthMetadata(profile, authUser);

  localStorage.setItem("examnexus_user", JSON.stringify(profile));

  return { profile, error: null, pendingApproval: false };
}

export async function loadProfileForUser(supabase) {
  return syncProfileOnLogin(supabase);
}

export async function fetchOrCreateProfile(supabase) {
  return syncProfileOnLogin(supabase);
}

export async function saveSignupProfile(supabase, profileRow) {
  saveSignupSchoolIdCache(profileRow.id, profileRow.school_id);

  const rpcParams = buildUpsertSignupProfileParams(profileRow);
  const { data, error } = await supabase.rpc("upsert_signup_profile", rpcParams);

  if (!error && data) {
    return { profile: data, error: null };
  }

  const sanitizedRow = sanitizeProfileRowForDb(profileRow);
  const { data: upserted, error: upsertError } = await supabase
    .from("users")
    .upsert([sanitizedRow], { onConflict: "id" })
    .select("*")
    .single();

  if (upsertError) {
    const formatted = formatSupabaseError(upsertError || error, {
      context: "signup",
    });
    return {
      profile: null,
      error: { ...(upsertError || error), message: formatted },
    };
  }

  return { profile: upserted, error: null };
}
