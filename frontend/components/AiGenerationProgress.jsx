import { CheckCircle2, Loader2 } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import { AI_FORMAT_OPTIONS } from "../utils/aiQuestionMapper";

function formatLabel(type) {
  return AI_FORMAT_OPTIONS.find((item) => item.value === type)?.label || type;
}

function resolvePercent(progress) {
  if (typeof progress?.percent === "number") {
    return Math.min(100, Math.max(0, Math.round(progress.percent)));
  }
  if (progress?.current && progress?.total) {
    return Math.min(100, Math.round((progress.current / progress.total) * 100));
  }
  return 0;
}

export default function AiGenerationProgress({ progress, questionCount = 0 }) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const isDone = progress?.status === "done";

  const panelClass = isLight
    ? "border-emerald-200/90 bg-gradient-to-r from-white via-emerald-50/80 to-emerald-100/90 en-panel-glow"
    : "border-emerald-500/20 bg-emerald-500/5";

  if (!progress) {
    return (
      <div className={`rounded-xl border p-4 ${panelClass}`}>
        <div className="flex items-center gap-3">
          <Loader2 className="animate-spin text-emerald-500" size={18} />
          <div>
            <p className={`text-sm font-semibold ${isLight ? "en-text-primary" : ""}`}>
              Starting AI generation…
            </p>
            <p className={`mt-0.5 text-xs ${isLight ? "en-text-muted" : "text-gray-400"}`}>
              Preparing your request
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { phase, current, total, latestType, status } = progress;
  const percent = resolvePercent(progress);

  const phaseLabel = isDone
    ? "Generation complete"
    : status === "waiting"
      ? phase === "reading"
        ? "Gemini is reading your document"
        : "Gemini is generating questions"
      : phase === "reading"
        ? "Reading document"
        : phase === "planning"
          ? "Planning questions from document"
          : phase === "prompt"
            ? "Generating from your prompt"
            : phase === "structuring"
              ? "Structuring questions"
              : "Analyzing document";

  const stepLabel = isDone
    ? `${questionCount} question${questionCount === 1 ? "" : "s"} ready to review below`
    : status === "waiting"
      ? total
        ? `Working toward ${total} question${total === 1 ? "" : "s"}… (paced for Gemini free-tier limits)`
        : "Pacing requests for Gemini free-tier limits…"
      : current && total
        ? `Question ${current} of ${total}${latestType ? ` · ${formatLabel(latestType)}` : ""}`
        : null;

  return (
    <div className={`rounded-xl border p-4 ${panelClass}`}>
      <div className="flex items-start gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
            isDone
              ? isLight
                ? "bg-emerald-100 text-emerald-600"
                : "bg-emerald-500/20 text-emerald-400"
              : isLight
                ? "bg-emerald-100 text-emerald-700"
                : "bg-emerald-500/15 text-emerald-400"
          }`}
        >
          {isDone ? (
            <CheckCircle2 size={24} strokeWidth={2.5} />
          ) : (
            <Loader2 className="animate-spin" size={20} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className={`text-sm font-semibold ${isLight ? "en-text-primary" : ""}`}>
              {phaseLabel}
            </p>
            {!isDone && (
              <span
                className={`shrink-0 text-lg font-bold tabular-nums ${
                  isLight ? "text-emerald-700" : "text-emerald-400"
                }`}
              >
                {percent}%
              </span>
            )}
          </div>

          {stepLabel && (
            <p className={`mt-1 text-xs ${isLight ? "en-text-muted" : "text-gray-400"}`}>
              {stepLabel}
            </p>
          )}

          {!isDone && (
            <div
              className={`mt-3 h-2 overflow-hidden rounded-full ${
                isLight ? "bg-emerald-100" : "bg-white/10"
              }`}
            >
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isLight
                    ? "bg-gradient-to-r from-emerald-400 to-teal-500"
                    : "bg-gradient-to-r from-emerald-400 to-cyan-400"
                }`}
                style={{ width: `${percent}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
