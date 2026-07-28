/**
 * Public URL of the deployed ExamNexus website.
 *
 * Used by the mobile (Capacitor) app: students take assessments on the website,
 * not inside the app, so "Take Assessment" opens this URL in the system browser.
 * Override with VITE_WEBSITE_URL in your .env for production builds.
 */
export const WEBSITE_URL = (
  import.meta.env.VITE_WEBSITE_URL || "https://examnexus.app"
).replace(/\/+$/, "");

/**
 * Build an absolute website URL for a given in-app route/path.
 * @param {string} path e.g. "/student/take-assessment/123"
 */
export function websiteUrl(path = "/") {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${WEBSITE_URL}${suffix}`;
}
