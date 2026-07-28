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
  KeyRound,
  BarChart3,
} from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import { pageShellClass, panelClass, staggerGridClass } from "../../utils/themeInputs";
import PageHeader from "../../components/ui/PageHeader";
import { PageLoadingSkeleton } from "../../components/ui/PageLoadingSkeleton";
import { usePolling } from "../../hooks/useRealtimeFetch";
import { fetchAdminDashboardAnalytics, fetchAdminDashboardStats } from "../../utils/adminData";
import { primaryButtonSm } from "../../utils/themeButtons";
import AdminPageError, { formatAdminError } from "../../components/admin/AdminPageError";
import { AdminStatBadge, AdminVerticalBarChart } from "../../components/admin/AdminBarChart";

const ADMIN_TOOLS = [
  {
    to: "/admin/accounts",
    icon: Users,
    label: "Manage accounts",
    hint: "Approve registrations, roles, and profiles",
    getValue: (stats) => stats?.pending_requests ?? 0,
    valueLabel: "pending",
    alertWhenPositive: true,
    getDetail: (stats) =>
      `${stats?.users ?? 0} users · ${stats?.students ?? 0} students · ${stats?.faculty ?? 0} faculty`,
  },
  {
    to: "/admin/password-resets",
    icon: KeyRound,
    label: "Password resets",
    hint: "Review forgot-password requests",
    getValue: (stats) => stats?.pending_password_resets ?? 0,
    valueLabel: "pending",
    alertWhenPositive: true,
  },
  {
    to: "/admin/subjects",
    icon: BookOpen,
    label: "Manage subjects",
    hint: "Create subjects and assign faculty",
    getValue: (stats) => stats?.subjects ?? 0,
    valueLabel: "subjects",
  },
  {
    to: "/admin/announcements",
    icon: Megaphone,
    label: "Announcements",
    hint: "Broadcast to teachers or students",
    showBadge: false,
  },
  {
    to: "/admin/catalog",
    icon: Shield,
    label: "Departments & courses",
    hint: "Academic catalog setup",
    showBadge: false,
  },
  {
    to: "/admin/assessments",
    icon: ClipboardList,
    label: "Assessments",
    hint: "View all exams, quizzes, and activities",
    getValue: (stats) => stats?.assessments ?? 0,
    valueLabel: "total",
  },
  {
    to: "/admin/exam-logs",
    icon: ShieldAlert,
    label: "Exam logs",
    hint: "Integrity and proctoring events",
    getValue: (stats) => stats?.integrity_events ?? 0,
    valueLabel: "events",
  },
  {
    to: "/admin/exports",
    icon: Download,
    label: "Export data",
    hint: "Download assessments and results",
    getValue: (stats) => stats?.results ?? 0,
    valueLabel: "results",
  },
];

function AdminToolCard({ tool, stats, theme, onOpen }) {
  const Icon = tool.icon;
  const value = tool.getValue ? tool.getValue(stats) : 0;
  const showBadge = tool.showBadge !== false;
  const isAlert = tool.alertWhenPositive && Number(value) > 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`${panelClass(theme, "text-left transition hover:-translate-y-0.5")}`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            theme === "dark" ? "bg-emerald-500/10 text-emerald-400" : "en-bg-skeleton text-teal-700"
          }`}
        >
          <Icon size={20} />
        </div>
        {showBadge && (
          <AdminStatBadge value={value} label={tool.valueLabel} alert={isAlert} />
        )}
      </div>
      <h3 className="font-semibold">{tool.label}</h3>
      <p className={`mt-1 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
        {tool.hint}
      </p>
      {tool.getDetail && (
        <p className={`mt-2 text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
          {tool.getDetail(stats)}
        </p>
      )}
      <span className={`mt-3 inline-flex ${primaryButtonSm(theme, "text-xs")}`}>Open</span>
    </button>
  );
}

export default function AdminDashboard() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setLoadError("");
      const [statsData, analyticsData] = await Promise.all([
        fetchAdminDashboardStats(),
        fetchAdminDashboardAnalytics(),
      ]);
      setStats(statsData);
      setAnalytics(analyticsData);
    } catch (err) {
      console.error(err);
      setStats({});
      setAnalytics({
        teachers_active_today: [],
        exams_per_day: [],
        teachers_active_today_total: 0,
        exams_today: 0,
        unavailable: true,
      });
      setLoadError(formatAdminError(err));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  usePolling(load, []);

  if (loading && !stats) {
    return <PageLoadingSkeleton theme={theme} variant="dashboard" />;
  }

  return (
    <div className={pageShellClass(theme, "mx-auto max-w-7xl")}>
      <PageHeader
        theme={theme}
        icon={Shield}
        title="Admin Dashboard"
        subtitle="Manage accounts, subjects, announcements, and system-wide academic data."
      />

      {loadError && (
        <AdminPageError theme={theme} message={loadError} onRetry={() => load()} />
      )}

      <h2 className={`mb-4 text-lg font-bold ${theme === "dark" ? "text-emerald-400" : "text-teal-800"}`}>
        Admin tools
      </h2>
      <div className={staggerGridClass("grid gap-4 md:grid-cols-2 xl:grid-cols-3")}>
        {ADMIN_TOOLS.map((tool) => (
          <AdminToolCard
            key={tool.to}
            tool={tool}
            stats={stats}
            theme={theme}
            onOpen={() => navigate(tool.to)}
          />
        ))}
      </div>

      <div className="mt-10">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3
            size={20}
            className={theme === "dark" ? "text-emerald-400" : "text-teal-700"}
          />
          <h2 className={`text-lg font-bold ${theme === "dark" ? "text-emerald-400" : "text-teal-800"}`}>
            Analytics
          </h2>
        </div>

        {analytics?.unavailable && (
          <div
            className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
              theme === "dark"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
                : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            Chart analytics are not set up yet. Run{" "}
            <code className="text-xs">database/admin_dashboard_analytics.sql</code> in Supabase to
            enable graphs.
          </div>
        )}

        <div className={staggerGridClass("grid gap-4 xl:grid-cols-2")}>
          <div className={panelClass(theme)}>
            <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">Teachers conducting exams today</h3>
                <p className={`mt-1 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                  Faculty with at least one scheduled assessment active today
                </p>
              </div>
              <AdminStatBadge
                value={analytics?.teachers_active_today_total ?? 0}
                label="teachers"
              />
            </div>
            <div className="mt-6">
              <AdminVerticalBarChart
                items={analytics?.teachers_active_today || []}
                emptyMessage="No teachers have examinations scheduled for today."
              />
            </div>
          </div>

          <div className={panelClass(theme)}>
            <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">Examinations per day</h3>
                <p className={`mt-1 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                  Assessments scheduled to start each day (last 14 days)
                </p>
              </div>
              <AdminStatBadge value={analytics?.exams_today ?? 0} label="today" />
            </div>
            <div className="en-chart-scroll-area en-inner-scroll mt-6 overflow-x-auto overscroll-x-contain">
              <div className="min-w-[520px]">
                <AdminVerticalBarChart
                  items={analytics?.exams_per_day || []}
                  emptyMessage="No examinations recorded in the last 14 days."
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
