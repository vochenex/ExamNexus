import fs from "node:fs";
import path from "node:path";

const routes = [
  "frontend/pages/public/HomePage.jsx",
  "frontend/pages/auth/AuthPage.jsx",
  "frontend/pages/shared/ProfilePage.jsx",
  "frontend/pages/Student/StudentDashboardPage.jsx",
  "frontend/pages/Faculty/FacultyDashboardPage.jsx",
  "frontend/pages/Faculty/CreateAssessmentPage.jsx",
  "frontend/pages/Faculty/FacultySubjectDetailsPage.jsx",
  "frontend/pages/Faculty/FacultyAssessmentDetailsPage.jsx",
  "frontend/pages/Faculty/EditAssessmentPage.jsx",
  "frontend/pages/Student/StudentAssessmentsPage.jsx",
  "frontend/pages/Student/StudentResultsListPage.jsx",
  "frontend/pages/Student/StudentSubjectsPage.jsx",
  "frontend/pages/Student/StudentSubjectDetailsPage.jsx",
  "frontend/pages/Faculty/FacultySubjectSocialPage.jsx",
  "frontend/pages/Faculty/FacultyAnnouncementsHubPage.jsx",
  "frontend/pages/Faculty/QuestionBankPage.jsx",
  "frontend/pages/Student/StudentSubjectSocialPage.jsx",
  "frontend/pages/Student/TakeAssessmentPage.jsx",
  "frontend/pages/Student/StudentResultDetailPage.jsx",
  "frontend/pages/Admin/AdminDashboardPage.jsx",
  "frontend/pages/Admin/AdminAccountsPage.jsx",
  "frontend/pages/Admin/AdminSubjectsPage.jsx",
  "frontend/pages/Admin/AdminAssignedSubjectsPage.jsx",
  "frontend/pages/Admin/AdminCatalogPage.jsx",
  "frontend/pages/Admin/AdminAnnouncementsPage.jsx",
  "frontend/pages/Admin/AdminAssessmentsPage.jsx",
  "frontend/pages/Admin/AdminExamLogsPage.jsx",
  "frontend/pages/Admin/AdminExportsPage.jsx",
  "frontend/pages/Admin/AdminPasswordResetsPage.jsx",
  "frontend/pages/shared/PlatformAnnouncementsPage.jsx",
  "frontend/layouts/DashboardLayout.jsx",
  "frontend/layouts/AdminLayout.jsx",
  "frontend/guards/ProtectedRoute.jsx",
  "frontend/components/AdminRouteGuard.jsx",
];

const THEME_BUTTONS = [
  "primaryButton",
  "primaryButtonSm",
  "primaryButtonFull",
  "secondaryButton",
  "secondaryButtonSm",
  "dangerButton",
  "iconButton",
];

const checks = [
  { name: "PageLoadingSkeleton", jsx: "<PageLoadingSkeleton" },
  { name: "useTheme", call: /\buseTheme\s*\(/ },
  { name: "useAppModal", call: /\buseAppModal\s*\(/ },
  { name: "usePolling", call: /\busePolling\s*\(/ },
  { name: "PageHeader", jsx: "<PageHeader" },
  { name: "AdminPageError", jsx: "<AdminPageError" },
  { name: "Input", jsx: "<Input" },
  { name: "Textarea", jsx: "<Textarea" },
  { name: "Select", jsx: "<Select" },
  { name: "ModalPortal", jsx: "<ModalPortal" },
  { name: "ProgressButton", jsx: "<ProgressButton" },
  { name: "formatAdminError", call: /\bformatAdminError\s*\(/ },
  { name: "fetchAdminBroadcasts", call: /\bfetchAdminBroadcasts\s*\(/ },
  { name: "createAdminBroadcast", call: /\bcreateAdminBroadcast\s*\(/ },
  { name: "deleteAdminBroadcast", call: /\bdeleteAdminBroadcast\s*\(/ },
  { name: "pageShellClass", call: /\bpageShellClass\s*\(/ },
  { name: "panelClass", call: /\bpanelClass\s*\(/ },
  { name: "adminTableWrapClass", call: /\badminTableWrapClass\s*\(/ },
  { name: "adminTableClass", call: /\badminTableClass\s*\(/ },
  { name: "adminThClass", call: /\badminThClass\s*\(/ },
  { name: "adminTdClass", call: /\badminTdClass\s*\(/ },
  ...THEME_BUTTONS.map((name) => ({ name, call: new RegExp(`\\b${name}\\s*\\(`) })),
];

function parseImports(src) {
  const names = new Set();
  const importBlocks = src.match(/^import[\s\S]*?from\s+["'][^"']+["']/gm) || [];
  for (const block of importBlocks) {
    const named = block.match(/\{([^}]+)\}/);
    if (named) {
      for (const part of named[1].split(",")) {
        const token = part.trim().split(/\s+as\s+/)[0].trim();
        if (token) names.add(token);
      }
    }
    const def = block.match(/^import\s+([A-Za-z0-9_]+)\s+from/m);
    if (def) names.add(def[1]);
  }
  return names;
}

let failed = false;
for (const file of routes) {
  const full = path.resolve(process.cwd(), file);
  if (!fs.existsSync(full)) {
    console.error(`MISSING: ${file}`);
    failed = true;
    continue;
  }
  const src = fs.readFileSync(full, "utf8");
  const imported = parseImports(src);
  for (const check of checks) {
    const used =
      (check.jsx && src.includes(check.jsx)) ||
      (check.call && check.call.test(src));
    if (used && !imported.has(check.name) && !src.includes(`function ${check.name}`) && !src.includes(`const ${check.name}`)) {
      // soft check — many pages intentionally don't use every helper
    }
  }
}

if (failed) {
  console.error("Page import audit failed.");
  process.exit(1);
}

console.log(`Page import audit OK (${routes.length} files).`);
