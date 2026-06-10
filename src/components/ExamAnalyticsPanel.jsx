import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ChevronRight, Clock } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import { getFormatLabel } from "../utils/questionSections";
import { formatDurationSeconds } from "../utils/questionTimeAnalytics";
import StudentSubmissionReviewModal from "./StudentSubmissionReviewModal";

function panelClass(theme) {
  return `rounded-2xl border p-5 ${
    theme === "dark"
      ? "border-white/10 bg-white/[0.03]"
      : "border-emerald-200/80 en-bg-elevated shadow-sm"
  }`;
}

function QuestionDifficultyChart({ groups, theme, hasResponses }) {
  const [expanded, setExpanded] = useState(() =>
    Object.fromEntries((groups || []).map((group) => [group.type, true]))
  );

  if (!hasResponses) {
    return (
      <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
        No student responses yet. Difficulty rankings appear after the first submission.
      </p>
    );
  }

  if (!groups?.length) {
    return (
      <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
        No questions to analyze.
      </p>
    );
  }

  const globalRank = new Map();
  let rank = 1;
  for (const group of groups) {
    for (const item of group.items) {
      globalRank.set(item.questionId, rank);
      rank += 1;
    }
  }

  const maxIncorrect = Math.max(
    ...groups.flatMap((group) => group.items.map((item) => item.incorrectCount)),
    1
  );

  const toggleGroup = (type) => {
    setExpanded((current) => ({ ...current, [type]: !current[type] }));
  };

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const isOpen = expanded[group.type] !== false;
        const groupIncorrect = group.items.reduce(
          (sum, item) => sum + item.incorrectCount,
          0
        );

        return (
          <div
            key={group.type}
            className={`overflow-hidden rounded-xl border ${
              theme === "dark" ? "border-white/10 bg-black/20" : "border-emerald-100 bg-emerald-50/30"
            }`}
          >
            <button
              type="button"
              onClick={() => toggleGroup(group.type)}
              className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left ${
                theme === "dark" ? "hover:bg-white/5" : "en-hover"
              }`}
            >
              <div className="min-w-0">
                <p className={`font-semibold text-sm ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                  {group.label}
                </p>
                <p className={`text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
                  {group.items.length} question{group.items.length === 1 ? "" : "s"} ·{" "}
                  {groupIncorrect} total incorrect
                </p>
              </div>
              {isOpen ? (
                <ChevronUp size={18} className="shrink-0 opacity-60" />
              ) : (
                <ChevronDown size={18} className="shrink-0 opacity-60" />
              )}
            </button>

            {isOpen && (
              <div className="space-y-3 border-t px-4 py-3 border-white/10">
                {group.items.map((item) => {
                  const widthPct = (item.incorrectCount / maxIncorrect) * 100;
                  const difficultyRank = globalRank.get(item.questionId);

                  return (
                    <div key={item.questionId}>
                      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                        <span
                          className={`min-w-0 truncate ${
                            theme === "dark" ? "text-gray-300" : "text-gray-700"
                          }`}
                        >
                          #{difficultyRank} · Q{item.questionNumber} · {getFormatLabel(item.questionType)}
                        </span>
                        <span
                          className={`shrink-0 text-xs font-semibold ${
                            theme === "dark" ? "text-red-300" : "text-red-700"
                          }`}
                        >
                          {item.incorrectCount} incorrect
                        </span>
                      </div>
                      <div
                        className={`h-3 overflow-hidden rounded-full ${
                          theme === "dark" ? "bg-white/10" : "en-bg-skeleton"
                        }`}
                      >
                        <div
                          className={`h-full rounded-full transition-all ${
                            theme === "dark" ? "bg-red-400/80" : "bg-red-500"
                          }`}
                          style={{
                            width: `${item.incorrectCount > 0 ? Math.max(widthPct, 8) : 0}%`,
                          }}
                        />
                      </div>
                      <p
                        className={`mt-1 text-xs ${
                          theme === "dark" ? "text-gray-500" : "text-gray-500"
                        }`}
                      >
                        {item.responseCount} response{item.responseCount === 1 ? "" : "s"}
                        {item.accuracyRate != null && ` · ${item.accuracyRate}% accuracy`}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function QuestionTimeChart({ groups, theme, hasTimedData, overallAvgSeconds }) {
  const [expanded, setExpanded] = useState(() =>
    Object.fromEntries((groups || []).map((group) => [group.type, true]))
  );

  if (!hasTimedData) {
    return (
      <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
        No per-question timing yet. New submissions from the exam player include time spent
        on each item once the database migration for answer timing is applied in Supabase.
      </p>
    );
  }

  if (!groups?.length) {
    return (
      <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
        No timing data available yet.
      </p>
    );
  }

  const rankedItems = groups.flatMap((group) => group.items);
  const globalRank = new Map();
  rankedItems.forEach((item, index) => {
    globalRank.set(item.questionId, index + 1);
  });

  const maxAvgTime = Math.max(
    ...rankedItems.map((item) => item.avgTimeSeconds || 0),
    1
  );

  const slowest = rankedItems.filter((item) => item.avgTimeSeconds != null).slice(0, 3);

  const toggleGroup = (type) => {
    setExpanded((current) => ({ ...current, [type]: !current[type] }));
  };

  return (
    <div className="space-y-4">
      {overallAvgSeconds != null && (
        <div
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
            theme === "dark"
              ? "border-cyan-500/20 bg-cyan-500/5"
              : "border-cyan-200 bg-cyan-50/70"
          }`}
        >
          <Clock
            size={18}
            className={theme === "dark" ? "text-cyan-400" : "text-cyan-700"}
          />
          <div>
            <p className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
              Class average per question
            </p>
            <p className={`font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
              {formatDurationSeconds(overallAvgSeconds)}
            </p>
          </div>
        </div>
      )}

      {slowest.length > 0 && (
        <div
          className={`rounded-xl border px-4 py-3 ${
            theme === "dark"
              ? "border-amber-500/20 bg-amber-500/5"
              : "border-amber-200 bg-amber-50/80"
          }`}
        >
          <p
            className={`mb-2 text-xs font-semibold uppercase tracking-wide ${
              theme === "dark" ? "text-amber-300" : "text-amber-800"
            }`}
          >
            Longest to answer
          </p>
          <div className="flex flex-wrap gap-2">
            {slowest.map((item) => (
              <span
                key={item.questionId}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  theme === "dark"
                    ? "bg-amber-500/15 text-amber-200"
                    : "en-bg-elevated text-amber-900 border border-amber-200"
                }`}
              >
                Q{item.questionNumber} · {formatDurationSeconds(item.avgTimeSeconds)}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {groups.map((group) => {
          const isOpen = expanded[group.type] !== false;

          return (
            <div
              key={group.type}
              className={`overflow-hidden rounded-xl border ${
                theme === "dark"
                  ? "border-white/10 bg-black/20"
                  : "border-emerald-100 bg-emerald-50/30"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleGroup(group.type)}
                className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left ${
                  theme === "dark" ? "hover:bg-white/5" : "en-hover"
                }`}
              >
                <div className="min-w-0">
                  <p
                    className={`font-semibold text-sm ${
                      theme === "dark" ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {group.label}
                  </p>
                  <p className={`text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
                    {group.items.length} question{group.items.length === 1 ? "" : "s"} · ranked by
                    average time
                  </p>
                </div>
                {isOpen ? (
                  <ChevronUp size={18} className="shrink-0 opacity-60" />
                ) : (
                  <ChevronDown size={18} className="shrink-0 opacity-60" />
                )}
              </button>

              {isOpen && (
                <div className="space-y-3 border-t px-4 py-3 border-white/10">
                  {group.items.map((item) => {
                    const widthPct =
                      item.avgTimeSeconds != null
                        ? (item.avgTimeSeconds / maxAvgTime) * 100
                        : 0;
                    const timeRank = globalRank.get(item.questionId);
                    const isSlow = timeRank <= 3 && item.avgTimeSeconds != null;

                    return (
                      <div key={item.questionId}>
                        <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                          <span
                            className={`min-w-0 truncate ${
                              theme === "dark" ? "text-gray-300" : "text-gray-700"
                            }`}
                          >
                            #{timeRank} · Q{item.questionNumber} ·{" "}
                            {getFormatLabel(item.questionType)}
                            {isSlow && (
                              <span
                                className={`ml-2 text-[10px] font-bold uppercase ${
                                  theme === "dark" ? "text-amber-300" : "text-amber-700"
                                }`}
                              >
                                Slow
                              </span>
                            )}
                          </span>
                          <span
                            className={`shrink-0 text-xs font-semibold ${
                              theme === "dark" ? "text-cyan-300" : "text-cyan-700"
                            }`}
                          >
                            {formatDurationSeconds(item.avgTimeSeconds)} avg
                          </span>
                        </div>
                        <div
                          className={`h-3 overflow-hidden rounded-full ${
                            theme === "dark" ? "bg-white/10" : "en-bg-skeleton"
                          }`}
                        >
                          <div
                            className={`h-full rounded-full transition-all ${
                              isSlow
                                ? theme === "dark"
                                  ? "bg-amber-400/90"
                                  : "bg-amber-500"
                                : theme === "dark"
                                  ? "bg-cyan-400/80"
                                  : "bg-cyan-500"
                            }`}
                            style={{
                              width: `${
                                item.avgTimeSeconds != null
                                  ? Math.max(widthPct, 8)
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        <p
                          className={`mt-1 text-xs ${
                            theme === "dark" ? "text-gray-500" : "text-gray-500"
                          }`}
                        >
                          {item.sampleCount} timed response{item.sampleCount === 1 ? "" : "s"}
                          {item.maxTimeSeconds != null &&
                            ` · slowest ${formatDurationSeconds(item.maxTimeSeconds)}`}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ExamAnalyticsPanel({
  analytics,
  loading,
  examId,
  questions = [],
  examType = "multiple_choice",
  onScoresUpdated,
}) {
  const { theme } = useTheme();
  const [selectedStudent, setSelectedStudent] = useState(null);

  const difficultyGroups = useMemo(
    () => analytics?.questionDifficultyGroups || [],
    [analytics]
  );

  const timeGroups = useMemo(
    () => analytics?.questionTimeGroups || [],
    [analytics]
  );

  const hasTimedData = useMemo(
    () =>
      (analytics?.questionTimeAnalytics || []).some(
        (item) => item.avgTimeSeconds != null && item.sampleCount > 0
      ),
    [analytics]
  );

  const hasAnswerData = useMemo(
    () =>
      (analytics?.questionDifficulty || []).some((item) => item.responseCount > 0),
    [analytics]
  );

  const refreshAnalytics = async () => {
    await onScoresUpdated?.({ silent: true });
  };

  const reviewModal = (
    <StudentSubmissionReviewModal
      open={Boolean(selectedStudent)}
      onClose={() => setSelectedStudent(null)}
      examId={examId}
      studentId={selectedStudent?.studentId}
      studentName={selectedStudent?.name}
      questions={questions}
      examType={examType}
      onSaved={refreshAnalytics}
    />
  );

  if (loading) {
    return (
      <>
        <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
          Loading analytics...
        </p>
        {reviewModal}
      </>
    );
  }

  if (!analytics) {
    return (
      <>
        <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
          Analytics unavailable.
        </p>
        {reviewModal}
      </>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className={panelClass(theme)}>
          <h3 className={`font-semibold ${theme === "dark" ? "text-white" : "text-teal-700"}`}>
            Class average
          </h3>
          {analytics.submissionCount > 0 ? (
            <>
              {analytics.classAverage != null ? (
                <p
                  className={`mt-2 text-4xl font-bold ${
                    theme === "dark" ? "text-emerald-400" : "text-teal-700"
                  }`}
                >
                  {analytics.classAverage}%
                </p>
              ) : (
                <p className={`mt-2 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                  Submissions received — scores pending manual review.
                </p>
              )}
              <p className={`mt-1 text-sm ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
                Based on {analytics.submissionCount} submission
                {analytics.submissionCount === 1 ? "" : "s"}
              </p>
            </>
          ) : (
            <p className={`mt-2 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
              No submissions yet.
            </p>
          )}
        </div>

        <div className={panelClass(theme)}>
          <h3 className={`mb-4 font-semibold ${theme === "dark" ? "text-white" : "text-teal-700"}`}>
            Question difficulty
          </h3>
          <p className={`mb-4 text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
            Ranked by incorrect responses, grouped by question format. Longer bars mean more students
            missed that item.
          </p>
          <QuestionDifficultyChart
            groups={difficultyGroups}
            theme={theme}
            hasResponses={hasAnswerData || analytics.submissionCount > 0}
          />
        </div>

        <div className={panelClass(theme)}>
          <h3 className={`mb-1 font-semibold ${theme === "dark" ? "text-white" : "text-teal-700"}`}>
            Time per question
          </h3>
          <p className={`mb-4 text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
            Average time students spent on each item, ranked longest first. Highlights questions
            that may need clearer wording or more thinking time.
          </p>
          <QuestionTimeChart
            groups={timeGroups}
            theme={theme}
            hasTimedData={hasTimedData}
            overallAvgSeconds={analytics.overallAvgQuestionTimeSeconds}
          />
        </div>

        <div className={panelClass(theme)}>
          <h3 className={`mb-1 font-semibold ${theme === "dark" ? "text-white" : "text-teal-700"}`}>
            Student performance
          </h3>
          <p className={`mb-4 text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
            Click a student to review their answers and score essay questions.
          </p>

          {analytics.submissionCount === 0 ? (
            <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
              No submissions yet.
            </p>
          ) : analytics.studentPerformance.length === 0 ? (
            <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
              No student submissions to review yet.
            </p>
          ) : (
            <div className="space-y-2">
              {analytics.studentPerformance.map((student, index) => (
                <button
                  key={student.studentId}
                  type="button"
                  onClick={() => setSelectedStudent(student)}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${
                    theme === "dark"
                      ? "border-white/10 bg-black/20 hover:border-emerald-500/30 hover:bg-emerald-500/5"
                      : "border-emerald-100 bg-emerald-50/40 hover:border-teal-300 en-hover"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{student.name}</p>
                    <p className={`text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
                      Rank #{index + 1} · Tap to view answers
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="text-right">
                      <p
                        className={`font-bold ${
                          theme === "dark" ? "text-emerald-400" : "text-teal-700"
                        }`}
                      >
                        {student.scorePct != null ? `${student.scorePct}%` : "Pending"}
                      </p>
                      <p className={`text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
                        {student.score}/{student.total} pts
                      </p>
                    </div>
                    <ChevronRight size={16} className="opacity-50" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {reviewModal}
    </>
  );
}
