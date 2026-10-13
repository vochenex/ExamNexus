/**
 * Express app factory — used by local `server.js` and Vercel `api/index.js`.
 */
const path = require("path");
const fs = require("fs");

// Load backend/.env for local runs only. On Vercel, env vars come from the dashboard
// and must not be overridden by a missing/empty file.
if (!process.env.VERCEL) {
  require("dotenv").config({
    path: path.join(__dirname, ".env"),
    override: true,
  });
}

const express = require("express");
const cors = require("cors");
const subjectsRoute = require("./routes/subjectsRoute");
const analyticsRoute = require("./routes/analyticsRoute");
const passwordResetRoute = require("./routes/passwordResetRoute");
const assessmentAiRoute = require("./routes/assessmentAiRoute");
const pushRoute = require("./routes/pushRoute");
const adminStudentsRoute = require("./routes/adminStudentsRoute");
const adminUsersRoute = require("./routes/adminUsersRoute");
const { getSupabaseAdmin } = require("./lib/supabaseAdmin");
const { getAiServiceStatus } = require("./lib/aiProvider");
const { isPushConfigured, getPushApiMode } = require("./lib/pushSender");
const { publicErrorMessage } = require("./lib/publicError");

function ensureUploadsDir() {
  try {
    fs.mkdirSync(path.join(__dirname, "uploads"), { recursive: true });
  } catch {
    // Serverless filesystems may be read-only outside /tmp — memory uploads cover that.
  }
}

function createApp() {
  ensureUploadsDir();

  const app = express();

  app.use(cors({ origin: "*" }));
  app.use(express.json({ limit: "2mb" }));

  // Vercel Services may forward /api/... to this Express app with the prefix intact.
  app.use((req, _res, next) => {
    const url = req.url || "/";
    if (url === "/api") {
      req.url = "/";
    } else if (url.startsWith("/api?")) {
      req.url = `/${url.slice(4)}`;
    } else if (url.startsWith("/api/")) {
      req.url = url.slice(4) || "/";
    }
    next();
  });

  app.get("/", (req, res) => {
    res.send("🚀 ExamNexus Backend Running");
  });

  app.get("/health", async (req, res) => {
    try {
      const hasServiceRole = Boolean(getSupabaseAdmin());
      let aiStatus = {
        configured: false,
        error: "AI status unavailable",
      };
      try {
        aiStatus = await getAiServiceStatus();
      } catch (err) {
        aiStatus = { configured: false, error: publicErrorMessage(err) };
      }

      const hasSupabase = Boolean(
        process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
      );
      const hasAnon = Boolean(
        process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
      );

      res.json({
        ok: hasSupabase && hasAnon,
        passwordReset: hasServiceRole,
        enrollment: hasServiceRole,
        assessmentAi: aiStatus.configured,
        pushNotifications: isPushConfigured(),
        pushApi: getPushApiMode(),
        promptProvider: aiStatus.promptProvider,
        documentProvider: aiStatus.documentProvider,
        promptModel: aiStatus.promptModel,
        documentModel: aiStatus.documentModel,
        supabaseConfigured: hasSupabase && hasAnon,
        message: !hasSupabase || !hasAnon
          ? "Add SUPABASE_URL and SUPABASE_ANON_KEY in Vercel Environment Variables"
          : hasServiceRole
            ? "Service role key loaded"
            : "Add SUPABASE_SERVICE_ROLE_KEY (Supabase → Project Settings → API → service_role)",
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: publicErrorMessage(err) });
    }
  });

  app.use("/subjects", subjectsRoute);
  app.use("/analytics", analyticsRoute);
  app.use("/password-reset", passwordResetRoute);
  app.use("/assessment-ai", assessmentAiRoute);
  app.use("/push", pushRoute);
  app.use("/admin", adminStudentsRoute);
  app.use("/admin", adminUsersRoute);

  app.use((err, req, res, _next) => {
    console.error("GLOBAL EXPRESS ERROR:", err);
    res.status(500).json({
      error: publicErrorMessage(err, "Something went wrong on the server. Please try again in a moment."),
    });
  });

  return app;
}

module.exports = createApp;
module.exports.createApp = createApp;
