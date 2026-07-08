import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import { panelClass } from "../utils/themeInputs";
import { secondaryButtonSm, primaryButtonSm } from "../utils/themeButtons";
import ProfileAvatar from "./ProfileAvatar";
import {
  fetchExamRetakeRequests,
  reviewExamRetakeRequests,
} from "../utils/supabaseData";
import { formatSectionLabel } from "../utils/sections";
import { useAppModal } from "../contexts/AppModalContext";

const STATUS_STYLES = {
  pending: {
    dark: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    light: "bg-amber-100 text-amber-900 border-amber-200",
    label: "Pending",
  },
  approved: {
    dark: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    light: "bg-emerald-100 text-emerald-900 border-emerald-200",
    label: "Approved",
  },
  denied: {
    dark: "bg-red-500/15 text-red-300 border-red-500/30",
    light: "bg-red-100 text-red-800 border-red-200",
    label: "Denied",
  },
  fulfilled: {
    dark: "bg-white/10 text-gray-300 border-white/10",
    light: "bg-gray-100 text-gray-700 border-gray-200",
    label: "Used",
  },
};

function studentName(row) {
  const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
  return name || row.email || "Student";
}

export default function ExamRetakeRequestsPanel({ examId, onUpdated }) {
  const { theme } = useTheme();
  const appModal = useAppModal();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [filter, setFilter] = useState("all");
  const [facultyNote, setFacultyNote] = useState("");
  const [processing, setProcessing] = useState(false);

  const loadRequests = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError("");
      const rows = await fetchExamRetakeRequests(examId);
      setRequests(rows);
      if (!silent) setSelectedIds(new Set());
    } catch (err) {
      setError(err.message || "Failed to load retake requests.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (!examId) return undefined;

    loadRequests(false);
    const timer = setInterval(() => loadRequests(true), 5000);
    return () => clearInterval(timer);
  }, [examId]);

  const filtered = useMemo(() => {
    if (filter === "all") return requests;
    return requests.filter((row) => row.status === filter);
  }, [filter, requests]);

  const pendingIds = useMemo(
    () => requests.filter((row) => row.status === "pending").map((row) => row.id),
    [requests]
  );

  const visiblePendingIds = useMemo(
    () => filtered.filter((row) => row.status === "pending").map((row) => row.id),
    [filtered]
  );

  const allVisiblePendingSelected =
    visiblePendingIds.length > 0 &&
    visiblePendingIds.every((id) => selectedIds.has(id));

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisiblePendingSelected) {
        visiblePendingIds.forEach((id) => next.delete(id));
      } else {
        visiblePendingIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleReview = async (action) => {
    const ids = [...selectedIds].filter((id) =>
      requests.some((row) => row.id === id && row.status === "pending")
    );

    if (!ids.length) {
      appModal.warning("Select at least one pending request.", "Nothing selected");
      return;
    }

    const verb = action === "approve" ? "approve" : "deny";
    const confirmed = await appModal.confirm({
      title: `${action === "approve" ? "Approve" : "Deny"} retake requests?`,
      message: `${action === "approve" ? "Approve" : "Deny"} ${ids.length} retake request(s)?${
        action === "approve"
          ? "\n\nApproved students will have their previous submission cleared so they can retake."
          : ""
      }`,
      tone: action === "approve" ? "warning" : "danger",
      confirmLabel: action === "approve" ? "Approve" : "Deny",
    });
    if (!confirmed) return;

    try {
      setProcessing(true);
      await reviewExamRetakeRequests(examId, ids, action, facultyNote);
      await loadRequests();
      onUpdated?.();
    } catch (err) {
      appModal.error(err.message || `Failed to ${verb} retake requests.`);
    } finally {
      setProcessing(false);
    }
  };

  const counts = useMemo(
    () => ({
      all: requests.length,
      pending: requests.filter((row) => row.status === "pending").length,
      approved: requests.filter((row) => row.status === "approved").length,
      denied: requests.filter((row) => row.status === "denied").length,
    }),
    [requests]
  );

  if (loading) {
    return (
      <div className={`animate-pulse space-y-3 ${panelClass(theme)}`}>
        <div className={`h-5 w-40 rounded-lg ${theme === "dark" ? "bg-white/10" : "en-bg-skeleton"}`} />
        <div className={`h-16 rounded-xl ${theme === "dark" ? "bg-white/10" : "en-bg-skeleton"}`} />
        <div className={`h-16 rounded-xl ${theme === "dark" ? "bg-white/10" : "en-bg-skeleton"}`} />
      </div>
    );
  }

  return (
    <div className={panelClass(theme)}>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <RotateCcw
              size={20}
              className={theme === "dark" ? "text-emerald-400" : "text-teal-700"}
            />
            <h3
              className={`text-lg font-semibold ${
                theme === "dark" ? "text-white" : "text-teal-800"
              }`}
            >
              Retake Requests
            </h3>
          </div>
          <p className={`mt-1 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
            Review student retake requests. Approving clears their previous submission.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { key: "all", label: "All" },
            { key: "pending", label: "Pending" },
            { key: "approved", label: "Approved" },
            { key: "denied", label: "Denied" },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                filter === key
                  ? theme === "dark"
                    ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-300"
                    : "border-teal-500 bg-teal-50 text-teal-800"
                  : theme === "dark"
                    ? "border-white/10 bg-white/5 text-gray-400"
                    : "border-emerald-200 en-bg-muted text-gray-600"
              }`}
            >
              {label} ({counts[key] ?? 0})
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-500">{error}</p>
      )}

      {pendingIds.length > 0 && (
        <div
          className={`mb-4 rounded-xl border p-3 ${
            theme === "dark"
              ? "border-white/10 bg-white/[0.03]"
              : "border-emerald-200/80 en-bg-muted"
          }`}
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex-1">
              <label
                className={`mb-1.5 block text-xs font-medium ${
                  theme === "dark" ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Optional note to students
              </label>
              <input
                type="text"
                value={facultyNote}
                onChange={(e) => setFacultyNote(e.target.value)}
                placeholder="Reason or instructions (optional)"
                className={`w-full rounded-xl px-3 py-2 text-sm outline-none ${
                  theme === "dark"
                    ? "border border-white/10 bg-white/5 text-white"
                    : "border border-emerald-200 en-bg-input text-gray-900"
                }`}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={processing || selectedIds.size === 0}
                onClick={() => handleReview("approve")}
                className={primaryButtonSm(theme, "disabled:opacity-50")}
              >
                <CheckCircle2 size={16} />
                Approve selected
              </button>
              <button
                type="button"
                disabled={processing || selectedIds.size === 0}
                onClick={() => handleReview("deny")}
                className={secondaryButtonSm(
                  theme,
                  "disabled:opacity-50 !border-red-500/30 !text-red-500"
                )}
              >
                <XCircle size={16} />
                Deny selected
              </button>
            </div>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
          No retake requests{filter !== "all" ? ` with status "${filter}"` : ""} yet.
        </p>
      ) : (
        <div className="space-y-3">
          {visiblePendingIds.length > 0 && (
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm ${
                theme === "dark"
                  ? "border-white/10 bg-white/[0.02]"
                  : "border-emerald-200/70 en-bg-muted"
              }`}
            >
              <input
                type="checkbox"
                checked={allVisiblePendingSelected}
                onChange={toggleSelectAllVisible}
                className="h-4 w-4 rounded border-emerald-400 text-emerald-500 focus:ring-emerald-500"
              />
              <span className={theme === "dark" ? "text-gray-300" : "text-gray-700"}>
                Select all pending on this page ({visiblePendingIds.length})
              </span>
            </label>
          )}

          {filtered.map((row) => {
            const styles = STATUS_STYLES[row.status] || STATUS_STYLES.pending;
            const isPending = row.status === "pending";

            return (
              <div
                key={row.id}
                className={`rounded-xl border p-4 ${
                  theme === "dark"
                    ? "border-white/10 bg-black/20"
                    : "border-emerald-200/80 en-bg-elevated"
                } ${selectedIds.has(row.id) ? "ring-2 ring-emerald-400/40" : ""}`}
              >
                <div className="flex items-start gap-3">
                  {isPending ? (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(row.id)}
                      onChange={() => toggleSelect(row.id)}
                      className="mt-3 h-4 w-4 shrink-0 rounded border-emerald-400 text-emerald-500 focus:ring-emerald-500"
                    />
                  ) : (
                    <span className="mt-3 w-4 shrink-0" />
                  )}

                  <ProfileAvatar
                    src={row.avatar_url}
                    alt={studentName(row)}
                    size="sm"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className={`font-semibold ${
                          theme === "dark" ? "text-white" : "text-gray-900"
                        }`}
                      >
                        {studentName(row)}
                      </p>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                          theme === "dark" ? styles.dark : styles.light
                        }`}
                      >
                        {styles.label}
                      </span>
                    </div>

                    <p className={`text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
                      {row.email}
                      {row.section ? ` · ${formatSectionLabel(row.section)}` : ""}
                    </p>

                    {(row.original_score != null || row.retake_score != null || (row.last_score != null && row.last_total != null)) && (
                      <div className="mt-1 space-y-0.5 text-xs">
                        {row.original_score != null && row.original_total != null && (
                          <p className={theme === "dark" ? "text-gray-400" : "text-gray-600"}>
                            <span className="inline-flex items-center gap-2">
                              <span>Original attempt:</span>
                              {(row.status === "fulfilled" ||
                                (row.retake_score != null && row.retake_total != null)) && (
                                <span
                                  className={`inline-flex items-center justify-center rounded-full border px-1.5 py-0.5 ${
                                    theme === "dark"
                                      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                                      : "border-emerald-200 bg-emerald-50 text-emerald-800"
                                  }`}
                                  title="This student took a retake"
                                >
                                  <RotateCcw size={12} />
                                </span>
                              )}
                            </span>{" "}
                            <span className="font-semibold">
                              {row.original_score} / {row.original_total}
                            </span>
                          </p>
                        )}
                        {row.retake_score != null && row.retake_total != null && (
                          <p className={theme === "dark" ? "text-emerald-300" : "text-emerald-700"}>
                            Retake attempt:{" "}
                            <span className="font-semibold">
                              {row.retake_score} / {row.retake_total}
                            </span>
                          </p>
                        )}
                        {/* Fallback for older rows/backends that only expose a single last_score */}
                        {row.original_score == null &&
                          row.retake_score == null &&
                          row.last_score != null &&
                          row.last_total != null && (
                            <p className={theme === "dark" ? "text-gray-400" : "text-gray-600"}>
                              Last score:{" "}
                              <span className="font-semibold">
                                {row.last_score} / {row.last_total}
                              </span>
                            </p>
                          )}
                      </div>
                    )}

                    {row.student_message && (
                      <p
                        className={`mt-2 text-sm rounded-lg px-3 py-2 ${
                          theme === "dark"
                            ? "bg-white/5 text-gray-300"
                            : "en-bg-muted text-gray-700"
                        }`}
                      >
                        <span className="font-medium">Student: </span>
                        {row.student_message}
                      </p>
                    )}

                    {row.faculty_note && (
                      <p
                        className={`mt-2 text-sm rounded-lg px-3 py-2 ${
                          theme === "dark"
                            ? "bg-emerald-500/10 text-emerald-200"
                            : "bg-emerald-50 text-emerald-900"
                        }`}
                      >
                        <span className="font-medium">Faculty note: </span>
                        {row.faculty_note}
                      </p>
                    )}

                    <p className={`mt-2 text-[11px] ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
                      Requested{" "}
                      {new Date(row.created_at).toLocaleString("en-PH", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                      {row.reviewed_at &&
                        ` · Reviewed ${new Date(row.reviewed_at).toLocaleString("en-PH", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}`}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
