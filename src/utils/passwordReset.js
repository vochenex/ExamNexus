import { supabase } from "../supabaseClient";
import { getAuthSession } from "./authUser";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export async function submitPasswordResetRequest({ email, schoolId, message }) {
  const { data, error } = await supabase.rpc("submit_password_reset_request", {
    p_email: email,
    p_school_id: schoolId,
    p_message: message || null,
  });

  if (error) throw error;
  return data || {};
}

export async function fetchAdminPasswordResetRequests(status = "pending") {
  const { data, error } = await supabase.rpc("admin_list_password_reset_requests", {
    p_status: status || null,
  });
  if (error) throw error;
  return data || [];
}

export async function rejectAdminPasswordResetRequest(requestId, adminNotes = null) {
  const { data, error } = await supabase.rpc("admin_reject_password_reset_request", {
    p_request_id: requestId,
    p_admin_notes: adminNotes,
  });
  if (error) throw error;
  return data;
}

export async function completeAdminPasswordResetRequest({
  requestId,
  newPassword,
  adminNotes = null,
}) {
  const session = await getAuthSession();
  if (!session?.access_token) {
    throw new Error("Your session expired. Please log in again.");
  }

  const res = await fetch(`${API_BASE}/password-reset/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      requestId,
      newPassword,
      adminNotes,
    }),
  });

  const payload = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(payload.error || "Failed to reset password");
  }

  return payload;
}
