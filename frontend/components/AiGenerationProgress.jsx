import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "../layouts/ThemeContext";
import { AI_FORMAT_OPTIONS } from "../utils/aiQuestionMapper";

function formatLabel(type) {
  return AI_FORMAT_OPTIONS.find((item) => item.value === type)?.label || type;
}

function resolvePercent(progress, isActive) {
  const current = Number(progress?.current);
  const total = Number(progress?.total);
  const explicit =
    typeof progress?.percent === "number" && Number.isFinite(progress.percent)
      ? progress.percent
      : null;

  // Only use current/total once questions are actually arriving.
  // Early phases send current:0,total:1 which otherwise locks the bar at 1%.
  const countsUseful =
    Number.isFinite(current) &&
    Number.isFinite(total) &&
    total > 0 &&
    current > 0;

  if (countsUseful) {
    return Math.min(99, Math.max(1, Math.round((current / total) * 99)));
  }

  if (explicit != null) {
    return Math.min(isActive ? 92 : 99, Math.max(1, Math.round(explicit)));
  }

  return isActive ? 3 : 0;
}

export default function AiGenerationProgress({
  progress,
  questionCount = 0,
  active = false,
}) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const isDone = progress?.status === "done" && !active;
  const isActive = active || (progress && progress.status !== "done");
  const highestRef = useRef(0);
  const [displayPercent, setDisplayPercent] = useState(0);

  useEffect(() => {
    if (!progress) {
      highestRef.current = 0;
      setDisplayPercent(0);
      return;
    }

    const next = resolvePercent(progress, isActive);
    const current = Number(progress?.current);
    const total = Number(progress?.total);
    const hasLiveCounts =
      Number.isFinite(current) &&
      Number.isFinite(total) &&
      total > 0 &&
      current > 0 &&
      current < total;

    if (isDone) {
      highestRef.current = 0;
      setDisplayPercent(0);
      return;
    }

    if (hasLiveCounts) {
      highestRef.current = next;
      setDisplayPercent(next);
      return;
    }

    const monotonic = Math.max(highestRef.current, next);
    highestRef.current = monotonic;
    setDisplayPercent(monotonic);
  }, [progress, isDone, isActive]);

  // Success is shown via the top toast — hide any done-state chip here.
  if (!progress || isDone) return null;

  const panelClass = isLight
    ? "border-emerald-200/90 bg-gradient-to-r from-white via-emerald-50/80 to-emerald-100/90 en-panel-glow"
    : "border-emerald-500/20 bg-emerald-500/5";

  const { phase, current, total, latestType, status } = progress;
  const percent = displayPercent;

  const phaseLabel =
    status === "waiting"
      ? phase === "reading"
        ? "AI is reading your document"
        : "AI is generating questions"
      : status === "classifying"
        ? "Classifying document"
        : status === "converting"
          ? "Converting questionnaire"
          : phase === "reading"
            ? "Reading document"
            : phase === "planning"
              ? "Planning questions from document"
              : phase === "prompt"
                ? "Generating from your prompt"
                : phase === "structuring"
                  ? "Structuring questions"
                  : "Generating questions";

  const stepLabel =
    status === "waiting" || status === "classifying"
      ? total
        ? `Working toward ${total} question${total === 1 ? "" : "s"}…`
        : "Pacing AI requests…"
      : current && total
        ? `Question ${current} of ${total}${latestType ? ` · ${formatLabel(latestType)}` : ""}`
        : questionCount > 0
          ? `${questionCount} question${questionCount === 1 ? "" : "s"} so far`
          : null;

  return (
    <div className={`rounded-xl border p-4 ${panelClass}`}>
      <div className="flex items-start gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
            isLight
              ? "bg-emerald-100 text-emerald-700"
              : "bg-emerald-500/15 text-emerald-400"
          }`}
        >
          <Loader2 className="animate-spin" size={20} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className={`text-sm font-semibold ${isLight ? "en-text-primary" : ""}`}>
              {phaseLabel}
            </p>
            <span
              className={`shrink-0 text-lg font-bold tabular-nums ${
                isLight ? "text-emerald-700" : "text-emerald-400"
              }`}
            >
              {percent}%
            </span>
          </div>

          {stepLabel && (
            <p className={`mt-1 text-xs ${isLight ? "en-text-muted" : "text-gray-400"}`}>
              {stepLabel}
            </p>
          )}

          <div
            className={`mt-3 h-2 overflow-hidden rounded-full ${
              isLight ? "bg-emerald-100" : "bg-white/10"
            }`}
          >
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${
                isLight
                  ? "bg-gradient-to-r from-emerald-400 to-teal-500"
                  : "bg-gradient-to-r from-emerald-400 to-cyan-400"
              }`}
              style={{ width: `${Math.max(percent, 3)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
