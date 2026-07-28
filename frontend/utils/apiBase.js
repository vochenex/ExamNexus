import { Capacitor } from "@capacitor/core";

function stripTrailingSlash(url) {
  return String(url || "").replace(/\/+$/, "");
}

function rewriteLocalhostForNative(url) {
  if (!url || !Capacitor.isNativePlatform()) return url;

  const platform = Capacitor.getPlatform();
  // Android emulator reaches the host machine via 10.0.2.2
  if (platform === "android") {
    return url.replace(/\/\/(localhost|127\.0\.0\.1)(?=[:/]|$)/i, "//10.0.2.2");
  }
  // iOS simulator can use localhost as-is
  return url;
}

function defaultApiBase() {
  const fromEnv = import.meta.env.VITE_API_BASE_URL;
  if (fromEnv) return fromEnv;

  // Production web (Vercel): same-origin /api serverless backend
  if (import.meta.env.PROD) return "/api";

  return "http://localhost:5000";
}

/**
 * Backend base URL for AI, push, enrollment, etc.
 * - Local web: http://localhost:5000
 * - Vercel web: /api (same origin)
 * - Native release APK: set VITE_API_BASE_URL=https://your-app.vercel.app/api
 */
export const API_BASE = stripTrailingSlash(
  rewriteLocalhostForNative(defaultApiBase())
);

export function isLocalApiBase(url = API_BASE) {
  return /localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\./i.test(String(url || ""));
}
