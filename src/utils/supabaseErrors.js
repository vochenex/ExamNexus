function collectErrorText(error) {
  if (!error) return "";
  return [
    error.message,
    error.details,
    error.hint,
    error.error_description,
  ]
    .filter(Boolean)
    .join(" ");
}

function includesAny(text, needles) {
  const haystack = String(text || "").toLowerCase();
  return needles.some((needle) => haystack.includes(needle));
}

export function isMissingRpcError(error) {
  const message = error?.message || "";
  return (
    message.includes("Could not find the function") ||
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    error?.code === "PGRST202" ||
    error?.code === "42883"
  );
}

/**
 * Turn Supabase / Postgres errors into user-facing messages.
 * @param {object|null|undefined} error
 * @param {{ context?: 'signup'|'login'|'profile'|'forgot-password'|'generic', fallback?: string }} [options]
 */
export function formatSupabaseError(error, options = {}) {
  const { context = "generic", fallback } = options;

  if (!error) {
    return fallback || "Something went wrong. Please try again.";
  }

  const message = String(error.message || "").trim();
  const combined = collectErrorText(error);
  const lower = combined.toLowerCase();

  if (/database error saving new user/i.test(message)) {
    if (context === "signup") {
      return "Could not create your account. Your School ID or email is likely already registered — use a different School ID, log in with your existing account, or contact your administrator.";
    }
    return "Could not save account data. Contact your administrator if this continues.";
  }

  if (
    error.code === "23505" ||
    includesAny(lower, ["unique constraint", "duplicate key", "already exists"])
  ) {
    if (includesAny(lower, ["school_id", "users_school_id"])) {
      return "This School ID is already registered. Use a different School ID or log in with your existing account.";
    }
    if (includesAny(lower, ["email", "users_email"])) {
      return "This email is already registered. Log in or use a different email.";
    }
    if (context === "signup") {
      return "School ID or email is already registered.";
    }
  }

  if (/user already registered/i.test(message)) {
    return "This email is already registered. Log in or reset your password.";
  }

  if (/invalid login credentials/i.test(message)) {
    if (context === "login") {
      return "Incorrect email or password. If your email was recently changed in Supabase, sign in with the new school email (lastname.firstname@crmc.en.com), not your old Gmail address.";
    }
    return "Incorrect email or password.";
  }

  if (/email not confirmed/i.test(message)) {
    return "Confirm your email address before logging in.";
  }

  if (isMissingRpcError(error)) {
    if (context === "signup" || context === "profile") {
      return "Account setup is incomplete. Run database/users_signup_policies.sql in Supabase, then reload the API schema.";
    }
    if (context === "forgot-password") {
      return "Password reset is not set up yet. Run database/admin_platform_fixes.sql in Supabase, then reload the API schema.";
    }
  }

  if (message && !/^PGRST\d+/i.test(message)) {
    return message;
  }

  return fallback || message || "Something went wrong. Please try again.";
}
