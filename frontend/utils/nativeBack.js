import { isNativeApp } from "./platform";
import { getCachedExamNexusUser } from "./authUser";
import { dashboardPathForRole } from "./nativeRoutes";

const AUTH_EPOCH_KEY = "en_auth_nav_epoch";
const EXIT_EVENT = "en:android-back";
const ROOT_PATHS = new Set([
  "/auth",
  "/student/dashboard",
  "/faculty/dashboard",
  "/admin/dashboard",
]);

export function bumpAuthNavigationEpoch() {
  try {
    const next = String(Date.now());
    sessionStorage.setItem(AUTH_EPOCH_KEY, next);
    return next;
  } catch {
    return String(Date.now());
  }
}

export function getAuthNavigationEpoch() {
  try {
    return sessionStorage.getItem(AUTH_EPOCH_KEY) || "";
  } catch {
    return "";
  }
}

/** Call after login/logout so the WebView cannot walk into another account's pages. */
export function sealAuthNavigation(path) {
  const epoch = bumpAuthNavigationEpoch();
  const target = path || window.location.pathname || "/auth";
  try {
    window.history.replaceState(
      { ...(window.history.state || {}), enAuthEpoch: epoch, enSealed: true },
      "",
      target
    );
  } catch {
    // ignore
  }
  return epoch;
}

function rolePrefix(role) {
  const normalized = String(role || "").toLowerCase();
  if (normalized === "admin") return "/admin";
  if (normalized === "faculty") return "/faculty";
  if (normalized === "student") return "/student";
  return "";
}

export function isNativeExitPath(pathname) {
  if (!pathname) return true;
  if (pathname === "/auth" || pathname.startsWith("/auth")) return true;
  return ROOT_PATHS.has(pathname);
}

/**
 * Parent path within the current role. Never returns another role's routes.
 */
export function getSafeBackPath(pathname) {
  const user = getCachedExamNexusUser();
  const prefix = rolePrefix(user?.role);
  const home = user?.role ? dashboardPathForRole(user.role) : "/auth";

  if (!pathname || pathname === "/auth" || pathname.startsWith("/auth")) {
    return null;
  }

  // Logged-in user must stay inside their role tree.
  if (prefix && !pathname.startsWith(prefix) && pathname !== "/profile") {
    return home;
  }

  if (pathname === home || ROOT_PATHS.has(pathname)) {
    return null;
  }

  if (pathname === "/profile") {
    return home;
  }

  const parts = pathname.split("/").filter(Boolean);
  if (parts.length <= 1) return home;
  parts.pop();
  const parent = `/${parts.join("/")}`;
  if (prefix && parent === prefix) return home;
  return parent || home;
}

export function dispatchAndroidBack() {
  window.dispatchEvent(new CustomEvent(EXIT_EVENT));
}

export function subscribeAndroidBack(handler) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EXIT_EVENT, handler);
  return () => window.removeEventListener(EXIT_EVENT, handler);
}

export function shouldHandleNativeBack() {
  return isNativeApp();
}
