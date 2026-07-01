import { supabase } from "../supabaseClient";
import { getAuthSession } from "./authUser";
import { requireSession } from "./supabaseData";

import { API_BASE } from "./apiBase.js";

function isMissingRpcError(error) {
  const message = error?.message || "";
  return (
    message.includes("Could not find the function") ||
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    error?.code === "PGRST202" ||
    error?.code === "42883"
  );
}

function sortPasswordResetRows(rows) {
  return [...(rows || [])].sort((a, b) => {
    const rank = (status) => (status === "pending" ? 0 : 1);
    const byStatus = rank(a.status) - rank(b.status);
    if (byStatus !== 0) return byStatus;
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });
}

async function fetchPasswordResetRequestsDirect(status) {
  let query = supabase.from("password_reset_requests").select("*");

  if (status) {
    query = query.eq("status", String(status).toLowerCase());
  }

  const { data, error } = await query;
  if (error) throw error;
  return sortPasswordResetRows(data);
}

export async function submitPasswordResetRequest({ email, schoolId, message }) {
  const { data, error } = await supabase.rpc("submit_password_reset_request", {
    p_email: email,
    p_school_id: schoolId,
    p_message: message || null,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      throw new Error(
        "Password reset is not set up yet. Run database/admin_platform_fixes.sql in Supabase SQL Editor, then reload the API schema."
      );
    }
    throw error;
  }

  return data || {};
}

export async function fetchAdminPasswordResetRequests(status = "pending") {
  await requireSession();

  const pStatus = status || null;
  const { data, error } = await supabase.rpc("admin_list_password_reset_requests", {
    p_status: pStatus,
  });

  if (!error) {
    return sortPasswordResetRows(data);
  }

  if (isMissingRpcError(error)) {
    try {
      return await fetchPasswordResetRequestsDirect(pStatus);
    } catch (directError) {
      console.error("Password reset RPC and direct query failed:", error, directError);
      throw new Error(
        "Password reset functions are not available. Re-run database/admin_platform_fixes.sql, then in Supabase go to Project Settings → API → Reload schema."
      );
    }
  }

  throw error;
}

export async function rejectAdminPasswordResetRequest(requestId, adminNotes = null) {
  await requireSession();

  const { data, error } = await supabase.rpc("admin_reject_password_reset_request", {
    p_request_id: requestId,
    p_admin_notes: adminNotes,
  });

  if (error) throw error;
  return data;
}

function isServiceRoleConfigError(message) {
  return /service.?role|password reset service is unavailable/i.test(
    String(message || "")
  );
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
    const message = payload.error || "Failed to reset password";
    if (res.status === 503 && isServiceRoleConfigError(message)) {
      throw new Error(
        "Password reset is not configured on the server. In Supabase go to Project Settings → API, copy the service_role key, add SUPABASE_SERVICE_ROLE_KEY=... to backend/.env, then restart the backend (npm start in the backend folder)."
      );
    }
    throw new Error(message);
  }

  return payload;
}
