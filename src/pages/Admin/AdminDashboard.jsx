import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield,
  Users,
  BookOpen,
  ClipboardList,
  ShieldAlert,
  Megaphone,
  Download,
  LogIn,
  KeyRound,
} from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import { pageShellClass, panelClass, staggerGridClass } from "../../utils/themeInputs";
import PageHeader from "../../components/ui/PageHeader";
import { PageLoadingSkeleton } from "../../components/ui/PageLoadingSkeleton";
import { usePolling } from "../../hooks/useRealtimeFetch";
import { fetchAdminDashboardStats } from "../../utils/adminData";
import { primaryButtonSm, secondaryButtonSm } from "../../utils/themeButtons";
import AdminPageError, { formatAdminError } from "../../components/admin/AdminPageError";

function StatCard({ label, value, theme }) {
  return (
    <div className={panelClass(theme)}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold">{value ?? "—"}</p>
    </div>
  );
}

const QUICK_LINKS = [
  { to: "/admin/accounts", icon: Users, label: "Manage accounts", hint: "Users, roles, profiles" },
  { to: "/admin/password-resets", icon: KeyRound, label: "Password resets", hint: "Review forgot-password requests" },
  { to: "/admin/subjects", icon: BookOpen, label: "Manage subjects", hint: "Create subjects & assign faculty" },
  { to: "/admin/announcements", icon: Megaphone, label: "Announcements", hint: "Broadcast to teachers or students" },
  { to: "/admin/catalog", icon: Shield, label: "Departments & courses", hint: "Academic catalog setup" },
  { to: "/admin/assessments", icon: ClipboardList, label: "Assessments", hint: "View all exams & quizzes" },
  { to: "/admin/exam-logs", icon: ShieldAlert, label: "Exam logs", hint: "Integrity & proctoring events" },
  { to: "/admin/exports", icon: Download, label: "Export data", hint: "Download assessments & results" },
];

export default function AdminDashboard() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setLoadError("");
      const data = await fetchAdminDashboardStats();
      setStats(data);
    } catch (err) {
      console.error(err);
      setStats({});
      setLoadError(formatAdminError(err));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  usePolling(load, []);

  if (loading) {
    return <PageLoadingSkeleton theme={theme} variant="dashboard" />;
  }

  return (
    <div className={pageShellClass(theme, "mx-auto max-w-7xl")}>
      <PageHeader
        theme={theme}
        icon={Shield}
        title="Admin Dashboard"
        subtitle="Manage accounts, subjects, announcements, and system-wide academic data."
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => navigate("/auth")} className={secondaryButtonSm(theme)}>
              <LogIn size={16} />
              Auth page
            </button>
          </div>
        }
      />

      {loadError && (
        <AdminPageError theme={theme} message={loadError} onRetry={() => load()} />
      )}

      <div className={staggerGridClass("mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4")}>
        <StatCard theme={theme} label="Pending requests" value={stats?.pending_requests} />
        <StatCard theme={theme} label="Password resets" value={stats?.pending_password_resets} />
        <StatCard theme={theme} label="Total users" value={stats?.users} />
        <StatCard theme={theme} label="Students" value={stats?.students} />
        <StatCard theme={theme} label="Faculty" value={stats?.faculty} />
        <StatCard theme={theme} label="Subjects" value={stats?.subjects} />
        <StatCard theme={theme} label="Assessments" value={stats?.assessments} />
        <StatCard theme={theme} label="Results submitted" value={stats?.results} />
        <StatCard theme={theme} label="Exam log events" value={stats?.integrity_events} />
      </div>

      <h2 className={`mb-4 text-lg font-bold ${theme === "dark" ? "text-emerald-400" : "text-teal-800"}`}>
        Admin tools
      </h2>
      <div className={staggerGridClass("grid gap-4 md:grid-cols-2 xl:grid-cols-3")}>
        {QUICK_LINKS.map(({ to, icon: Icon, label, hint }) => (
          <button
            key={to}
            type="button"
            onClick={() => navigate(to)}
            className={`${panelClass(theme, "text-left transition hover:-translate-y-0.5")}`}
          >
            <div
              className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${
                theme === "dark" ? "bg-emerald-500/10 text-emerald-400" : "en-bg-skeleton text-teal-700"
              }`}
            >
              <Icon size={20} />
            </div>
            <h3 className="font-semibold">{label}</h3>
            <p className={`mt-1 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>{hint}</p>
            <span className={`mt-3 inline-flex ${primaryButtonSm(theme, "text-xs")}`}>Open</span>
          </button>
        ))}
      </div>
    </div>
  );
}
