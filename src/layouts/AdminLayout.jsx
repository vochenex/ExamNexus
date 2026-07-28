import { Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  LayoutDashboard,
  UserCircle,
  LogOut,
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
import ProfileAvatar from "../components/ProfileAvatar";
import ExamNexusLogo from "../components/ExamNexusLogo";
import ExamNexusBrand from "../components/ExamNexusBrand";
import ThemeToggle from "../components/ThemeToggle";
import InstallIconButton from "../components/pwa/InstallIconButton";
import NotificationBell from "../components/NotificationBell";
import RequiredSchoolIdGate from "../components/RequiredSchoolIdGate";
import SidebarNavLink, { SidebarSection } from "../components/SidebarNavLink";
import SidebarCollapseToggle from "../components/SidebarCollapseToggle";
import MobileTabBar from "../components/mobile/MobileTabBar";
import useMobileNav from "../hooks/useMobileNav";
import useSidebarCollapsed from "../hooks/useSidebarCollapsed";
import { isNativeApp } from "../utils/platform";
import { motion } from "../utils/motion";

export default function AdminLayout() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const mobileNav = useMobileNav();
  const { collapsed, toggleCollapsed } = useSidebarCollapsed();
  const nativeApp = isNativeApp();
  const [user, setUser] = useState(() =>
    JSON.parse(localStorage.getItem("examnexus_user") || "{}")
  );

  const handleLogout = async () => {
    const { clearLocalSessionAndLogout } = await import("../utils/sessionLogout");
    await clearLocalSessionAndLogout({
      email: user?.email,
      userId: user?.id,
      navigate,
      navigateTo: "/auth",
    });
  };

  const displayName = user.first_name
    ? `${user.first_name} ${user.last_name || ""}`.trim()
    : "Admin";

  return (
    <div
      className={`flex h-screen ${
        theme === "dark" ? "bg-[#031d1f] text-white" : "en-bg-page en-text-primary"
      }`}
    >
      {!mobileNav && (
      <aside
        className={`${motion.slideInLeft} sticky top-0 flex h-screen shrink-0 flex-col border-r backdrop-blur-xl transition-[width,padding] duration-300 ease-out ${
          collapsed ? "w-[4.75rem] p-2.5" : "w-72 p-4"
        } ${
          theme === "dark"
            ? "border-[#10B981]/10 bg-[#0b1114]/95"
            : "en-bg-surface border-slate-200/80 shadow-[4px_0_32px_rgba(15,23,42,0.08)]"
        } shadow-[0_0_80px_rgba(16,185,129,0.06)]`}
      >
        <div
          className={`rounded-2xl border ${
            collapsed ? "px-1.5 py-2" : "px-3 py-3"
          } ${
            theme === "dark"
              ? "border-white/10 bg-white/[0.03]"
              : "border-slate-200/80 en-bg-surface"
          }`}
        >
          <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`}>
            <ExamNexusLogo size={collapsed ? 36 : 42} idSuffix="admin-sidebar" />
            {!collapsed && (
              <div className="min-w-0">
                <h1 className="truncate text-xl font-black leading-tight bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
                  ExamNexus
                </h1>
                <p
                  className={`truncate text-[11px] ${
                    theme === "dark" ? "text-gray-500" : "text-slate-500"
                  }`}
                >
                  Administration
                </p>
              </div>
            )}
          </div>
        </div>

        <div className={`mt-3 ${collapsed ? "flex justify-center" : ""}`}>
          <SidebarCollapseToggle
            collapsed={collapsed}
            onToggle={toggleCollapsed}
            theme={theme}
          />
        </div>

        <nav
          className={`mt-4 flex-1 space-y-5 overflow-y-auto en-scroll-region ${
            collapsed ? "px-0" : "pr-1"
          }`}
        >
          <SidebarSection title="Overview" theme={theme} collapsed={collapsed}>
            <SidebarNavLink to="/admin/dashboard" icon={LayoutDashboard} label="Dashboard" end collapsed={collapsed} />
            <SidebarNavLink to="/admin/profile" icon={UserCircle} label="Profile" collapsed={collapsed} />
          </SidebarSection>

          <SidebarSection title="People" theme={theme} collapsed={collapsed}>
            <SidebarNavLink to="/admin/accounts" icon={Users} label="Manage accounts" collapsed={collapsed} />
            <SidebarNavLink to="/admin/password-resets" icon={KeyRound} label="Password resets" collapsed={collapsed} />
          </SidebarSection>

          <SidebarSection title="Academics" theme={theme} collapsed={collapsed}>
            <SidebarNavLink to="/admin/subjects" icon={BookOpen} label="Manage subjects" collapsed={collapsed} />
            <SidebarNavLink to="/admin/assigned-subjects" icon={Link2} label="Assigned subjects" collapsed={collapsed} />
            <SidebarNavLink to="/admin/catalog" icon={Building2} label="Departments & courses" collapsed={collapsed} />
            <SidebarNavLink to="/admin/assessments" icon={ClipboardList} label="Assessments" collapsed={collapsed} />
          </SidebarSection>

          <SidebarSection title="Communication" theme={theme} collapsed={collapsed}>
            <SidebarNavLink to="/admin/announcements" icon={Megaphone} label="Announcements" collapsed={collapsed} />
          </SidebarSection>

          <SidebarSection title="Monitoring" theme={theme} collapsed={collapsed}>
            <SidebarNavLink to="/admin/exam-logs" icon={ShieldAlert} label="Exam logs" collapsed={collapsed} />
            <SidebarNavLink to="/admin/exports" icon={Download} label="Export data" collapsed={collapsed} />
          </SidebarSection>
        </nav>

        <div className="mt-4 space-y-3">
          <div
            className={`rounded-2xl border ${
              collapsed ? "p-2" : "p-3"
            } ${
              theme === "dark"
                ? "border-white/10 bg-white/[0.03]"
                : "border-slate-200/80 en-bg-surface"
            }`}
          >
            <div
              className={`mb-3 flex items-center ${
                collapsed ? "justify-center" : "gap-3"
              }`}
              title={collapsed ? `${displayName} · Admin` : undefined}
            >
              <ProfileAvatar src={user.avatar_url} alt={displayName} size="sm" />
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-sm font-semibold ${
                      theme === "dark" ? "text-emerald-400" : "text-gray-900"
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
              )}
            </div>

            <button
              type="button"
              onClick={handleLogout}
              title="Logout"
              aria-label="Logout"
              className={`flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                collapsed ? "h-9 w-full" : "w-full px-4 py-2.5"
              } ${
                theme === "dark"
                  ? "border border-red-500/20 bg-red-500/10 text-red-400 hover:border-red-400 hover:bg-red-500/20"
                  : "en-bg-elevated border border-red-200/80 text-red-600 hover:border-red-400 hover:bg-red-50/80"
              }`}
            >
              <LogOut size={17} />
              {!collapsed && "Logout"}
            </button>
          </div>
        </div>
      </aside>
      )}

      <main
        className={`relative flex h-screen min-w-0 flex-1 flex-col ${
          theme === "dark" ? "text-white" : "en-text-primary"
        }`}
      >
        {mobileNav ? (
          <header className="en-native-topbar shrink-0">
            <ExamNexusBrand
              variant="compact"
              logoSize={28}
              showTagline={false}
              idSuffix="admin-mobile-top"
            />
            <div className="en-native-topbar-actions">
              {!nativeApp && <InstallIconButton compact />}
              <ThemeToggle compact />
              <NotificationBell compact />
            </div>
          </header>
        ) : (
          <div
            className={`absolute right-8 top-6 z-40 flex items-center gap-3 ${motion.fadeInDown} en-delay-2`}
          >
            <InstallIconButton />
            <ThemeToggle />
            <NotificationBell />
          </div>
        )}
        <div
          className={`en-scroll-region min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto ${
            mobileNav
              ? "p-3 sm:p-5 en-has-tabbar pb-[calc(var(--en-tabbar-height,3.35rem)+2rem)]"
              : "p-8"
          }`}
        >
          <Outlet />
          <RequiredSchoolIdGate theme={theme} onResolved={setUser} />
        </div>
      </main>

      {mobileNav && (
        <MobileTabBar
          role="admin"
          user={user}
          displayName={displayName}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}
