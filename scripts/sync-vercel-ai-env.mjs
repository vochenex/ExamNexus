/**
 * Upsert ExamNexus AI env vars on Vercel from backend/.env (no secrets logged).
 * Requires: npx vercel login (or VERCEL_TOKEN), and project linked / --yes.
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const envPath = path.join(root, "backend", ".env");
const raw = fs.readFileSync(envPath, "utf8");

function get(name) {
  const match = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  return match ? String(match[1] || "").trim() : "";
}

const vars = {
  GROQ_API_KEY: get("GROQ_API_KEY"),
  GROQ_MODEL: get("GROQ_MODEL") || "openai/gpt-oss-20b",
  GROQ_FALLBACK_MODEL: get("GROQ_FALLBACK_MODEL") || "openai/gpt-oss-120b",
  GROQ_SECONDARY_FALLBACK_MODEL:
    get("GROQ_SECONDARY_FALLBACK_MODEL") || "qwen/qwen3.6-27b",
  GEMINI_API_KEY: get("GEMINI_API_KEY"),
  GEMINI_MODEL: get("GEMINI_MODEL") || "gemini-2.5-flash",
};

for (const [key, value] of Object.entries(vars)) {
  if (!value) {
    console.error(`Missing ${key} in backend/.env`);
    process.exit(1);
  }
}

const environments = ["production", "preview", "development"];

function runVercel(args, input) {
  return spawnSync("npx", ["--yes", "vercel", ...args], {
    cwd: root,
    input: input || undefined,
    encoding: "utf8",
    shell: true,
    env: process.env,
  });
}

console.log("Checking Vercel login...");
const who = runVercel(["whoami"]);
if (who.status !== 0) {
  console.error("Vercel CLI is not logged in. Run: npx vercel login");
  console.error((who.stderr || who.stdout || "").slice(0, 500));
  process.exit(1);
}
console.log(`Logged in as: ${(who.stdout || "").trim()}`);

console.log("Linking project...");
const link = runVercel(["link", "--yes"]);
if (link.status !== 0) {
  console.error("vercel link failed:");
  console.error((link.stderr || link.stdout || "").slice(0, 800));
  process.exit(1);
}

for (const [key, value] of Object.entries(vars)) {
  for (const envName of environments) {
    runVercel(["env", "rm", key, envName, "--yes"]);
    const add = runVercel(["env", "add", key, envName], `${value}\n`);
    if (add.status !== 0) {
      console.error(`Failed to set ${key} (${envName})`);
      console.error((add.stderr || add.stdout || "").slice(0, 500));
      process.exit(1);
    }
    console.log(`Set ${key} → ${envName}`);
  }
}

console.log("Triggering production redeploy...");
const deploy = runVercel(["deploy", "--prod", "--yes"]);
if (deploy.status !== 0) {
  console.error("Deploy failed (env vars may still be saved):");
  console.error((deploy.stderr || deploy.stdout || "").slice(0, 800));
  process.exit(1);
}
console.log((deploy.stdout || "").trim().split("\n").slice(-8).join("\n"));
console.log("Done.");
