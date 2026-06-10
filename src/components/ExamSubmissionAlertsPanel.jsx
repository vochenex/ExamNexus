import { useEffect, useState } from "react";
import { ChevronRight, ShieldAlert } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import {
  fetchExamSubmissionAlerts,
  fetchStudentIntegrityAlerts,
} from "../utils/supabaseData";
import StudentIntegrityAlertsModal from "./StudentIntegrityAlertsModal";
import { PageLoadingSkeleton } from "./ui/PageLoadingSkeleton";

const tierStyles = {
  blue: {
    dark: "border-blue-500/30 bg-blue-500/10 text-blue-200",
    light: "border-blue-200 bg-blue-50 text-blue-900",
    badge: "bg-blue-500 text-white",
    label: "No alerts",
  },
  yellow: {
    dark: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    light: "border-amber-200 bg-amber-50 text-amber-950",
    badge: "bg-amber-500 text-black",
    label: "Some alerts",
  },
  red: {
    dark: "border-red-500/30 bg-red-500/10 text-red-200",
    light: "border-red-200 bg-red-50 text-red-900",
    badge: "bg-red-600 text-white",
    label: "High alerts",
  },
};

export default function ExamSubmissionAlertsPanel({ examId }) {
  const { theme } = useTheme();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [detailAlerts, setDetailAlerts] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!examId) return;

    const load = async (silent = false) => {
      try {
        if (!silent) setLoading(true);
        setError("");
        const rows = await fetchExamSubmissionAlerts(examId);
        setSubmissions(rows);
      } catch (err) {
        setError(err.message || "Failed to load submission alerts.");
      } finally {
        if (!silent) setLoading(false);
      }
    };

    load(false);
    const timer = setInterval(() => load(true), 5000);
    return () => clearInterval(timer);
  }, [examId]);

  const openAlertsDetail = async (student) => {
    setSelectedStudent(student);
    setDetailLoading(true);

    try {
      const alerts = await fetchStudentIntegrityAlerts(examId, student.studentId);
      setDetailAlerts(alerts.length > 0 ? alerts : student.alerts || []);
    } catch (err) {
      setDetailAlerts(student.alerts || []);
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeAlertsDetail = () => {
    setSelectedStudent(null);
    setDetailAlerts([]);
  };

  if (loading) {
    return <PageLoadingSkeleton theme={theme} variant="list" className="!min-h-0 p-0" />;
  }

  if (error) {
    return <p className="text-sm text-red-500">{error}</p>;
  }

  return (
    <>
      <div
        className={`rounded-2xl border p-5 ${
          theme === "dark"
            ? "border-white/10 bg-white/[0.03]"
            : "border-emerald-200/80 en-bg-elevated shadow-sm"
        }`}
      >
        <div className="mb-4 flex items-center gap-2">
          <ShieldAlert size={18} className="text-amber-500" />
          <h3 className="font-semibold">Submission alerts</h3>
        </div>

        <p className={`mb-4 text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
          Students who submitted (including retakes), ranked by total integrity alerts from the
          first attempt plus any retake. Click a row to see each alert with timestamps.
        </p>

        {submissions.length === 0 ? (
          <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
            No students have submitted this assessment yet.
          </p>
        ) : (
          <div className="space-y-2">
            {submissions.map((student, index) => {
              const tier = tierStyles[student.alertTier] || tierStyles.blue;
              const rowClass = theme === "dark" ? tier.dark : tier.light;
              const pendingReview = !student.total;

              return (
                <button
                  key={student.studentId}
                  type="button"
                  onClick={() => openAlertsDetail(student)}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition hover:opacity-95 ${rowClass}`}
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{student.name}</p>
                    <p className="text-xs opacity-80">
                      Rank #{index + 1} ·{" "}
                      {pendingReview
                        ? "Submitted — score pending review"
                        : `Score ${student.scorePct}% (${student.score}/${student.total})`}
                      {" · "}
                      Tap to view alerts
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="text-right">
                      <span
                        className={`inline-flex min-w-[4.5rem] justify-center rounded-full px-2.5 py-1 text-xs font-bold ${tier.badge}`}
                      >
                        {student.alertCount} alert{student.alertCount === 1 ? "" : "s"}
                      </span>
                      <p className="mt-1 text-[10px] uppercase tracking-wide opacity-70">
                        {tier.label}
                      </p>
                    </div>
                    <ChevronRight size={16} className="opacity-50" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <StudentIntegrityAlertsModal
        open={Boolean(selectedStudent)}
        onClose={closeAlertsDetail}
        studentName={selectedStudent?.name}
        alerts={detailAlerts}
        loading={detailLoading}
      />
    </>
  );
}
