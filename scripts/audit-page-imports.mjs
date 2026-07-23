import fs from "node:fs";
import path from "node:path";

const routes = [
  "src/pages/HomePage.jsx",
  "src/components/ExamNexusAuth.jsx",
  "src/pages/Profile.jsx",
  "src/pages/Student/StudentDashboard.jsx",
  "src/pages/Faculty/FacultyDashboard.jsx",
  "src/pages/Faculty/CreateAssessment.jsx",
  "src/pages/Faculty/SubjectDetails.jsx",
  "src/pages/Faculty/AssessmentDetails.jsx",
  "src/pages/Faculty/EditAssessment.jsx",
  "src/pages/Student/StudentAssessments.jsx",
  "src/pages/Student/StudentResultsList.jsx",
  "src/pages/Student/StudentSubjects.jsx",
  "src/pages/Student/StudentSubjectDetails.jsx",
  "src/pages/Faculty/FacultySubjectSocial.jsx",
  "src/pages/Faculty/FacultyAnnouncementsHub.jsx",
  "src/pages/Faculty/QuestionBank.jsx",
  "src/pages/Student/StudentSubjectSocial.jsx",
  "src/pages/Student/TakeAssessment.jsx",
  "src/pages/Student/StudentResults.jsx",
  "src/pages/Admin/AdminDashboard.jsx",
  "src/pages/Admin/AdminAccounts.jsx",
  "src/pages/Admin/AdminSubjects.jsx",
  "src/pages/Admin/AdminAssignedSubjects.jsx",
  "src/pages/Admin/AdminCatalog.jsx",
  "src/pages/Admin/AdminAnnouncements.jsx",
  "src/pages/Admin/AdminAssessments.jsx",
  "src/pages/Admin/AdminExamLogs.jsx",
  "src/pages/Admin/AdminExports.jsx",
  "src/pages/Admin/AdminPasswordResets.jsx",
  "src/pages/PlatformAnnouncements.jsx",
  "src/layouts/DashboardLayout.jsx",
  "src/layouts/AdminLayout.jsx",
  "src/guards/ProtectedRoute.jsx",
  "src/components/AdminRouteGuard.jsx",
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
  { name: "BackButton", jsx: "<BackButton" },
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
    const defaultMatch = block.match(/^import\s+([A-Za-z_$][\w$]*)/);
    if (defaultMatch) names.add(defaultMatch[1]);
    const namedMatch = block.match(/\{([\s\S]*?)\}/);
    if (namedMatch) {
      for (const part of namedMatch[1].split(",")) {
        const token = part.trim().split(/\s+as\s+/)[0].trim();
        if (token) names.add(token);
      }
    }
  }
  return names;
}

function isUsed(src, check) {
  if (check.jsx) return src.includes(check.jsx);
  if (check.call) return check.call.test(src);
  return false;
}

function hasLocalDefinition(src, name) {
  return new RegExp(`\\b(function|const|let|var)\\s+${name}\\b`).test(src);
}

let issues = 0;

for (const rel of routes) {
  const file = path.join(process.cwd(), rel);
  if (!fs.existsSync(file)) {
    console.log(`MISSING FILE: ${rel}`);
    issues += 1;
    continue;
  }

  const src = fs.readFileSync(file, "utf8");
  const imports = parseImports(src);
  const missing = checks
    .filter((check) => {
      if (!isUsed(src, check)) return false;
      if (imports.has(check.name)) return false;
      if (hasLocalDefinition(src, check.name)) return false;
      return true;
    })
    .map((check) => check.name);

  if (missing.length) {
    console.log(`${rel}: ${missing.join(", ")}`);
    issues += 1;
  }
}

if (!issues) {
  console.log("OK: route pages have required imports");
}

process.exit(issues ? 1 : 0);
