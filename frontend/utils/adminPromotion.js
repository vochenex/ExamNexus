import { API_BASE } from "./apiBase.js";
import { getAuthSession } from "./authUser";

async function postAuthed(path, body, fallback) {
  const session = await getAuthSession();
  if (!session?.access_token) {
    throw new Error("Your session expired. Please log in again.");
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body || {}),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || fallback);
  return payload;
}

/** Makes the account an admin; they set a 3-digit admin ID the next time they sign in. */
export async function promoteUserToAdmin(userId) {
  const { user } = await postAuthed(
    `/admin/users/${encodeURIComponent(userId)}/promote`,
    {},
    "Could not promote this account."
  );
  return user;
}

export async function saveOwnAdminId(schoolId) {
  const { user } = await postAuthed("/admin/me/admin-id", { schoolId }, "Could not save your admin ID.");
  return user;
}

export function isAdminIdRequired(authUser) {
  return authUser?.user_metadata?.admin_id_required === true;
}
