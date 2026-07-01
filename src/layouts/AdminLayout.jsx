import { Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  UserCircle,
  LogOut,
  Moon,
  Sun,
  Users,
  BookOpen,
  Megaphone,
  Building2,
  GraduationCap,
  ClipboardList,
  ShieldAlert,
  Download,
  Link2,
  KeyRound,
} from "lucide-react";
import { useTheme } from "./ThemeContext";
import { supabase } from "../supabaseClient";
import { secondaryButton } from "../utils/themeButtons";
import ProfileAvatar from "../components/ProfileAvatar";
import ExamNexusLogo from "../components/ExamNexusLogo";
import SidebarNavLink, { SidebarSection } from "../components/SidebarNavLink";
import { motion } from "../utils/motion";

export default function AdminLayout() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const user = JSON.parse(localStorage.getItem("examnexus_user") || "{}");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("examnexus_user");
    navigate("/auth");
  };

  const displayName = user.first_name
    ? `${user.first_name} ${user.last_name || ""}`.trim()
    : "Admin";

  return (
    <div
      className={`flex h-screen ${
        theme === "dark" ? "bg-[#031d1f] text-white" : "en-bg-page text-gray-900"
      }`}
    >
      <aside
        className={`${motion.slideInLeft} sticky top-0 flex h-screen w-72 shrink-0 flex-col border-r p-4 backdrop-blur-xl ${
          theme === "dark"
            ? "border-[#10B981]/10 bg-[#0b1114]/95"
            : "en-bg-surface border-emerald-800/15 shadow-[4px_0_32px_rgba(42,92,78,0.12)]"
        } shadow-[0_0_80px_rgba(16,185,129,0.06)]`}
      >
        <div
          className={`rounded-2xl border px-3 py-3 ${
            theme === "dark"
              ? "border-white/10 bg-white/[0.03]"
              : "border-emerald-200/70 en-bg-surface"
          }`}
        >
          <div className="flex items-center gap-3">
            <ExamNexusLogo size={42} idSuffix="admin-sidebar" />
            <div className="min-w-0">
              <h1 className="truncate text-xl font-black leading-tight bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
                ExamNexus
              </h1>
              <p
                className={`truncate text-[11px] ${
                  theme === "dark" ? "text-gray-500" : "text-teal-700/80"
                }`}
              >
                Administration
              </p>
            </div>
          </div>
        </div>

        <nav className="mt-5 flex-1 space-y-5 overflow-y-auto pr-1">
          <SidebarSection title="Overview" theme={theme}>
            <SidebarNavLink to="/admin/dashboard" icon={LayoutDashboard} label="Dashboard" end />
            <SidebarNavLink to="/admin/profile" icon={UserCircle} label="Profile" />
          </SidebarSection>

          <SidebarSection title="People" theme={theme}>
            <SidebarNavLink to="/admin/accounts" icon={Users} label="Manage accounts" />
            <SidebarNavLink to="/admin/password-resets" icon={KeyRound} label="Password resets" />
          </SidebarSection>

          <SidebarSection title="Academics" theme={theme}>
            <SidebarNavLink to="/admin/subjects" icon={BookOpen} label="Manage subjects" />
            <SidebarNavLink to="/admin/assigned-subjects" icon={Link2} label="Assigned subjects" />
            <SidebarNavLink to="/admin/catalog" icon={Building2} label="Departments & courses" />
            <SidebarNavLink to="/admin/assessments" icon={ClipboardList} label="Assessments" />
          </SidebarSection>

          <SidebarSection title="Communication" theme={theme}>
            <SidebarNavLink to="/admin/announcements" icon={Megaphone} label="Announcements" />
          </SidebarSection>

          <SidebarSection title="Monitoring" theme={theme}>
            <SidebarNavLink to="/admin/exam-logs" icon={ShieldAlert} label="Exam logs" />
            <SidebarNavLink to="/admin/exports" icon={Download} label="Export data" />
          </SidebarSection>
        </nav>

        <div className="mt-4 space-y-3">
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className={secondaryButton(theme, "w-full text-sm")}
          >
            {theme === "dark" ? (
              <>
                <Sun size={18} />
                Light Mode
              </>
            ) : (
              <>
                <Moon size={18} />
                Dark Mode
              </>
            )}
          </button>

          <div
            className={`rounded-2xl border p-3 ${
              theme === "dark"
                ? "border-white/10 bg-white/[0.03]"
                : "border-emerald-200/70 en-bg-surface"
            }`}
          >
            <div className="mb-3 flex items-center gap-3">
              <ProfileAvatar src={user.avatar_url} alt={displayName} size="sm" />
              <div className="min-w-0 flex-1">
                <p
                  className={`truncate text-sm font-semibold ${
                    theme === "dark" ? "text-emerald-400" : "text-teal-800"
                  }`}
                >
                  {displayName}
                </p>
                <p
                  className={`flex items-center gap-1 truncate text-xs ${
                    theme === "dark" ? "text-gray-500" : "text-gray-600"
                  }`}
                >
                  <GraduationCap size={12} className="shrink-0 opacity-70" />
                  Admin
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-300 ${
                theme === "dark"
                  ? "border border-red-500/20 bg-red-500/10 text-red-400 hover:border-red-400 hover:bg-red-500/20"
                  : "en-bg-elevated border border-red-200/80 text-red-600 hover:border-red-400 hover:bg-red-50/80"
              }`}
            >
              <LogOut size={17} />
              Logout
            </button>
          </div>
        </div>
      </aside>

      <main className="relative h-screen flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
