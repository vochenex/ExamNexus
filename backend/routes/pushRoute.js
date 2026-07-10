const express = require("express");
const { getSupabaseAdmin } = require("../lib/supabaseAdmin");
const { resolveUserIdFromAccessToken } = require("../lib/verifyAccessToken");
const {
  notifyAnnouncementRecipients,
  sendPushToUsers,
  isPushConfigured,
  getPushApiMode,
} = require("../lib/pushSender");

const router = express.Router();

async function requireAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) {
      return res.status(401).json({ error: "Missing authorization token" });
    }
    const userId = await resolveUserIdFromAccessToken(token);
    req.authUserId = userId;
    next();
  } catch (err) {
    return res.status(err.statusCode || 401).json({
      error: err.message || "Unauthorized",
    });
  }
}

router.get("/status", (_req, res) => {
  res.json({
    ok: true,
    fcmConfigured: isPushConfigured(),
    api: getPushApiMode(),
  });
});

/**
 * POST /push/announce
 * body: { subjectId, title, body, targetSections?, path? }
 * Faculty/admin trigger after posting an announcement.
 */
router.post("/announce", requireAuth, async (req, res) => {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) {
      return res.status(503).json({
        error: "SUPABASE_SERVICE_ROLE_KEY is required to send push notifications",
      });
    }

    const { subjectId, title, body, targetSections, path } = req.body || {};
    if (!subjectId || !title) {
      return res.status(400).json({ error: "subjectId and title are required" });
    }

    const result = await notifyAnnouncementRecipients(admin, {
      subjectId,
      title,
      body,
      targetSections: Array.isArray(targetSections) ? targetSections : null,
      path: path || `/student/subject/${subjectId}/social`,
    });

    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("push/announce:", err);
    res.status(500).json({ error: err.message || "Failed to send push" });
  }
});

/**
 * POST /push/notify-users
 * body: { userIds: string[], title, body, data? }
 */
router.post("/notify-users", requireAuth, async (req, res) => {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) {
      return res.status(503).json({
        error: "SUPABASE_SERVICE_ROLE_KEY is required to send push notifications",
      });
    }

    const { userIds, title, body, data } = req.body || {};
    if (!Array.isArray(userIds) || !title) {
      return res.status(400).json({ error: "userIds[] and title are required" });
    }

    const result = await sendPushToUsers(admin, userIds, {
      title,
      body: body || "",
      data: data || {},
    });

    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("push/notify-users:", err);
    res.status(500).json({ error: err.message || "Failed to send push" });
  }
});

module.exports = router;
