import { supabase } from "../supabaseClient";
import { requireSession, generateInviteCode, ensureSubjectSectionInvites } from "./supabaseData";
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
      data = (data || []).filter((user) => {
        const accountStatus = getAccountStatus(user);
        if (status === "deleted") {
          return accountStatus === "deleted" || accountStatus === "rejected";
        }
        return accountStatus === status;
      });
    }
  }

  if (error) throw error;

  let rows = data || [];

  // Older RPCs match account_status exactly ("deleted") and miss legacy
  // "rejected" rows. Also some DBs never got soft-delete SQL.
  if (status === "deleted" && rows.length === 0) {
    const { data: rejectedRows, error: rejectedError } = await supabase.rpc(
      "admin_list_users",
      {
        p_role: role || null,
        p_status: "rejected",
      }
    );
    if (!rejectedError && rejectedRows?.length) {
      rows = rejectedRows;
    }
  }

  if (status === "deleted") {
    rows = rows.filter((user) => {
      const accountStatus = getAccountStatus(user);
      return accountStatus === "deleted" || accountStatus === "rejected";
    });
  }

  return rows;
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
    title: approved ? "Account approved" : "Account deleted",
    body: approved
      ? "Your ExamNexus account was approved. You can sign in now."
      : "Your ExamNexus account was removed by an administrator.",
    data: {
      kind: "account",
      path: "/auth",
      status: approved ? "approved" : "deleted",
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

  // Confirm soft-delete landed. If the profile is gone, the DB still hard-deletes.
  const { data: stillThere, error: checkError } = await supabase
    .from("users")
    .select("id, account_status, deleted_at")
    .eq("id", userId)
    .maybeSingle();

  if (!checkError && !stillThere) {
    throw new Error(
      "Account was permanently removed. Run database/account_soft_delete.sql in Supabase so deletes use the 7-day hold."
    );
  }

  if (
    !checkError &&
    stillThere &&
    !["deleted", "rejected"].includes(
      String(stillThere.account_status || "").toLowerCase()
    )
  ) {
    throw new Error(
      "Delete did not mark the account as deleted. Run database/account_soft_delete.sql in Supabase."
    );
  }

  await dispatchPushToUsers({
    userIds: [userId],
    title: "Account deleted",
    body: "Your ExamNexus account was deleted by an administrator. Contact support if this was a mistake within 7 days.",
    data: {
      kind: "account",
      path: "/auth",
      status: "deleted",
    },
  });
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

  try {
    await ensureSubjectSectionInvites(data.id);
  } catch {
    // Trigger / RPC may create codes once SQL migration is applied.
  }

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
  const announcementId = data?.id || "";
  const facultyPath = announcementId
    ? `/faculty/admin-announcements?highlight=${announcementId}&comments=1`
    : "/faculty/admin-announcements";
  const studentPath = announcementId
    ? `/student/announcements?highlight=${announcementId}&comments=1`
    : "/student/announcements";

  await dispatchBroadcastPush({
    audience: audienceValue,
    title: title || "ExamNexus announcement",
    body: body || "You have a new admin announcement.",
    path: studentPath,
    facultyPath,
    studentPath,
  });

  return data;
}

export async function deleteAdminBroadcast(id) {
  await requireSession();
  const { error } = await supabase.rpc("admin_delete_broadcast", { p_id: id });
  if (error) throw error;
}

export async function fetchAdminAssessments() {
  await requireSession();
  const [{ data, error }, facultyList] = await Promise.all([
    supabase.rpc("admin_list_assessments"),
    fetchAdminFaculty(),
  ]);
  if (error) throw error;
  const rows = normalizeJson(data);
  const facultyBySchoolId = new Map(
    (facultyList || []).map((faculty) => [
      String(faculty.school_id || ""),
      {
        name: [faculty.first_name, faculty.last_name].filter(Boolean).join(" ") || "—",
        department: faculty.department || "—",
      },
    ])
  );

  return rows.map((row) => {
    const faculty = facultyBySchoolId.get(String(row.teacher_school_id || ""));
    return {
      ...row,
      faculty_name: faculty?.name || "—",
      faculty_department: faculty?.department || "—",
    };
  });
}

export async function fetchAdminExamLogs(limit = 200) {
  await requireSession();
  const { data, error } = await supabase.rpc("admin_list_exam_logs", {
    p_limit: limit,
  });
  if (error) throw error;
  const rows = normalizeJson(data);
  if (!rows.length) return rows;

  const examIds = [...new Set(rows.map((row) => row.exam_id).filter(Boolean))];
  const studentIds = [...new Set(rows.map((row) => row.student_id).filter(Boolean))];

  const examMeta = new Map();
  if (examIds.length) {
    const { data: exams } = await supabase
      .from("exams")
      .select(
        "id, title, target_sections, subject_id, subjects(id, name, section_count, teacher_school_id)"
      )
      .in("id", examIds);

    const teacherIds = [
      ...new Set(
        (exams || [])
          .map((exam) => exam.subjects?.teacher_school_id)
          .filter(Boolean)
      ),
    ];

    const facultyBySchoolId = new Map();
    if (teacherIds.length) {
      const { data: facultyRows } = await supabase
        .from("users")
        .select("school_id, first_name, last_name, department, avatar_url")
        .in("school_id", teacherIds);
      for (const faculty of facultyRows || []) {
        facultyBySchoolId.set(faculty.school_id, faculty);
      }
    }

    for (const exam of exams || []) {
      const subject = exam.subjects || {};
      const teacherId = subject.teacher_school_id;
      const faculty = facultyBySchoolId.get(teacherId);
      examMeta.set(exam.id, {
        exam_title: exam.title || "",
        subject_id: subject.id || exam.subject_id || "",
        subject_name: subject.name || "",
        section_count: subject.section_count ?? null,
        target_sections: Array.isArray(exam.target_sections) ? exam.target_sections : [],
        teacher_school_id: teacherId || "",
        faculty_name:
          [faculty?.first_name, faculty?.last_name].filter(Boolean).join(" ") || "—",
        faculty_department: faculty?.department || "—",
        faculty_avatar_url: faculty?.avatar_url || "",
      });
    }
  }

  const studentMeta = new Map();
  if (studentIds.length) {
    const { data: students } = await supabase
      .from("users")
      .select("id, department, course")
      .in("id", studentIds);
    for (const student of students || []) {
      studentMeta.set(student.id, {
        department: student.department || "—",
        course: student.course || "—",
      });
    }
  }

  const subjectIds = [
    ...new Set(
      [...examMeta.values()]
        .map((exam) => exam.subject_id)
        .filter(Boolean)
        .concat(rows.map((row) => row.subject_id).filter(Boolean))
    ),
  ];

  const enrollmentMeta = new Map();
  if (studentIds.length && subjectIds.length) {
    try {
      const { data: enrollments, error: enrollmentError } = await supabase
        .from("subject_students")
        .select("student_id, subject_id, section")
        .in("student_id", studentIds)
        .in("subject_id", subjectIds);
      if (!enrollmentError) {
        for (const enrollment of enrollments || []) {
          enrollmentMeta.set(`${enrollment.student_id}:${enrollment.subject_id}`, {
            section: String(enrollment.section || "A").trim().toUpperCase() || "A",
          });
        }
      }
    } catch {
      // Admin RLS may block direct enrollment reads; RPC student_section still applies.
    }
  }

  return rows.map((row) => {
    const exam = examMeta.get(row.exam_id) || {};
    const student = studentMeta.get(row.student_id) || {};
    const subjectId = exam.subject_id || row.subject_id || "";
    const enrollment = enrollmentMeta.get(`${row.student_id}:${subjectId}`) || {};
    return {
      ...row,
      exam_title: row.exam_title || exam.exam_title || "Assessment",
      subject_id: subjectId,
      subject_name: row.subject_name || exam.subject_name || "Unknown subject",
      section_count: exam.section_count ?? row.section_count ?? null,
      target_sections: exam.target_sections || row.target_sections || [],
      student_section:
        row.student_section || enrollment.section || "",
      faculty_name: exam.faculty_name || "—",
      faculty_department: exam.faculty_department || "—",
      faculty_avatar_url: exam.faculty_avatar_url || row.faculty_avatar_url || "",
      teacher_school_id: exam.teacher_school_id || row.teacher_school_id || "",
      student_department: student.department || "—",
      student_course: student.course || "—",
    };
  });
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
  const rows = normalizeJson(data) || [];
  return [...rows].sort((a, b) =>
    String(a.student_name || "").localeCompare(String(b.student_name || ""), undefined, {
      sensitivity: "base",
    })
  );
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
      let results = Array.isArray(report.results) ? report.results : [];
      if (!results.length) {
        try {
          results = await fetchAdminExportResults(examId);
        } catch {
          results = Array.isArray(report.students) ? report.students : [];
        }
      }
      return { ...report, questions, results, students: results };
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
      .select("description, instructions, exam_type, assessment_category, start_datetime, end_datetime, pass_mark")
      .eq("id", examId)
      .maybeSingle();
    description = examRow?.description || "";
    if (examRow) {
      meta.type = meta.type || examRow.exam_type;
      meta.category = meta.category || examRow.assessment_category;
      meta.start = meta.start || examRow.start_datetime;
      meta.end = meta.end || examRow.end_datetime;
      meta.pass_mark = examRow.pass_mark;
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
    pass_mark: Number.isFinite(Number(meta.pass_mark)) ? Number(meta.pass_mark) : 50,
    questions,
    students: results,
    results,
  };
}

export function getAccountStatus(profile) {
  const explicit = String(profile?.account_status || "")
    .trim()
    .toLowerCase();
  if (explicit === "rejected") return "deleted";
  if (explicit) return explicit;

  const role = String(profile?.role || "").toLowerCase();
  if (role === "admin") return "approved";
  return "pending";
}

/** Days left before a soft-deleted account is purged (0–7). */
export function getDeletedAccountDaysLeft(profile) {
  const deletedAt = profile?.deleted_at ? new Date(profile.deleted_at).getTime() : NaN;
  if (!Number.isFinite(deletedAt)) return null;
  const msLeft = deletedAt + 7 * 24 * 60 * 60 * 1000 - Date.now();
  if (msLeft <= 0) return 0;
  return Math.max(1, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
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
