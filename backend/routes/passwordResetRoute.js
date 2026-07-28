const express = require("express");
const { createUserClient } = require("../lib/supabaseClient");
const { getSupabaseAdmin } = require("../lib/supabaseAdmin");

const router = express.Router();

function getUserClient(accessToken) {
  return createUserClient(accessToken);
}

async function requireAdmin(req, res, next) {
  try {
    const accessToken = String(req.headers.authorization || "")
      .replace(/^Bearer\s+/i, "")
      .trim();

    if (!accessToken) {
      return res.status(401).json({ error: "Missing authorization token" });
    }

    const userClient = getUserClient(accessToken);
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }

    const { data: profile, error: profileError } = await userClient
      .from("users")
      .select("id, role, account_status")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return res.status(403).json({ error: "Profile not found" });
    }

    const isAdmin =
      String(profile.role || "").toLowerCase() === "admin" &&
      (profile.account_status == null || profile.account_status === "approved");

    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    req.adminUserId = user.id;
    req.adminAccessToken = accessToken;
    next();
  } catch (err) {
    console.error("requireAdmin error:", err);
    res.status(500).json({ error: err.message || "Authorization failed" });
  }
}

router.post("/complete", requireAdmin, async (req, res) => {
  try {
    const { requestId, newPassword, adminNotes } = req.body || {};

    if (!requestId) {
      return res.status(400).json({ error: "requestId is required" });
    }

    const password = String(newPassword || "").trim();
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return res.status(503).json({
        error:
          "Password reset service is unavailable. Add SUPABASE_SERVICE_ROLE_KEY to backend/.env and restart the server.",
      });
    }

    const { data: requestRow, error: requestError } = await admin
      .from("password_reset_requests")
      .select("id, user_id, status, email")
      .eq("id", requestId)
      .maybeSingle();

    if (requestError) {
      return res.status(500).json({ error: requestError.message });
    }

    if (!requestRow || requestRow.status !== "pending") {
      return res.status(404).json({ error: "Pending password reset request not found" });
    }

    if (!requestRow.user_id) {
      return res.status(400).json({ error: "Request is not linked to a user account" });
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(
      requestRow.user_id,
      { password }
    );

    if (updateError) {
      const msg = updateError.message || "Failed to update password";
      if (/user not found|not found/i.test(msg)) {
        return res.status(404).json({
          error:
            "Auth user not found for this request. The account may have been deleted — reject the request instead.",
        });
      }
      return res.status(500).json({ error: msg });
    }

    // Prefer service-role update so completion does not depend on RPC/RLS quirks.
    const { data: completedRow, error: completeError } = await admin
      .from("password_reset_requests")
      .update({
        status: "completed",
        admin_notes: adminNotes || null,
        temporary_password: password,
        resolved_by: req.adminUserId,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (completeError || !completedRow) {
      // Fallback to authenticated RPC if direct update is blocked by schema/policies.
      const userClient = getUserClient(req.adminAccessToken);
      const { error: rpcError } = await userClient.rpc(
        "admin_complete_password_reset_request",
        {
          p_request_id: requestId,
          p_admin_notes: adminNotes || null,
        }
      );

      if (rpcError) {
        console.error("Failed to mark request completed:", completeError || rpcError);
        return res.status(500).json({
          error:
            "Password was updated but the request could not be marked completed. Re-run database/password_reset_requests.sql in Supabase, then try again.",
        });
      }

      // Best-effort: store temp password for user reveal even when RPC path was used.
      const { error: tempStoreError } = await admin
        .from("password_reset_requests")
        .update({ temporary_password: password })
        .eq("id", requestId);
      if (tempStoreError) {
        console.warn(
          "Password reset completed but temporary_password could not be stored:",
          tempStoreError.message
        );
      }
    }

    res.json({
      success: true,
      message: `Password reset for ${requestRow.email}`,
    });
  } catch (err) {
    console.error("Password reset complete error:", err);
    res.status(500).json({ error: err.message || "Failed to reset password" });
  }
});

module.exports = router;
