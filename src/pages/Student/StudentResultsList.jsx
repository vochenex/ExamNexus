import { useCallback, useState } from "react";
import { supabase } from "../../supabaseClient";
import { useNavigate } from "react-router-dom";
import { ClipboardCheck, Trophy, Eye, EyeOff } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import { resolveStudentId } from "../../utils/authUser";
import PageHeader from "../../components/ui/PageHeader";
import { pageShellWithBellClass, panelClass, emptyStateClass, staggerGridClass } from "../../utils/themeInputs";
import { PageLoadingSkeleton } from "../../components/ui/PageLoadingSkeleton";
import { usePolling } from "../../hooks/useRealtimeFetch";
import {
  canStudentAccessResults,
  getStudentResultsReleaseLabel,
} from "../../utils/assessmentStatus";

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

  const loadResults = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const resolvedId = await resolveStudentId();
      if (!resolvedId) {
        setResults([]);
        return;
      }

      setStudentId(resolvedId);

      let { data: examResults, error } = await supabase
        .from("exam_results")
        .select("*, exam:exams(*)")
        .eq("student_id", resolvedId)
        .order("id", { ascending: false });

      if (error?.message?.includes("exam") || error?.code === "PGRST200") {
        ({ data: examResults, error } = await supabase
          .from("exam_results")
          .select("*, exams(*)")
          .eq("student_id", resolvedId)
          .order("id", { ascending: false }));

        if (!error && examResults) {
          examResults = examResults.map((row) => ({
            ...row,
            exam: row.exam || row.exams || null,
          }));
        }
      }

      if (error) throw error;

      setResults(
        (examResults || []).map((row) => ({
          ...row,
          exam: row.exam || row.exams || null,
        }))
      );
    } catch (err) {
      console.error("Failed to fetch results:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  usePolling(loadResults, []);

  if (loading) {
    return <PageLoadingSkeleton theme={theme} variant="cards" />;
  }

  return (
    <div className={pageShellWithBellClass(theme)}>
      <div className="mx-auto max-w-7xl">
        <PageHeader
          theme={theme}
          icon={Trophy}
          title="Completed Assessments"
          subtitle="All assessments you have finished appear here. Scores and review details depend on what your teacher has released."
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
          <div className={staggerGridClass("grid md:grid-cols-2 lg:grid-cols-3 gap-5")}>
            {results.map((r) => {
              const canAccess = canStudentAccessResults(r.exam);
              const releaseLabel = getStudentResultsReleaseLabel(r.exam);
              const label = scoreLabel(r.score, r.total);
              const pct = r.total ? Math.round((r.score / r.total) * 100) : 0;
              const showFullReviewBadge = releaseLabel === "Full review";
              const showReviewBadge = releaseLabel === "Review (no answers)";
              const panelClasses = panelClass(
                theme,
                canAccess ? "text-left cursor-pointer" : "text-left"
              );

              const cardBody = (
                <>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        !canAccess
                          ? theme === "dark"
                            ? "bg-white/10 text-gray-300"
                            : "bg-gray-100 text-gray-700"
                          : showFullReviewBadge
                            ? theme === "dark"
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-emerald-100 text-emerald-800"
                            : showReviewBadge
                              ? theme === "dark"
                                ? "bg-cyan-500/15 text-cyan-300"
                                : "bg-cyan-100 text-cyan-900"
                              : theme === "dark"
                                ? "bg-amber-500/15 text-amber-300"
                                : "bg-amber-100 text-amber-900"
                      }`}
                    >
                      {!canAccess ? (
                        <EyeOff size={12} />
                      ) : showFullReviewBadge ? (
                        <Eye size={12} />
                      ) : (
                        <EyeOff size={12} />
                      )}
                      {releaseLabel}
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
                    {canAccess ? (
                      <>
                        <div>
                          <p
                            className={`text-xs ${
                              theme === "dark" ? "text-gray-500" : "text-gray-500"
                            }`}
                          >
                            Score
                          </p>
                          <p className="text-xl font-bold">
                            {r.score}
                            <span
                              className={`text-sm font-normal ${
                                theme === "dark" ? "text-gray-400" : "text-gray-500"
                              }`}
                            >
                              {" "}
                              / {r.total}
                            </span>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-semibold ${label.className}`}>
                            {label.text}
                          </p>
                          <p
                            className={`text-xs ${
                              theme === "dark" ? "text-gray-500" : "text-gray-500"
                            }`}
                          >
                            {pct}%
                          </p>
                        </div>
                      </>
                    ) : (
                      <p
                        className={`text-sm ${
                          theme === "dark" ? "text-gray-400" : "text-gray-600"
                        }`}
                      >
                        Score not released by your instructor yet.
                      </p>
                    )}
                  </div>
                </>
              );

              if (!canAccess) {
                return (
                  <div key={r.id} className={panelClasses}>
                    {cardBody}
                  </div>
                );
              }

              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() =>
                    navigate(`/student/results/${r.exam_id}/${studentId}`)
                  }
                  className={panelClasses}
                >
                  {cardBody}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
