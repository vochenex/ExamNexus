import { supabase } from "../supabaseClient";

export async function getAuthSession() {
  let {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) throw error;

  if (!session) {
    const { data: refreshed, error: refreshError } =
      await supabase.auth.refreshSession();
    if (refreshError) throw refreshError;
    session = refreshed.session;
  }

  return session;
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
  const cached = JSON.parse(localStorage.getItem("examnexus_user") || "{}");
  return session?.user?.id || cached.id || null;
}

export function isStudentRole(role) {
  return String(role || "").toLowerCase() === "student";
}
