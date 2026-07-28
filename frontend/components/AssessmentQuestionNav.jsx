import { Lock } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";

export default function AssessmentQuestionNav({
  groups,
  currentIndex,
  answersByQuestionId,
  flaggedIndices,
  examType,
  getQuestionFormatType,
  isAnswerProvided,
  isIndexNavigable,
  isSectionLocked,
  onSelect,
}) {
  const { theme } = useTheme();

  return (
    <aside
      className={`rounded-2xl border p-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto ${
        theme === "dark"
          ? "border-white/10 bg-white/[0.03]"
          : "border-emerald-200/80 en-bg-elevated shadow-sm"
      }`}
    >
      <h2
        className={`mb-1 text-sm font-semibold ${
          theme === "dark" ? "text-emerald-400" : "text-teal-700"
        }`}
      >
        Items
      </h2>
      <p className={`mb-4 text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
        Complete each section before the next unlocks. Finished sections may stay locked when
        your teacher enables section locking.
      </p>

      <div className="space-y-5">
        {groups.map((group, groupIndex) => {
          const start = group.items[0]?.number;
          const end = group.items[group.items.length - 1]?.number;
          const rangeLabel = start === end ? `${start}` : `${start}–${end}`;
          const locked = isSectionLocked?.(groupIndex) ?? false;

          return (
            <div key={group.type}>
              <p
                className={`mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${
                  locked
                    ? theme === "dark"
                      ? "text-gray-600"
                      : "text-gray-400"
                    : theme === "dark"
                      ? "text-gray-400"
                      : "text-gray-600"
                }`}
              >
                {locked && <Lock size={12} />}
                {rangeLabel} · {group.label}
                {locked && " · locked"}
              </p>

              <div className="flex flex-wrap gap-2">
                {group.items.map((item) => {
                  const questionType = getQuestionFormatType(
                    { question_type: group.type },
                    examType
                  );
                  const answered = isAnswerProvided(
                    answersByQuestionId[item.questionId],
                    questionType
                  );
                  const flagged = flaggedIndices.has(item.index);
                  const active = currentIndex === item.index;
                  const navigable = isIndexNavigable?.(item.index) ?? true;
                  const disabled = locked || !navigable;

                  return (
                    <button
                      key={item.questionId || item.index}
                      type="button"
                      disabled={disabled}
                      onClick={() => !disabled && onSelect(item.index)}
                      className={`
                        relative h-10 min-w-10 rounded-xl px-3 text-sm font-semibold transition
                        ${
                          disabled
                            ? theme === "dark"
                              ? "cursor-not-allowed border border-white/5 bg-white/[0.02] text-gray-600 opacity-50"
                              : "cursor-not-allowed border border-gray-100 bg-gray-50 text-gray-400 opacity-60"
                            : active
                              ? theme === "dark"
                                ? "bg-emerald-500 text-black ring-2 ring-emerald-300"
                                : "bg-emerald-500 text-white ring-2 ring-teal-300"
                              : answered
                              ? theme === "dark"
                                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                                : "bg-emerald-50 text-teal-800 border border-emerald-200"
                              : flagged
                                ? theme === "dark"
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                  : "bg-amber-50 text-amber-800 border border-amber-300"
                                : theme === "dark"
                                  ? "bg-white/5 text-gray-300 border border-white/10 hover:border-emerald-500/30"
                                  : "en-bg-elevated text-gray-700 border border-emerald-100 hover:border-emerald-300"
                        }
                      `}
                    >
                      {item.number}
                      {flagged && !answered && !disabled && (
                        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div
        className={`mt-5 space-y-2 border-t pt-4 text-xs ${
          theme === "dark" ? "border-white/10 text-gray-500" : "border-emerald-100 text-gray-500"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-emerald-500/30 border border-emerald-500/40" />
          Answered
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-amber-500/20 border border-amber-500/40" />
          Flagged
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`h-3 w-3 rounded border ${
              theme === "dark" ? "border-white/20 bg-white/5" : "border-emerald-100 en-bg-elevated"
            }`}
          />
          Not answered yet
        </div>
        <div className="flex items-center gap-2">
          <Lock size={12} className="opacity-60" />
          Section locked (not open yet, or finished and locked by teacher)
        </div>
      </div>
    </aside>
  );
}
