const { getSupabaseAdmin } = require("../lib/supabaseAdmin");
const { resolveUserIdFromAccessToken } = require("../lib/verifyAccessToken");

function isApprovedFaculty(profile) {
  const role = String(profile?.role || "").toLowerCase();
  const status = profile?.account_status;
  const approved = status == null || status === "approved";
  return role === "faculty" && approved;
}

async function requireFaculty(req, res, next) {
  try {
    const accessToken = String(req.headers.authorization || "")
      .replace(/^Bearer\s+/i, "")
      .trim();

    const userId = await resolveUserIdFromAccessToken(accessToken);

    const admin = getSupabaseAdmin();
    if (!admin) {
      return res.status(503).json({
        error: "Server auth is not configured. Add SUPABASE_SERVICE_ROLE_KEY to backend/.env.",
      });
    }

    const { data: profile, error: profileError } = await admin
      .from("users")
      .select("id, role, account_status, avatar_url")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !profile) {
      return res.status(403).json({ error: "Faculty profile not found." });
    }

    if (!isApprovedFaculty(profile)) {
      return res.status(403).json({
        error: "Only approved faculty accounts can use AI assessment generation.",
      });
    }

    req.facultyUser = profile;
    req.facultyAccessToken = accessToken;
    next();
  } catch (err) {
    const status = err.statusCode || 500;
    if (status >= 500) {
      console.error("requireFaculty error:", err);
    }
    res.status(status).json({ error: err.message || "Authorization failed" });
  }
}

module.exports = { requireFaculty, isApprovedFaculty };
