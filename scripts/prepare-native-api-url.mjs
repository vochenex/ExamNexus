/**
 * When building the APK, resolve the API base URL:
 * - Default: rewrite localhost → this machine's LAN IP (same Wi‑Fi testing)
 * - --production: use public Vercel/API URL so any internet user can reach AI
 *
 * Writes `.env.capacitor.local` (gitignored) for Vite to pick up on `cap:*` builds.
 */
import os from "os";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outFile = path.join(root, ".env.capacitor.local");
const wantProduction = process.argv.includes("--production");

function readEnvFile(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function getEnvValue(content, key) {
  const match = content.match(new RegExp(`^${key}=(.*)$`, "m"));
  return match ? match[1].trim().replace(/^["']|["']$/g, "") : "";
}

function pickLanIp() {
  const nets = os.networkInterfaces();
  const scored = [];

  for (const [name, entries] of Object.entries(nets)) {
    const lower = String(name || "").toLowerCase();
    if (
      /virtual|vmware|vbox|loopback|docker|wsl|hyper-v|vethernet|tailscale|zerotier|hamachi|vpn/i.test(
        lower
      )
    ) {
      continue;
    }

    for (const net of entries || []) {
      if (net.family !== "IPv4" || net.internal) continue;
      let score = 0;
      if (/wi-?fi|wlan|wireless|wifi/i.test(lower)) score += 50;
      if (/ethernet|eth|lan/i.test(lower)) score += 30;
      if (net.address.startsWith("192.168.")) score += 20;
      else if (net.address.startsWith("10.")) score += 10;
      else if (net.address.startsWith("172.")) score += 5;
      if (/^192\.168\.(56|57|58|59)\./.test(net.address)) score -= 40;
      scored.push({ address: net.address, score, name });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.address || "";
}

function resolvePort(apiUrl, backendEnv) {
  const fromUrl = apiUrl.match(/:(\d+)(?:\/|$)/);
  if (fromUrl) return fromUrl[1];
  const fromBackend = getEnvValue(backendEnv, "PORT");
  if (fromBackend) return fromBackend;
  return "5000";
}

async function probePort(host, port) {
  try {
    const res = await fetch(`http://${host}:${port}/health`, {
      signal: AbortSignal.timeout(1500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function resolveLivePort(preferredPort) {
  const candidates = [
    preferredPort,
    "5000",
    "5001",
    "5002",
    getEnvValue(readEnvFile(path.join(root, "backend", ".env")), "PORT"),
  ].filter(Boolean);
  const unique = [...new Set(candidates.map(String))];

  for (const port of unique) {
    if (await probePort("127.0.0.1", port)) return port;
  }
  return preferredPort || "5000";
}

function toPublicApiBase(url) {
  let next = String(url || "").replace(/\/+$/, "");
  if (!next) return "";
  if (!/^https?:\/\//i.test(next)) {
    next = `https://${next}`;
  }
  if (!/\/api$/i.test(next)) {
    next = `${next}/api`;
  }
  return next;
}

const rootEnv = readEnvFile(path.join(root, ".env"));
const backendEnv = readEnvFile(path.join(root, "backend", ".env"));

let nextUrl = "";

if (wantProduction) {
  const production =
    process.env.VITE_PRODUCTION_API_URL ||
    getEnvValue(rootEnv, "VITE_PRODUCTION_API_URL") ||
    process.env.VITE_API_BASE_URL ||
    getEnvValue(rootEnv, "VITE_API_BASE_URL") ||
    process.env.VITE_WEBSITE_URL ||
    getEnvValue(rootEnv, "VITE_WEBSITE_URL") ||
    "";

  nextUrl = toPublicApiBase(production);

  if (!nextUrl || /localhost|127\.0\.0\.1|192\.168\./i.test(nextUrl)) {
    console.error(
      "[prepare-native-api-url] --production needs a public URL.\n" +
        "  Set VITE_WEBSITE_URL=https://your-app.vercel.app in root .env\n" +
        "  (or VITE_PRODUCTION_API_URL=https://your-app.vercel.app/api)"
    );
    process.exit(1);
  }

  console.log(`[prepare-native-api-url] Production API base → ${nextUrl}`);
} else {
  const configured =
    process.env.VITE_API_BASE_URL ||
    getEnvValue(rootEnv, "VITE_API_BASE_URL") ||
    "http://localhost:5000";

  nextUrl = configured.replace(/\/+$/, "");

  if (/localhost|127\.0\.0\.1/i.test(nextUrl)) {
    const lanIp = pickLanIp();
    if (lanIp) {
      const preferred = resolvePort(nextUrl, backendEnv);
      const port = await resolveLivePort(preferred);
      nextUrl = `http://${lanIp}:${port}`;
      console.log(`[prepare-native-api-url] Native API base → ${nextUrl}`);
      console.log(
        "[prepare-native-api-url] Keep backend running (npm start in backend/) on the same Wi‑Fi as the phone."
      );
    } else {
      console.warn(
        "[prepare-native-api-url] No LAN IP found — keeping localhost (emulator-only)."
      );
    }
  } else {
    console.log(`[prepare-native-api-url] Using configured API: ${nextUrl}`);
  }
}

fs.writeFileSync(
  outFile,
  `# Auto-generated for Capacitor / APK builds — do not commit\nVITE_API_BASE_URL=${nextUrl}\n`
);
process.env.VITE_API_BASE_URL = nextUrl;
