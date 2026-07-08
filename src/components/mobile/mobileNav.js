import {
  LayoutDashboard,
  UserCircle,
  BookOpen,
  ClipboardCheck,
  Trophy,
  Archive,
  Megaphone,
  Users,
  KeyRound,
  Link2,
  Building2,
  ClipboardList,
  ShieldAlert,
  Download,
} from "lucide-react";

/**
 * Bottom-bar navigation per role.
 * `primary` items become tab-bar slots. `more` items (if any) surface behind a
 * "More" slot in an expandable sheet, so the bar stays to ~5 slots max — the
 * pattern iOS and Android users expect.
 */
export function getMobileNav(role) {
  const normalized = String(role || "").toLowerCase();

  if (normalized === "admin") {
    return {
      primary: [
        { to: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard", end: true },
        { to: "/admin/accounts", icon: Users, label: "Accounts" },
        { to: "/admin/subjects", icon: BookOpen, label: "Subjects" },
      ],
      more: [
        { to: "/admin/password-resets", icon: KeyRound, label: "Password resets" },
        { to: "/admin/assigned-subjects", icon: Link2, label: "Assigned subjects" },
        { to: "/admin/catalog", icon: Building2, label: "Departments & courses" },
        { to: "/admin/assessments", icon: ClipboardList, label: "Assessments" },
        { to: "/admin/announcements", icon: Megaphone, label: "Announcements" },
        { to: "/admin/exam-logs", icon: ShieldAlert, label: "Exam logs" },
        { to: "/admin/exports", icon: Download, label: "Export data" },
        { to: "/admin/profile", icon: UserCircle, label: "Profile" },
      ],
    };
  }

  if (normalized === "faculty") {
    return {
      primary: [
        { to: "/faculty/dashboard", icon: LayoutDashboard, label: "Dashboard", end: true },
        { to: "/faculty/question-bank", icon: Archive, label: "Bank" },
        { to: "/faculty/announcements", icon: Megaphone, label: "Announce" },
        { to: "/faculty/profile", icon: UserCircle, label: "Profile" },
      ],
      more: [],
    };
  }

  // Student (default)
  return {
    primary: [
      { to: "/student/dashboard", icon: LayoutDashboard, label: "Home", end: true },
      { to: "/student/subjects", icon: BookOpen, label: "Subjects" },
      { to: "/student/assessments", icon: ClipboardCheck, label: "Assess" },
      { to: "/student/results", icon: Trophy, label: "Results" },
      { to: "/student/profile", icon: UserCircle, label: "Profile" },
    ],
    more: [],
  };
}
