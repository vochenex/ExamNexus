import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { useNavigate } from "react-router-dom";
import { ClipboardCheck, Trophy, Eye, EyeOff } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import { resolveStudentId } from "../../utils/authUser";
import PageHeader from "../../components/ui/PageHeader";
import { pageShellWithBellClass, panelClass, emptyStateClass } from "../../utils/themeInputs";

function scoreLabel(score, total) {
  if (score === total) return { text: "Perfect", className: "text-emerald-500" };
  if (score >= total / 2) return { text: "Passed", className: "text-amber-500" };
  return { text: "Failed", className: "text-red-500" };
}

export default function StudentResultsList() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [studentId, setStudentId] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadResults = async () => {
      try {
        const resolvedId = await resolveStudentId();
        if (!resolvedId) {
          setResults([]);
          return;
        }

        setStudentId(resolvedId);

        const { data: examResults, error } = await supabase
          .from("exam_results")
          .select("*, exam(*)")
          .eq("student_id", resolvedId)
          .order("id", { ascending: false });

        if (error) throw error;

        const visibleResults = (examResults || []).filter(
          (row) => row.exam?.allow_student_view !== false
        );
        setResults(visibleResults);
      } catch (err) {
        console.error("Failed to fetch results:", err);
      } finally {
        setLoading(false);
      }
    };

    loadResults();
  }, []);

  if (loading) {
    return (
      <div className={pageShellWithBellClass(theme)}>
        <div className="mx-auto max-w-7xl animate-pulse space-y-6">
          <div className={`h-10 w-72 rounded-xl ${theme === "dark" ? "bg-white/10" : "en-bg-skeleton"}`} />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-40 rounded-2xl ${theme === "dark" ? "bg-white/5" : "en-bg-surface"}`}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={pageShellWithBellClass(theme)}>
      <div className="mx-auto max-w-7xl">
        <PageHeader
          theme={theme}
          icon={Trophy}
          title="Completed Assessments"
          subtitle="Review scores and answers for finished assessments your teacher has released."
        />

        {!results.length ? (
          <div className={emptyStateClass(theme)}>
            <ClipboardCheck
              size={40}
              className={`mx-auto mb-3 ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}
            />
            <p className="font-medium">No results yet</p>
            <p className="mt-1 text-sm">You have not completed any assessments yet.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {results.map((r) => {
              const label = scoreLabel(r.score, r.total);
              const pct = r.total ? Math.round((r.score / r.total) * 100) : 0;
              const fullReview = r.exam?.allow_question_review !== false;

              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() =>
                    navigate(`/student/results/${r.exam_id}/${studentId}`)
                  }
                  className={`${panelClass(theme, "text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer")}`}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        fullReview
                          ? theme === "dark"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-emerald-100 text-emerald-800"
                          : theme === "dark"
                            ? "bg-amber-500/15 text-amber-300"
                            : "bg-amber-100 text-amber-900"
                      }`}
                    >
                      {fullReview ? <Eye size={12} /> : <EyeOff size={12} />}
                      {fullReview ? "Full review" : "Score only"}
                    </span>
                  </div>
                  <h2
                    className={`text-lg font-semibold truncate ${
                      theme === "dark" ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {r.exam?.title || "Assessment"}
                  </h2>
                  {r.exam?.description && (
                    <p
                      className={`text-sm mt-1 line-clamp-2 ${
                        theme === "dark" ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      {r.exam.description}
                    </p>
                  )}

                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      <p className={`text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
                        Score
                      </p>
                      <p className="text-xl font-bold">
                        {r.score}
                        <span className={`text-sm font-normal ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                          {" "}
                          / {r.total}
                        </span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${label.className}`}>{label.text}</p>
                      <p className={`text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
                        {pct}%
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
