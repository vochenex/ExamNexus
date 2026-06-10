import { useCallback, useEffect, useState } from "react";
import { useTheme } from "../layouts/ThemeContext";
import { PageLoadingSkeleton } from "../components/ui/PageLoadingSkeleton";
import { usePolling } from "../hooks/useRealtimeFetch";

export default function TeacherAnalytics({ examId }) {
  const { theme } = useTheme();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch(`http://localhost:5000/analytics/exam/${examId}`);
      const json = await res.json();
      setData(Array.isArray(json) ? json : []);
    } catch (err) {
      console.error(err);
      setData([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [examId]);

  usePolling(load, [examId]);

  if (loading) {
    return <PageLoadingSkeleton theme={theme} variant="list" />;
  }

  return (
    <div className={`p-6 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
      <h1 className="mb-4 text-xl">Question Difficulty</h1>

      {data.map((q, i) => (
        <div
          key={q.question_id || i}
          className={`mb-2 rounded p-3 ${
            theme === "dark" ? "bg-white/10" : "en-bg-surface"
          }`}
        >
          <p>Question ID: {q.question_id}</p>
          <p>Wrong Rate: {(q.wrongRate * 100).toFixed(1)}%</p>
        </div>
      ))}
    </div>
  );
}
