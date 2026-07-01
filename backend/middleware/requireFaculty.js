const { createClient } = require("@supabase/supabase-js");

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

    if (!accessToken) {
      return res.status(401).json({ error: "Missing authorization token. Please sign in again." });
    }

    const userClient = getUserClient(accessToken);
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return res.status(401).json({ error: "Invalid or expired session. Please sign in again." });
    }

    const { data: profile, error: profileError } = await userClient
      .from("users")
      .select("id, role, account_status, avatar_url")
      .eq("id", user.id)
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
    console.error("requireFaculty error:", err);
    res.status(500).json({ error: err.message || "Authorization failed" });
  }
}

module.exports = { requireFaculty, isApprovedFaculty };
