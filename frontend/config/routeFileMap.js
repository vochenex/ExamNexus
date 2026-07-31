/**
 * Ordered map of URL routes → frontend source files.
 * Used by the on-screen debug indicator and as a quick lookup while debugging.
 */

export const ROUTE_FILE_MAP = [
  {
    match: /^\/$/,
    exact: true,
    label: "Marketing home",
    file: "frontend/pages/public/HomePage.jsx",
  },
  {
    match: /^\/auth$/,
    exact: true,
    label: "Login / signup / forgot password",
    file: "frontend/pages/auth/AuthPage.jsx",
  },

  // Admin
  {
    match: /^\/admin\/dashboard$/,
    label: "Admin dashboard",
    file: "frontend/pages/Admin/AdminDashboardPage.jsx",
  },
  {
    match: /^\/admin\/profile$/,
    label: "Admin profile",
    file: "frontend/pages/shared/ProfilePage.jsx",
  },
  {
    match: /^\/admin\/accounts$/,
    label: "Admin accounts",
    file: "frontend/pages/Admin/AdminAccountsPage.jsx",
  },
  {
    match: /^\/admin\/password-resets$/,
    label: "Admin password resets",
    file: "frontend/pages/Admin/AdminPasswordResetsPage.jsx",
  },
  {
    match: /^\/admin\/subjects$/,
    label: "Admin subjects",
    file: "frontend/pages/Admin/AdminSubjectsPage.jsx",
  },
  {
    match: /^\/admin\/assigned-subjects$/,
    label: "Admin assigned subjects",
    file: "frontend/pages/Admin/AdminAssignedSubjectsPage.jsx",
  },
  {
    match: /^\/admin\/catalog$/,
    label: "Admin departments & courses",
    file: "frontend/pages/Admin/AdminCatalogPage.jsx",
  },
  {
    match: /^\/admin\/announcements$/,
    label: "Admin announcements",
    file: "frontend/pages/Admin/AdminAnnouncementsPage.jsx",
  },
  {
    match: /^\/admin\/assessments$/,
    label: "Admin assessments",
    file: "frontend/pages/Admin/AdminAssessmentsPage.jsx",
  },
  {
    match: /^\/admin\/exam-logs$/,
    label: "Admin exam integrity logs",
    file: "frontend/pages/Admin/AdminExamLogsPage.jsx",
  },
  {
    match: /^\/admin\/exports$/,
    label: "Admin data exports",
    file: "frontend/pages/Admin/AdminExportsPage.jsx",
  },

  // Faculty
  {
    match: /^\/faculty\/dashboard$/,
    label: "Faculty dashboard",
    file: "frontend/pages/Faculty/FacultyDashboardPage.jsx",
  },
  {
    match: /^\/faculty\/exports$/,
    label: "Faculty data exports",
    file: "frontend/pages/Faculty/FacultyExportsPage.jsx",
  },
  {
    match: /^\/faculty\/profile$/,
    label: "Faculty profile",
    file: "frontend/pages/shared/ProfilePage.jsx",
  },
  {
    match: /^\/faculty\/platform-announcements$/,
    label: "Platform announcements",
    file: "frontend/pages/shared/PlatformAnnouncementsPage.jsx",
  },
  {
    match: /^\/faculty\/announcements$/,
    label: "Faculty announcements hub",
    file: "frontend/pages/Faculty/FacultyAnnouncementsHubPage.jsx",
  },
  {
    match: /^\/faculty\/question-bank$/,
    label: "Faculty question bank",
    file: "frontend/pages/Faculty/QuestionBankPage.jsx",
  },
  {
    match: /^\/faculty\/create-assessment$/,
    label: "Create assessment",
    file: "frontend/pages/Faculty/CreateAssessmentPage.jsx",
  },
  {
    match: /^\/faculty\/edit-assessment\/[^/]+$/,
    label: "Edit assessment",
    file: "frontend/pages/Faculty/EditAssessmentPage.jsx",
  },
  {
    match: /^\/faculty\/subject\/[^/]+\/social$/,
    label: "Faculty subject social",
    file: "frontend/pages/Faculty/FacultySubjectSocialPage.jsx",
  },
  {
    match: /^\/faculty\/subject\/[^/]+$/,
    label: "Faculty subject details",
    file: "frontend/pages/Faculty/FacultySubjectDetailsPage.jsx",
  },
  {
    match: /^\/faculty\/assessment\/[^/]+$/,
    label: "Faculty assessment details",
    file: "frontend/pages/Faculty/FacultyAssessmentDetailsPage.jsx",
  },

  // Student
  {
    match: /^\/student\/dashboard$/,
    label: "Student dashboard",
    file: "frontend/pages/Student/StudentDashboardPage.jsx",
  },
  {
    match: /^\/student\/profile$/,
    label: "Student profile",
    file: "frontend/pages/shared/ProfilePage.jsx",
  },
  {
    match: /^\/student\/platform-announcements$/,
    label: "Platform announcements",
    file: "frontend/pages/shared/PlatformAnnouncementsPage.jsx",
  },
  {
    match: /^\/student\/assessments$/,
    label: "Student assessments list",
    file: "frontend/pages/Student/StudentAssessmentsPage.jsx",
  },
  {
    match: /^\/student\/results\/[^/]+\/[^/]+$/,
    label: "Student result detail",
    file: "frontend/pages/Student/StudentResultDetailPage.jsx",
  },
  {
    match: /^\/student\/results$/,
    label: "Student results list",
    file: "frontend/pages/Student/StudentResultsListPage.jsx",
  },
  {
    match: /^\/student\/take-assessment\/[^/]+$/,
    label: "Take assessment",
    file: "frontend/pages/Student/TakeAssessmentPage.jsx",
  },
  {
    match: /^\/student\/subjects$/,
    label: "Student subjects list",
    file: "frontend/pages/Student/StudentSubjectsPage.jsx",
  },
  {
    match: /^\/student\/subject\/[^/]+\/social$/,
    label: "Student subject social",
    file: "frontend/pages/Student/StudentSubjectSocialPage.jsx",
  },
  {
    match: /^\/student\/subject\/[^/]+$/,
    label: "Student subject details",
    file: "frontend/pages/Student/StudentSubjectDetailsPage.jsx",
  },
];

export function resolveRouteFileInfo(pathname) {
  const path = String(pathname || "/").split("?")[0] || "/";
  for (const entry of ROUTE_FILE_MAP) {
    if (entry.match.test(path)) {
      return entry;
    }
  }
  return {
    label: "Unknown route",
    file: "(no mapped page file)",
    match: null,
  };
}

/** Normalize Vite / OS paths to compare against routeFileMap entries. */
export function normalizeSourcePath(filePath) {
  return String(filePath || "")
    .replace(/\\/g, "/")
    .replace(/^\/@fs\//, "")
    .replace(/^.*\/ExamNexus\//i, "")
    .replace(/^\//, "")
    .replace(/^src\//, "frontend/")
    .trim();
}

/** Find mapped pages that own or are likely affected by a changed source file. */
export function resolvePagesForSourceFile(filePath) {
  const normalized = normalizeSourcePath(filePath);
  if (!normalized) return [];

  const exact = ROUTE_FILE_MAP.filter((entry) => {
    const mapped = normalizeSourcePath(entry.file);
    return mapped === normalized || normalized.endsWith(mapped) || mapped.endsWith(normalized);
  });

  if (exact.length) {
    return exact.map((entry) => ({
      label: entry.label,
      file: entry.file,
      relation: "page",
    }));
  }

  // Home marketing components map to the public home page.
  if (normalized.includes("/components/home/") || normalized.includes("/pages/public/HomePage")) {
    return [
      {
        label: "Marketing home",
        file: "frontend/pages/public/HomePage.jsx",
        relation: "page",
      },
    ];
  }

  // Shared component / util — report as shared impact, still useful while debugging.
  if (
    normalized.includes("/components/") ||
    normalized.includes("/layouts/") ||
    normalized.includes("/utils/") ||
    normalized.includes("/hooks/") ||
    normalized.includes("/contexts/") ||
    normalized.includes("/styles/")
  ) {
    return [
      {
        label: "Shared module (may affect multiple pages)",
        file: normalized.startsWith("frontend/")
          ? normalized
          : `frontend/${normalized.replace(/^frontend\//, "")}`,
        relation: "shared",
      },
    ];
  }

  return [
    {
      label: "Unmapped file",
      file: normalized,
      relation: "unknown",
    },
  ];
}
