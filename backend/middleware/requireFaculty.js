const { getSupabaseAdmin } = require("../lib/supabaseAdmin");
const { resolveUserIdFromAccessToken } = require("../lib/verifyAccessToken");

function normalizeRole(profile) {
  return String(profile?.role || "").trim().toLowerCase();
}

function normalizeStatus(profile) {
  const raw = profile?.account_status;
  if (raw == null || String(raw).trim() === "") return "approved";
  return String(raw).trim().toLowerCase();
}

function isApprovedFaculty(profile) {
  const role = normalizeRole(profile);
  const status = normalizeStatus(profile);
  const approved = status === "approved";

  // Admins can manage assessments / AI the same way faculty can.
  if (role === "admin") return true;
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
      const role = normalizeRole(profile);
      const status = normalizeStatus(profile);

      if (role === "faculty" && status !== "approved") {
        return res.status(403).json({
          error:
            status === "pending"
              ? "Your faculty account is still pending approval. Ask an admin to approve it, then try AI generation again."
              : "Your faculty account is not approved for AI assessment generation. Contact an administrator.",
        });
      }

      return res.status(403).json({
        error: "Only approved faculty or admin accounts can use AI assessment generation.",
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
