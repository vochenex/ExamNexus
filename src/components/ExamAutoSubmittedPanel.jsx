import { useEffect, useState } from "react";
import { AlertOctagon } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import CollapsiblePanel from "./ui/CollapsiblePanel";
import StudentIntegrityAlertsModal from "./StudentIntegrityAlertsModal";
import { PageLoadingSkeleton } from "./ui/PageLoadingSkeleton";
import {
  fetchExamAutoSubmittedStudents,
  fetchStudentIntegrityAlerts,
} from "../utils/supabaseData";

function formatSubmittedAt(value) {
  if (!value) return "Submitted";
  return new Date(value).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function ExamAutoSubmittedPanel({ examId }) {
  const { theme } = useTheme();
  const [students, setStudents] = useState([]);
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
        const rows = await fetchExamAutoSubmittedStudents(examId);
        setStudents(rows);
      } catch (err) {
        setError(err.message || "Failed to load auto-submitted students.");
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
      setDetailAlerts(alerts);
    } catch (err) {
      console.error(err);
      setDetailAlerts([]);
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
      <CollapsiblePanel
        title={`Auto-submitted students (${students.length})`}
        subtitle="Force-submitted after 3 tab or integrity violations — expand to view the list"
        defaultOpen={students.length > 0}
        className={
          theme === "dark"
            ? "!border-red-500/20 !bg-red-500/5"
            : "!border-red-200 !bg-red-50/40"
        }
      >
        {students.length === 0 ? (
          <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
            No students have been auto-submitted for this assessment yet.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {students.map((student) => {
              const pendingReview = !student.total;

              return (
                <div
                  key={student.studentId}
                  className={`min-w-[14rem] max-w-xs rounded-xl border px-3 py-2 ${
                    theme === "dark"
                      ? "border-red-500/25 bg-red-500/10 text-red-100"
                      : "border-red-200 bg-white text-red-950"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <AlertOctagon size={15} className="shrink-0 text-red-500" />
                      <p className="truncate text-sm font-semibold">{student.name}</p>
                    </div>
                    <p className="mt-1 text-[11px] leading-tight opacity-80">
                      {student.schoolId ? `ID ${student.schoolId} · ` : ""}
                      {formatSubmittedAt(student.submittedAt)}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-tight opacity-80">
                      {pendingReview
                        ? "Score pending review"
                        : `Score ${student.scorePct}% (${student.score}/${student.total})`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CollapsiblePanel>

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
