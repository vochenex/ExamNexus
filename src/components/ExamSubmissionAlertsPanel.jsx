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
        className={`rounded-3xl border p-5 backdrop-blur-md ${
          theme === "dark"
            ? "border-white/10 bg-white/[0.045] shadow-[0_12px_40px_rgba(0,0,0,0.22)]"
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
          <div className="flex flex-wrap gap-2">
            {submissions.map((student, index) => {
              const tier = tierStyles[student.alertTier] || tierStyles.blue;
              const rowClass = theme === "dark" ? tier.dark : tier.light;
              const pendingReview = !student.total;

              return (
                <button
                  key={student.studentId}
                  type="button"
                  onClick={() => openAlertsDetail(student)}
                  className={`min-w-[14rem] max-w-xs rounded-xl border px-3 py-2.5 text-left transition hover:opacity-95 ${rowClass}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{student.name}</p>
                    <p className="mt-1 text-[11px] leading-tight opacity-80">
                      Rank #{index + 1}
                      {" · "}
                      {pendingReview
                        ? "Score pending review"
                        : `${student.scorePct}% (${student.score}/${student.total})`}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${tier.badge}`}
                      >
                        {student.alertCount} alert{student.alertCount === 1 ? "" : "s"}
                      </span>
                      <ChevronRight size={14} className="opacity-50" />
                    </div>
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
