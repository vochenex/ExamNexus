import { useCallback, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ShieldAlert } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import PageHeader from "../../components/ui/PageHeader";
import { PageLoadingSkeleton } from "../../components/ui/PageLoadingSkeleton";
import { usePolling } from "../../hooks/useRealtimeFetch";
import { fetchAdminExamLogs } from "../../utils/adminData";
import {
  adminTableClass,
  adminTableWrapClass,
  adminTdClass,
  adminThClass,
} from "../../components/admin/adminTableStyles";
import { pageShellClass, panelClass } from "../../utils/themeInputs";
import AdminPageError, { formatAdminError } from "../../components/admin/AdminPageError";

export default function AdminExamLogs() {
  const { theme } = useTheme();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [openKeys, setOpenKeys] = useState(() => new Set());

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setLoadError("");
      const data = await fetchAdminExamLogs(300);
      setRows(data);
    } catch (err) {
      console.error(err);
      setRows([]);
      setLoadError(formatAdminError(err));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  usePolling(load, []);

  const groups = useMemo(() => {
    const map = new Map();
    for (const row of rows) {
      const key = String(row.exam_id || row.exam_title || "unknown");
      if (!map.has(key)) {
        map.set(key, {
          key,
          title: row.exam_title || "Assessment",
          subject: row.subject_name || "",
          events: [],
        });
      }
      map.get(key).events.push(row);
    }
    return [...map.values()];
  }, [rows]);

  const toggle = (key) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAll = () => setOpenKeys(new Set(groups.map((g) => g.key)));
  const collapseAll = () => setOpenKeys(new Set());

  if (loading) return <PageLoadingSkeleton theme={theme} variant="list" />;

  const muted = theme === "dark" ? "text-gray-400" : "text-gray-600";

  return (
    <div className={pageShellClass(theme, "mx-auto max-w-7xl")}>
      <PageHeader
        theme={theme}
        icon={ShieldAlert}
        title="Exam logs"
        subtitle="Integrity and proctoring events across all assessments."
      />

      {loadError && (
        <AdminPageError theme={theme} message={loadError} onRetry={() => load()} />
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={expandAll}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
            theme === "dark"
              ? "bg-white/5 text-emerald-300 ring-1 ring-white/10"
              : "bg-emerald-50 text-teal-800 ring-1 ring-emerald-200"
          }`}
        >
          Expand all
        </button>
        <button
          type="button"
          onClick={collapseAll}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
            theme === "dark"
              ? "bg-white/5 text-gray-300 ring-1 ring-white/10"
              : "bg-slate-50 text-slate-700 ring-1 ring-slate-200"
          }`}
        >
          Collapse all
        </button>
      </div>

      {!groups.length ? (
        <div className={panelClass(theme)}>
          <p className={`text-sm ${muted}`}>No exam log events recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const open = openKeys.has(group.key);
            return (
              <div
                key={group.key}
                className={`min-w-0 overflow-hidden rounded-2xl border ${
                  theme === "dark"
                    ? "border-white/10 bg-white/[0.03]"
                    : "border-emerald-100 bg-white"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggle(group.key)}
                  className={`flex w-full min-w-0 items-center justify-between gap-3 px-4 py-3 text-left ${
                    theme === "dark" ? "text-emerald-300" : "text-teal-800"
                  }`}
                >
                  <span className="min-w-0 overflow-hidden">
                    <span className="block truncate text-sm font-semibold">
                      {group.title}
                    </span>
                    <span className={`mt-0.5 block truncate text-xs ${muted}`}>
                      {group.subject ? `${group.subject} · ` : ""}
                      {group.events.length} event{group.events.length === 1 ? "" : "s"}
                    </span>
                  </span>
                  {open ? (
                    <ChevronUp size={16} className="shrink-0" />
                  ) : (
                    <ChevronDown size={16} className="shrink-0" />
                  )}
                </button>

                {open && (
                  <div className={`${adminTableWrapClass(theme)} rounded-none border-0 border-t`}>
                    <div className="en-inner-scroll max-h-[22rem] overflow-auto">
                      <table className={`${adminTableClass(theme)} min-w-[36rem]`}>
                        <thead>
                          <tr>
                            <th className={adminThClass(theme)}>Time</th>
                            <th className={adminThClass(theme)}>Student</th>
                            <th className={adminThClass(theme)}>Event</th>
                            <th className={adminThClass(theme)}>Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.events.map((row) => (
                            <tr key={row.id}>
                              <td className={adminTdClass(theme)}>
                                {row.created_at
                                  ? new Date(row.created_at).toLocaleString()
                                  : "—"}
                              </td>
                              <td className={adminTdClass(theme)}>
                                {row.student_name || row.student_id}
                              </td>
                              <td className={adminTdClass(theme)}>{row.event_type}</td>
                              <td className={adminTdClass(theme)}>
                                {row.description || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
