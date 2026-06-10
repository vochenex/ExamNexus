const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const { getSupabaseAdmin } = require("../lib/supabaseAdmin");

const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

function getUserClient(accessToken) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: { autoRefreshToken: false, persistSession: false },
  });
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
      return res.status(500).json({ error: updateError.message });
    }

    const userClient = getUserClient(req.adminAccessToken);
    const { error: completeError } = await userClient.rpc(
      "admin_complete_password_reset_request",
      {
        p_request_id: requestId,
        p_admin_notes: adminNotes || null,
      }
    );

    if (completeError) {
      console.error("Failed to mark request completed:", completeError);
      return res.status(500).json({
        error:
          "Password was updated but the request could not be marked completed. Check Supabase RPC admin_complete_password_reset_request.",
      });
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
