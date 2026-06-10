import { supabase } from "../supabaseClient";

export function isAuthSessionError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return (
    message.includes("auth session missing") ||
    message.includes("session expired") ||
    message.includes("not authenticated") ||
    message.includes("jwt") ||
    message.includes("invalid refresh token")
  );
}

export async function getAuthSession() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    console.warn("getSession error:", error);
    return null;
  }

  if (session) return session;

  try {
    const { data: refreshed, error: refreshError } =
      await supabase.auth.refreshSession();

    if (refreshError) {
      return null;
    }

    return refreshed.session ?? null;
  } catch {
    return null;
  }
}

export async function requireAuthUser() {
  const session = await getAuthSession();
  if (!session?.user) {
    throw new Error("Your session expired. Please log out and log in again.");
  }
  return session.user;
}

export async function resolveStudentId() {
  const session = await getAuthSession();
  return session?.user?.id ?? null;
}

export function isStudentRole(role) {
  return String(role || "").toLowerCase() === "student";
}
