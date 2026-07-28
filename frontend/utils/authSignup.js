import { formatSupabaseError, isMissingRpcError } from "./supabaseErrors";

function conflictMessage(emailTaken, schoolIdTaken) {
  if (emailTaken && schoolIdTaken) {
    return "This email and School ID are already registered. Try logging in instead.";
  }
  if (emailTaken) {
    return "This email is already registered. Log in or use a different email.";
  }
  if (schoolIdTaken) {
    return "This School ID is already registered. Use a different School ID or contact your administrator.";
  }
  return "School ID or email is already registered.";
}

function detectConflictsFromRows(rows, email, schoolId) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedSchoolId = String(schoolId || "").trim();

  const emailTaken = (rows || []).some(
    (row) => String(row.email || "").trim().toLowerCase() === normalizedEmail
  );
  const schoolIdTaken = (rows || []).some(
    (row) => String(row.school_id || "").trim() === normalizedSchoolId
  );

  return { emailTaken, schoolIdTaken };
}

/**
 * Check whether email / school ID are available before sign-up.
 * Uses a security-definer RPC when available; falls back to a direct query.
 */
export async function checkSignupCredentials(supabase, email, schoolId) {
  const trimmedEmail = String(email || "").trim();
  const trimmedSchoolId = String(schoolId || "").trim();

  const { data, error } = await supabase.rpc("check_signup_credentials", {
    p_email: trimmedEmail,
    p_school_id: trimmedSchoolId,
  });

  if (!error && data) {
    if (data.ok === false) {
      return {
        ok: false,
        message:
          data.message ||
          conflictMessage(data.email_taken, data.school_id_taken),
      };
    }
    return { ok: true };
  }

  if (error && !isMissingRpcError(error)) {
    return {
      ok: false,
      message: formatSupabaseError(error, { context: "signup" }),
    };
  }

  const { data: rows, error: queryError } = await supabase
    .from("users")
    .select("email, school_id")
    .or(`school_id.eq.${trimmedSchoolId},email.eq.${trimmedEmail}`);

  if (queryError) {
    return { ok: true };
  }

  const { emailTaken, schoolIdTaken } = detectConflictsFromRows(
    rows,
    trimmedEmail,
    trimmedSchoolId
  );

  if (emailTaken || schoolIdTaken) {
    return {
      ok: false,
      message: conflictMessage(emailTaken, schoolIdTaken),
    };
  }

  return { ok: true };
}
