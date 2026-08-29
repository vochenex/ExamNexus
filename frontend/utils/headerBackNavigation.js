/** Sidebar landing routes — no header back button on these exact paths. */
const SIDEBAR_ROOT_PATHS = new Set([
  "/faculty/dashboard",
  "/faculty/profile",
  "/faculty/question-bank",
  "/faculty/announcements",
  "/faculty/exports",
  "/faculty/platform-announcements",
  "/student/dashboard",
  "/student/profile",
  "/student/subjects",
  "/student/assessments",
  "/student/results",
  "/student/announcements",
  "/student/platform-announcements",
  "/admin/dashboard",
  "/admin/profile",
  "/admin/accounts",
  "/admin/password-resets",
  "/admin/subjects",
  "/admin/assigned-subjects",
  "/admin/catalog",
  "/admin/announcements",
  "/admin/assessments",
  "/admin/exam-logs",
  "/admin/exports",
]);

const BACK_TARGET_RULES = [
  {
    pattern: /^\/faculty\/edit-assessment\/([^/]+)$/,
    target: (match) => `/faculty/assessment/${match[1]}`,
  },
  {
    pattern: /^\/faculty\/assessment\/([^/]+)$/,
    target: () => "/faculty/dashboard",
  },
  {
    pattern: /^\/faculty\/subject\/([^/]+)\/social$/,
    target: (match) => `/faculty/subject/${match[1]}`,
  },
  {
    pattern: /^\/faculty\/subject\/([^/]+)$/,
    target: () => "/faculty/dashboard",
  },
  {
    pattern: /^\/faculty\/create-assessment$/,
    target: () => "/faculty/dashboard",
  },
  {
    pattern: /^\/student\/subject\/([^/]+)\/social$/,
    target: (match) => `/student/subject/${match[1]}`,
  },
  {
    pattern: /^\/student\/subject\/([^/]+)$/,
    target: () => "/student/subjects",
  },
  {
    pattern: /^\/student\/take-assessment\/([^/]+)$/,
    target: () => "/student/assessments",
  },
  {
    pattern: /^\/student\/results\/([^/]+)\/([^/]+)$/,
    target: (match) => `/student/results/${match[1]}`,
  },
  {
    pattern: /^\/student\/results\/([^/]+)$/,
    target: () => "/student/results",
  },
];

function normalizePath(pathname) {
  const path = String(pathname || "").split("?")[0].split("#")[0];
  if (path.length > 1 && path.endsWith("/")) {
    return path.slice(0, -1);
  }
  return path;
}

export function shouldShowHeaderBack(pathname) {
  const path = normalizePath(pathname);
  if (
    !path.startsWith("/student/") &&
    !path.startsWith("/faculty/") &&
    !path.startsWith("/admin/")
  ) {
    return false;
  }
  return !SIDEBAR_ROOT_PATHS.has(path);
}

export function getHeaderBackTarget(pathname) {
  const path = normalizePath(pathname);

  for (const rule of BACK_TARGET_RULES) {
    const match = path.match(rule.pattern);
    if (match) {
      return rule.target(match);
    }
  }

  if (path.startsWith("/admin/")) return "/admin/dashboard";
  if (path.startsWith("/faculty/")) return "/faculty/dashboard";
  if (path.startsWith("/student/")) return "/student/dashboard";
  return "/auth";
}
