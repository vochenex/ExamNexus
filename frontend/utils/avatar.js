export const DEFAULT_AVATAR_PATH = "/default-avatar.svg";

export function isFacultyRole(role) {
  return String(role || "").toLowerCase() === "faculty";
}

export function hasCustomProfilePhoto(avatarUrl) {
  const url = String(avatarUrl || "").trim();
  if (!url) return false;
  if (url === "default" || url === DEFAULT_AVATAR_PATH) return false;
  if (url.endsWith("default-avatar.svg")) return false;
  if (url.includes("ui-avatars.com")) return false;
  return true;
}

export function canFacultyManageSubjects(user) {
  if (!isFacultyRole(user?.role)) return true;
  return hasCustomProfilePhoto(user?.avatar_url);
}

export const FACULTY_AVATAR_REQUIRED_MESSAGE =
  "Upload a profile photo in Profile before you can create subjects or let students enroll via invite codes.";
