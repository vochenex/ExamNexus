import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import { fetchExamIntegrityEvents } from "../utils/supabaseData";
import { formatIntegrityEventLabel } from "../utils/examIntegrity";

function studentName(row) {
  const user = row.users;
  if (!user) return "Student";
  return `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.school_id || "Student";
}

export default function ExamIntegrityPanel({ examId }) {
  const { theme } = useTheme();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!examId) return;

    fetchExamIntegrityEvents(examId)
      .then(setEvents)
      .catch((err) => setError(err.message || "Failed to load integrity events."))
      .finally(() => setLoading(false));
  }, [examId]);

  if (loading) {
    return (
      <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
        Loading integrity reports...
      </p>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-red-500">
        {error.includes("exam_integrity_events")
          ? "Run database/exam_integrity_events.sql in Supabase to enable integrity reporting."
          : error}
      </p>
    );
  }

  if (events.length === 0) {
    return (
      <div
        className={`rounded-2xl border p-5 ${
          theme === "dark"
            ? "border-white/10 bg-white/[0.03]"
            : "border-emerald-200/80 en-bg-elevated"
        }`}
      >
        <div className="flex items-center gap-2 mb-2">
          <ShieldAlert size={18} className="text-emerald-500" />
          <h3 className="font-semibold">Integrity monitoring</h3>
        </div>
        <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
          No anomalies recorded for this assessment yet.
        </p>
      </div>
    );
  }

  const grouped = events.reduce((acc, event) => {
    const key = event.student_id;
    if (!acc[key]) {
      acc[key] = { student: studentName(event), events: [] };
    }
    acc[key].events.push(event);
    return acc;
  }, {});

  return (
    <div
      className={`rounded-2xl border p-5 ${
        theme === "dark"
          ? "border-amber-500/20 bg-amber-500/5"
          : "border-amber-200 bg-amber-50/50"
      }`}
    >
      <div className="mb-4 flex items-center gap-2">
        <ShieldAlert size={18} className="text-amber-500" />
        <h3 className="font-semibold">Integrity alerts ({events.length})</h3>
      </div>

      <div className="space-y-4">
        {Object.entries(grouped).map(([studentId, group]) => (
          <div
            key={studentId}
            className={`rounded-xl border p-4 ${
              theme === "dark"
                ? "border-white/10 bg-black/20"
                : "border-amber-100 en-bg-elevated"
            }`}
          >
            <p className="font-semibold text-sm mb-3">{group.student}</p>
            <ul className="space-y-2">
              {group.events.map((event) => (
                <li
                  key={event.id}
                  className={`text-sm ${
                    theme === "dark" ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  <span className="font-medium">
                    {formatIntegrityEventLabel(event.event_type)}
                  </span>
                  <span className={`ml-2 text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
                    {new Date(event.created_at).toLocaleString()}
                  </span>
                  {event.description && (
                    <p className={`mt-1 text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                      {event.description}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
