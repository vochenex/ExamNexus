process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err?.message || err);
});

process.on("unhandledRejection", (reason) => {
  const code = reason?.cause?.code || reason?.code;
  if (
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "SUPABASE_FETCH_TIMEOUT" ||
    String(reason?.message || "").includes("fetch failed")
  ) {
    console.warn(
      "⚠️  Supabase network timeout (backend still running). Check your internet connection."
    );
    return;
  }
  console.error("UNHANDLED REJECTION:", reason?.message || reason);
});

const fs = require("fs");
const path = require("path");
// Vercel Express detection requires a direct express import in the entry file.
const express = require("express");
const createAppModule = require("./createApp");
const { getSupabaseAdmin } = require("./lib/supabaseAdmin");
const { getAiServiceStatus } = require("./lib/aiProvider");

void express;

const createApp =
  typeof createAppModule === "function"
    ? createAppModule
    : createAppModule?.createApp ||
      createAppModule?.default?.createApp ||
      createAppModule?.default;

if (typeof createApp !== "function") {
  console.error("createApp export shape:", createAppModule);
  throw new Error("createApp export is not a function");
}

const app = createApp();

// ================= START SERVER (local / non-Vercel) =================
const PREFERRED_PORT = Number(process.env.PORT) || 5000;
const MAX_PORT_TRIES = 10;

function syncFrontendApiUrl(port) {
  if (port === 5000) return;

  const apiUrl = `http://localhost:${port}`;
  const envPath = path.join(__dirname, "..", ".env");
  let content = "";

  try {
    content = fs.readFileSync(envPath, "utf8");
  } catch {
    content = "";
  }

  const line = `VITE_API_BASE_URL=${apiUrl}`;
  if (/^VITE_API_BASE_URL=/m.test(content)) {
    content = content.replace(/^VITE_API_BASE_URL=.*$/m, line);
  } else {
    content = `${content.trimEnd()}${content ? "\n" : ""}${line}\n`;
  }

  fs.writeFileSync(envPath, content);
  console.log(`   Updated root .env → ${line}`);
  console.log("   Vite will restart automatically to use the new backend URL.");
}

function listenOnAvailablePort(port, attempt = 0) {
  const server = app.listen(port, "0.0.0.0");

  server.on("listening", async () => {
    const actualPort = server.address().port;

    if (actualPort !== PREFERRED_PORT) {
      console.warn(
        `⚠️  Port ${PREFERRED_PORT} was busy — using http://localhost:${actualPort} instead.`
      );
      syncFrontendApiUrl(actualPort);
    }

    console.log(`🚀 Backend running on http://localhost:${actualPort}`);
    console.log(`   LAN access: http://<your-ip>:${actualPort} (needed for the Android APK)`);
    console.log("   Keep this terminal open while using the app.");

    if (getSupabaseAdmin()) {
      console.log("✅ Service role key loaded (password reset + enrollment enabled)");
    } else {
      console.log(
        "⚠️  SUPABASE_SERVICE_ROLE_KEY is missing or empty in backend/.env"
      );
      console.log(
        "    → Supabase Dashboard → Project Settings → API → copy service_role key"
      );
      console.log(
        "    → Admin password resets and invite enrollment will not work until set"
      );
    }

    try {
      const aiStatus = await getAiServiceStatus();
      if (aiStatus.configured) {
        console.log(`✅ Assessment AI ready (Gemini: ${aiStatus.model})`);
      } else {
        console.log(`⚠️  Assessment AI unavailable — ${aiStatus.error}`);
      }
    } catch (err) {
      console.log(`⚠️  Assessment AI status check failed — ${err.message}`);
    }

    if (!String(process.env.SUPABASE_JWT_SECRET || "").trim()) {
      console.log(
        "⚠️  SUPABASE_JWT_SECRET is not set — faculty auth may fail when Supabase is slow."
      );
      console.log(
        "    → Supabase Dashboard → Project Settings → API → JWT Secret → add to backend/.env"
      );
    }
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE" && attempt + 1 < MAX_PORT_TRIES) {
      console.warn(`Port ${port} is in use, trying ${port + 1}...`);
      listenOnAvailablePort(port + 1, attempt + 1);
      return;
    }

    if (err.code === "EADDRINUSE") {
      console.error(
        `\n❌ No free port found between ${PREFERRED_PORT} and ${port}.`
      );
      console.error("   To free port 5000 in PowerShell, run this exact command:");
      console.error(
        "   Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"
      );
      process.exit(1);
      return;
    }

    console.error("Server failed to start:", err);
    process.exit(1);
  });

  return server;
}

// Only listen when run directly (`npm start`). Vercel requires this module and must not bind a port.
if (require.main === module) {
  listenOnAvailablePort(PREFERRED_PORT);
}

module.exports = app;
