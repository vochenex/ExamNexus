import { isNativeApp } from "./platform";
import { getCachedExamNexusUser } from "./authUser";

export function dashboardPathForRole(role) {
  const normalized = String(role || "").toLowerCase();
  if (normalized === "admin") return "/admin/dashboard";
  if (normalized === "faculty") return "/faculty/dashboard";
  return "/student/dashboard";
}

/** Default landing route after login on the native app. */
export function nativeLandingPathForRole(role) {
  const normalized = String(role || "").toLowerCase();
  if (normalized === "admin") return "/admin/dashboard";
  if (normalized === "faculty") return "/faculty/dashboard";
  return "/student/dashboard";
}

/** Where `/` should go in the native shell (no marketing homepage). */
export function getNativeEntryPath() {
  const user = getCachedExamNexusUser();
  if (user?.role) return nativeLandingPathForRole(user.role);
  return "/auth";
}

export function isNativeEntryPath(pathname) {
  return isNativeApp() && (pathname === "/" || pathname === "");
}
