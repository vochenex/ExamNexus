import { Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  UserCircle,
  LogOut,
  Megaphone,
  Archive,
  ShieldAlert,
  BookOpen,
  ClipboardCheck,
  Trophy,
  GraduationCap,
  Download,
} from "lucide-react";
import { useTheme } from "./ThemeContext";
import { supabase } from "../supabaseClient";
import { fetchAccountAccess } from "../utils/adminData";
import { getAuthSession, getCachedExamNexusUser } from "../utils/authUser";
import { buildPendingAuthNotice, stashAuthNotice } from "../utils/authNotice";
import ProfileAvatar from "../components/ProfileAvatar";
import NotificationBell from "../components/NotificationBell";
import ThemeToggle from "../components/ThemeToggle";
import InstallIconButton from "../components/pwa/InstallIconButton";
import ExamNexusLogo from "../components/ExamNexusLogo";
import ExamNexusBrand from "../components/ExamNexusBrand";
import RequiredSchoolIdGate from "../components/RequiredSchoolIdGate";
import SidebarNavLink, { SidebarSection } from "../components/SidebarNavLink";
import SidebarCollapseToggle from "../components/SidebarCollapseToggle";
import AnimatedPage from "../components/ui/AnimatedPage";
import MobileTabBar from "../components/mobile/MobileTabBar";
import useMobileNav from "../hooks/useMobileNav";
import useSidebarCollapsed from "../hooks/useSidebarCollapsed";
import useConnectionStatus from "../hooks/useConnectionStatus";
import ConnectionStatusBanner from "../components/ConnectionStatusBanner";
import { isNativeApp } from "../utils/platform";
import { useAssessmentLockdown } from "../contexts/AssessmentLockdownContext";
import { motion } from "../utils/motion";

export default function DashboardLayout() {
  const navigate = useNavigate();
  const { isLockdownActive, lockdown } = useAssessmentLockdown();
  const { theme } = useTheme();
  const mobileNav = useMobileNav();
  const { collapsed, toggleCollapsed } = useSidebarCollapsed();
  const { status: connectionStatus } = useConnectionStatus({
    enabled: !isLockdownActive,
  });
  const nativeApp = isNativeApp();
  const cachedUser = getCachedExamNexusUser();
  const [accessState, setAccessState] = useState(cachedUser ? "allowed" : "checking");
  const [sessionUser, setSessionUser] = useState(
    () => cachedUser || JSON.parse(localStorage.getItem("examnexus_user") || "{}")
  );

  const user = sessionUser;
  const isStudent = user.role?.toLowerCase() === "student";

  useEffect(() => {
    const verifyAccess = async () => {
      const session = await getAuthSession();
      if (!session?.user) {
        setAccessState("denied");
        return;
      }

      const access = await fetchAccountAccess(supabase, session.user.id);
      if (!access.allowed) {
        const notice = buildPendingAuthNotice(access.profile);
        stashAuthNotice(notice);
        await supabase.auth.signOut();
        localStorage.removeItem("examnexus_user");
        navigate("/auth", { replace: true, state: { authNotice: notice } });
        return;
      }

      if (access.profile) {
        // access.profile only carries { id, role, account_status }. Merge it
        // into the richer cached profile so fields like avatar_url, first_name,
        // and last_name are preserved for the sidebar.
        setSessionUser((prev) => {
          const merged = { ...prev, ...access.profile };
          localStorage.setItem("examnexus_user", JSON.stringify(merged));
          return merged;
        });
      }

      setAccessState("allowed");
    };

    verifyAccess();
  }, [navigate]);

  const handleLogout = async () => {
    const { clearLocalSessionAndLogout } = await import("../utils/sessionLogout");
    await clearLocalSessionAndLogout({
      email: sessionUser?.email,
      userId: sessionUser?.id,
      navigate,
      navigateTo: "/auth",
    });
  };

  const displayName = user.first_name
    ? `${user.first_name} ${user.last_name || ""}`.trim()
    : user.role || "User";

  if (accessState === "checking") {
    return null;
  }

  if (accessState !== "allowed") {
    return null;
  }

  return (
    <div
      className={`flex h-screen ${
        theme === "dark" ? "bg-[#031d1f] text-white" : "en-bg-page en-text-primary"
      }`}
    >
      {!isLockdownActive && !mobileNav && (
        <div className="relative sticky top-0 z-40 flex h-screen shrink-0">
        <aside
          className={`${motion.slideInLeft} en-sidebar-shell flex h-screen shrink-0 flex-col border-r backdrop-blur-xl ${
            collapsed ? "w-[4.75rem] p-2.5" : "w-72 p-4"
          } ${
            theme === "dark"
              ? "border-[#10B981]/10 bg-[#0b1114]/95"
              : "en-bg-surface border-slate-200/80 shadow-[4px_0_32px_rgba(15,23,42,0.08)]"
          } shadow-[0_0_80px_rgba(16,185,129,0.06)]`}
        >
          {/* Brand */}
          <div
            className={`en-sidebar-panel rounded-2xl border ${
              collapsed ? "px-1.5 py-2" : "px-3 py-3"
            } ${
              theme === "dark"
                ? "border-white/10 bg-white/[0.03]"
                : "border-slate-200/80 en-bg-surface"
            }`}
          >
            <div
              className={`flex items-center transition-[gap,justify-content] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                collapsed ? "justify-center gap-0" : "gap-3"
              }`}
            >
              <ExamNexusLogo size={collapsed ? 36 : 42} idSuffix="sidebar" />
              <div className={`en-sidebar-label min-w-0 ${collapsed ? "is-collapsed" : ""}`}>
                <h1 className="truncate text-xl font-black leading-tight bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
                  ExamNexus
                </h1>
                <p
                  className={`truncate text-[11px] ${
                    theme === "dark" ? "text-gray-500" : "text-slate-500"
                  }`}
                >
                  Intelligent Assessment
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav
            className={`mt-4 flex-1 space-y-5 overflow-y-auto en-scroll-region transition-[padding] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              collapsed ? "px-0" : "pr-1"
            }`}
          >
            <SidebarSection title="Main" theme={theme} collapsed={collapsed}>
              <SidebarNavLink
                to={isStudent ? "/student/dashboard" : "/faculty/dashboard"}
                icon={LayoutDashboard}
                label={isStudent ? "Student Dashboard" : "Faculty Dashboard"}
                end
                collapsed={collapsed}
              />
              <SidebarNavLink
                to={isStudent ? "/student/profile" : "/faculty/profile"}
                icon={UserCircle}
                label="Profile"
                collapsed={collapsed}
              />
            </SidebarSection>

            {!isStudent && (
              <SidebarSection title="Teaching" theme={theme} collapsed={collapsed}>
                <SidebarNavLink
                  to="/faculty/question-bank"
                  icon={Archive}
                  label="Question Bank"
                  collapsed={collapsed}
                />
                <SidebarNavLink
                  to="/faculty/announcements"
                  icon={Megaphone}
                  label="Announcements"
                  collapsed={collapsed}
                />
                <SidebarNavLink
                  to="/faculty/exports"
                  icon={Download}
                  label="Export data"
                  collapsed={collapsed}
                />
              </SidebarSection>
            )}

            {isStudent && (
              <SidebarSection title="Academics" theme={theme} collapsed={collapsed}>
                <SidebarNavLink
                  to="/student/subjects"
                  icon={BookOpen}
                  label="My Subjects"
                  collapsed={collapsed}
                />
                <SidebarNavLink
                  to="/student/assessments"
                  icon={ClipboardCheck}
                  label="Assessments"
                  collapsed={collapsed}
                />
                <SidebarNavLink
                  to="/student/results"
                  icon={Trophy}
                  label="Results"
                  collapsed={collapsed}
                />
              </SidebarSection>
            )}
          </nav>

          {/* Footer */}
          <div className="mt-4 space-y-3">
            <div
              className={`en-sidebar-panel rounded-2xl border ${
                collapsed ? "p-2" : "p-3"
              } ${
                theme === "dark"
                  ? "border-white/10 bg-white/[0.03]"
                  : "border-slate-200/80 en-bg-surface"
              }`}
            >
              <div
                className={`mb-3 flex items-center transition-[gap,justify-content] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  collapsed ? "justify-center gap-0" : "gap-3"
                }`}
                title={collapsed ? `${displayName} · ${user.role || "User"}` : undefined}
              >
                <ProfileAvatar src={user.avatar_url} alt={displayName} size="sm" />
                <div
                  className={`en-sidebar-label min-w-0 flex-1 ${collapsed ? "is-collapsed" : ""}`}
                >
                  <p
                    className={`truncate text-sm font-semibold capitalize ${
                      theme === "dark" ? "text-emerald-400" : "text-gray-900"
                    }`}
                  >
                    {displayName}
                  </p>
                  <p
                    className={`flex items-center gap-1 truncate text-xs capitalize ${
                      theme === "dark" ? "text-gray-500" : "text-gray-600"
                    }`}
                  >
                    <GraduationCap size={12} className="shrink-0 opacity-70" />
                    {user.role || "User"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                title="Logout"
                aria-label="Logout"
                className={`flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  collapsed ? "h-9 w-full" : "w-full px-4 py-2.5"
                } ${
                  theme === "dark"
                    ? "border border-red-500/20 bg-red-500/10 text-red-400 hover:border-red-400 hover:bg-red-500/20 hover:text-red-300"
                    : "en-bg-elevated border border-red-200/80 text-red-600 hover:border-red-400 hover:bg-red-50/80"
                }`}
              >
                <LogOut size={17} className="shrink-0" />
                <span className={`en-sidebar-label ${collapsed ? "is-collapsed" : ""}`}>
                  Logout
                </span>
              </button>
            </div>
          </div>
        </aside>
        <SidebarCollapseToggle
          collapsed={collapsed}
          onToggle={toggleCollapsed}
          theme={theme}
          className="absolute right-0 top-1/2 z-50 translate-x-1/2 -translate-y-1/2"
        />
        </div>
      )}

      <main
        className={`relative flex h-screen min-w-0 flex-1 flex-col ${
          theme === "dark" ? "text-white" : "en-text-primary"
        }`}
      >
        {isLockdownActive && (
          <div
            className={`z-50 flex shrink-0 items-center gap-2 border-b px-4 py-2 text-xs font-medium ${
              theme === "dark"
                ? "border-amber-500/20 bg-amber-500/10 text-amber-200"
                : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            <ShieldAlert size={14} />
            Lockdown mode — {lockdown?.title || "Assessment in progress"}. Only exam
            controls are available.
          </div>
        )}

        {!isLockdownActive && (
          <>
            {mobileNav ? (
              <header className="en-native-topbar shrink-0">
                <ExamNexusBrand
                  variant="compact"
                  logoSize={28}
                  showTagline={false}
                  idSuffix="mobile-top"
                />
                <div className="en-native-topbar-actions">
                  {!nativeApp && <InstallIconButton compact />}
                  <ThemeToggle compact />
                  <NotificationBell compact />
                </div>
              </header>
            ) : (
              <div
                className={`absolute right-4 top-4 z-40 flex items-center gap-2 sm:right-6 sm:top-5 sm:gap-2.5 lg:right-8 lg:top-6 ${motion.fadeInDown} en-delay-2`}
              >
                <InstallIconButton compact />
                <ThemeToggle compact />
                <NotificationBell compact />
              </div>
            )}
          </>
        )}
        <div
          className={`en-scroll-region min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto ${
            isLockdownActive ? "p-0" : mobileNav ? "p-3 sm:p-5" : "p-8"
          } ${mobileNav && !isLockdownActive ? "en-has-tabbar pb-[calc(var(--en-tabbar-height,3.35rem)+2rem)]" : ""}`}
        >
          {!isLockdownActive && (
            <ConnectionStatusBanner status={connectionStatus} className="mb-4" />
          )}
          <AnimatedPage>
            <Outlet />
          </AnimatedPage>
          <RequiredSchoolIdGate theme={theme} onResolved={setSessionUser} />
        </div>
      </main>

      {mobileNav && !isLockdownActive && (
        <MobileTabBar
          role={user.role}
          user={user}
          displayName={displayName}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}
