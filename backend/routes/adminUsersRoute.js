const express = require("express");
const { requireAdmin } = require("../middleware/requireAdmin");
const { getSupabaseAdmin } = require("../lib/supabaseAdmin");
const { publicErrorMessage } = require("../lib/publicError");

const router = express.Router();

const ADMIN_ROLE = "Admin";
const ADMIN_ID_PATTERN = /^\d{3}$/;

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.expose = true;
  return err;
}

/** updateUserById replaces user_metadata wholesale, so merge with the current values first. */
async function mergeUserMetadata(admin, userId, patch) {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) throw error;
  const current = data?.user?.user_metadata || {};
  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: { ...current, ...patch },
  });
  if (updateError) throw updateError;
}

function sendError(res, err, fallback) {
  const status = err.statusCode || 500;
  if (status >= 500) console.error(fallback, err);
  res.status(status).json({ error: err.expose ? err.message : publicErrorMessage(err, fallback) });
}

/**
 * Promotes an account to admin. The user must set a 3-digit admin ID the next time
 * they sign in (flagged through auth metadata `admin_id_required`).
 */
router.post("/users/:id/promote", requireAdmin, async (req, res) => {
  try {
    const admin = getSupabaseAdmin();
    const userId = String(req.params.id || "").trim();
    if (!userId) throw httpError(400, "Choose an account to promote.");
    if (userId === req.adminUser.id) throw httpError(400, "You are already an administrator.");

    const { data: target, error: targetError } = await admin
      .from("users")
      .select("id, role, account_status")
      .eq("id", userId)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target) throw httpError(404, "That account no longer exists.");
    if (String(target.account_status || "").toLowerCase() === "deleted") {
      throw httpError(400, "Restore this account before promoting it.");
    }

    const { data: updated, error: updateError } = await admin
      .from("users")
      .update({ role: ADMIN_ROLE, account_status: "approved" })
      .eq("id", userId)
      .select("*")
      .single();
    if (updateError) throw updateError;

    await mergeUserMetadata(admin, userId, { role: ADMIN_ROLE, admin_id_required: true });

    res.json({ user: updated });
  } catch (err) {
    sendError(res, err, "Could not promote this account.");
  }
});

/** Saves the signed-in admin's own 3-digit admin ID and clears the promotion prompt. */
router.post("/me/admin-id", requireAdmin, async (req, res) => {
  try {
    const admin = getSupabaseAdmin();
    const userId = req.adminUser.id;
    const schoolId = digitsOnly(req.body?.schoolId);
    if (!ADMIN_ID_PATTERN.test(schoolId)) {
      throw httpError(400, "Admin ID number must be exactly 3 digits.");
    }

    const { data: taken, error: takenError } = await admin
      .from("users")
      .select("id")
      .eq("school_id", schoolId)
      .neq("id", userId)
      .limit(1);
    if (takenError) throw takenError;
    if (taken?.length) throw httpError(409, "This ID number is already used by another account.");

    const { data: current, error: currentError } = await admin
      .from("users")
      .select("school_id")
      .eq("id", userId)
      .maybeSingle();
    if (currentError) throw currentError;
    const oldSchoolId = digitsOnly(current?.school_id);

    const { data: updated, error: updateError } = await admin
      .from("users")
      .update({ school_id: schoolId })
      .eq("id", userId)
      .select("*")
      .single();
    if (updateError) throw updateError;

    // A promoted faculty member keeps ownership of their subjects under the new ID.
    if (oldSchoolId && oldSchoolId !== schoolId) {
      const { error: remapError } = await admin
        .from("subjects")
        .update({ teacher_school_id: schoolId })
        .eq("teacher_school_id", oldSchoolId);
      if (remapError) console.warn("Could not remap subjects to new admin ID:", remapError.message);
    }

    await mergeUserMetadata(admin, userId, {
      admin_id_required: false,
      school_id: schoolId,
      schoolId,
    });

    res.json({ user: updated });
  } catch (err) {
    sendError(res, err, "Could not save your admin ID.");
  }
});

module.exports = router;
