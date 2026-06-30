import { Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  UserCircle,
  LogOut,
  Moon,
  Sun,
  Megaphone,
  ShieldAlert,
  BookOpen,
  ClipboardCheck,
  Trophy,
  GraduationCap,
} from "lucide-react";
import { useTheme } from "./ThemeContext";
import { supabase } from "../supabaseClient";
import { fetchAccountAccess } from "../utils/adminData";
import { getAuthSession } from "../utils/authUser";
import { buildPendingAuthNotice, stashAuthNotice } from "../utils/authNotice";
import { secondaryButton } from "../utils/themeButtons";
import ProfileAvatar from "../components/ProfileAvatar";
import NotificationBell from "../components/NotificationBell";
import ExamNexusLogo from "../components/ExamNexusLogo";
import SidebarNavLink, { SidebarSection } from "../components/SidebarNavLink";
import AnimatedPage from "../components/ui/AnimatedPage";
import { useAssessmentLockdown } from "../contexts/AssessmentLockdownContext";
import { PageLoadingSkeleton } from "../components/ui/PageLoadingSkeleton";
import { motion } from "../utils/motion";

export default function DashboardLayout() {
  const navigate = useNavigate();
  const { isLockdownActive, lockdown } = useAssessmentLockdown();
  const { theme, setTheme } = useTheme();
  const [accessState, setAccessState] = useState("checking");

  const user = JSON.parse(localStorage.getItem("examnexus_user") || "{}");
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

      setAccessState("allowed");
    };

    verifyAccess();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("examnexus_user");
    navigate("/auth");
  };

  const displayName = user.first_name
    ? `${user.first_name} ${user.last_name || ""}`.trim()
    : user.role || "User";

  if (accessState === "checking") {
    return <PageLoadingSkeleton theme={theme} variant="dashboard" />;
  }

  if (accessState !== "allowed") {
    return null;
  }

  return (
    <div
      className={`flex h-screen ${
        theme === "dark" ? "bg-[#031d1f] text-white" : "en-bg-page text-gray-900"
      }`}
    >
      {!isLockdownActive && (
        <aside
          className={`${motion.slideInLeft} sticky top-0 flex h-screen w-72 shrink-0 flex-col border-r p-4 backdrop-blur-xl ${
            theme === "dark"
              ? "border-[#10B981]/10 bg-[#0b1114]/95"
              : "en-bg-page border-emerald-300/60"
          } shadow-[0_0_80px_rgba(16,185,129,0.06)]`}
        >
          {/* Brand */}
          <div
            className={`rounded-2xl border px-3 py-3 ${
              theme === "dark"
                ? "border-white/10 bg-white/[0.03]"
                : "border-emerald-200/70 en-bg-surface"
            }`}
          >
            <div className="flex items-center gap-3">
              <ExamNexusLogo size={42} idSuffix="sidebar" />
              <div className="min-w-0">
                <h1 className="truncate text-xl font-black leading-tight bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
                  ExamNexus
                </h1>
                <p
                  className={`truncate text-[11px] ${
                    theme === "dark" ? "text-gray-500" : "text-teal-700/80"
                  }`}
                >
                  Intelligent Assessment
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="mt-5 flex-1 space-y-5 overflow-y-auto pr-1">
            <SidebarSection title="Main" theme={theme}>
              <SidebarNavLink
                to={isStudent ? "/student/dashboard" : "/faculty/dashboard"}
                icon={LayoutDashboard}
                label={isStudent ? "Student Dashboard" : "Faculty Dashboard"}
                end
              />
              <SidebarNavLink
                to={isStudent ? "/student/profile" : "/faculty/profile"}
                icon={UserCircle}
                label="Profile"
              />
            </SidebarSection>

            {!isStudent && (
              <SidebarSection title="Communication" theme={theme}>
                <SidebarNavLink
                  to="/faculty/announcements"
                  icon={Megaphone}
                  label="Announcements"
                />
              </SidebarSection>
            )}

            {isStudent && (
              <SidebarSection title="Academics" theme={theme}>
                <SidebarNavLink
                  to="/student/subjects"
                  icon={BookOpen}
                  label="My Subjects"
                />
                <SidebarNavLink
                  to="/student/assessments"
                  icon={ClipboardCheck}
                  label="Assessments"
                />
                <SidebarNavLink
                  to="/student/results"
                  icon={Trophy}
                  label="Results"
                />
              </SidebarSection>
            )}
          </nav>

          {/* Footer */}
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
                    className={`truncate text-sm font-semibold capitalize ${
                      theme === "dark" ? "text-emerald-400" : "text-teal-800"
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
                className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-300 ${
                  theme === "dark"
                    ? "border border-red-500/20 bg-red-500/10 text-red-400 hover:border-red-400 hover:bg-red-500/20 hover:text-red-300"
                    : "en-bg-elevated border border-red-200/80 text-red-600 hover:border-red-400 hover:bg-red-50/80"
                }`}
              >
                <LogOut size={17} />
                Logout
              </button>
            </div>
          </div>
        </aside>
      )}

      <main
        className={`relative h-screen flex-1 overflow-y-auto ${
          isLockdownActive ? "p-0" : "p-8"
        } ${theme === "dark" ? "text-white" : "text-slate-900"}`}
      >
        {isLockdownActive && (
          <div
            className={`sticky top-0 z-50 flex items-center gap-2 border-b px-4 py-2 text-xs font-medium ${
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
          <div className={`absolute right-8 top-6 z-40 ${motion.fadeInDown} en-delay-2`}>
            <NotificationBell />
          </div>
        )}
        <AnimatedPage>
          <Outlet />
        </AnimatedPage>
      </main>
    </div>
  );
}
