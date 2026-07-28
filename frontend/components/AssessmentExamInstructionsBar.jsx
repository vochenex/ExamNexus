import { useState } from "react";
import { ChevronDown, ChevronUp, Info, ShieldAlert } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import { MAX_INTEGRITY_STRIKES } from "../utils/examIntegrity";

export default function AssessmentExamInstructionsBar({
  instructions,
  integrityStrikes = 0,
  maxStrikes = MAX_INTEGRITY_STRIKES,
}) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const remaining = Math.max(0, maxStrikes - integrityStrikes);
  const hasInstructions = Boolean(instructions?.trim());
  const isCritical = remaining <= 1;

  return (
    <div
      className={`mb-6 rounded-2xl border ${
        theme === "dark"
          ? "border-amber-500/25 bg-amber-500/5"
          : "border-amber-200 bg-amber-50/80"
      }`}
    >
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <Info
            size={18}
            className={`mt-0.5 shrink-0 ${
              theme === "dark" ? "text-amber-300" : "text-amber-700"
            }`}
          />
          <div>
            <p
              className={`text-sm font-semibold ${
                theme === "dark" ? "text-amber-100" : "text-amber-950"
              }`}
            >
              Exam instructions & integrity rules
            </p>
            <p
              className={`mt-1 text-xs leading-relaxed ${
                theme === "dark" ? "text-amber-100/70" : "text-amber-900/80"
              }`}
            >
              Stay on this tab. Switching tabs or opening another assessment tab counts as a
              violation. After {maxStrikes} violations, your exam is submitted automatically.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
              isCritical
                ? theme === "dark"
                  ? "border-red-500/40 bg-red-500/15 text-red-200"
                  : "border-red-300 bg-red-100 text-red-800"
                : theme === "dark"
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                  : "border-amber-300 bg-white text-amber-900"
            }`}
          >
            <ShieldAlert size={14} />
            {remaining} alert{remaining === 1 ? "" : "s"} left
          </span>

          {hasInstructions && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                theme === "dark"
                  ? "border-white/10 bg-white/5 text-gray-200 hover:bg-white/10"
                  : "border-amber-200 bg-white text-amber-900 hover:bg-amber-100"
              }`}
              aria-expanded={expanded}
            >
              {expanded ? "Hide instructions" : "Read instructions"}
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
      </div>

      {expanded && hasInstructions && (
        <div
          className={`border-t px-4 pb-4 pt-3 text-sm leading-relaxed whitespace-pre-wrap ${
            theme === "dark"
              ? "border-amber-500/20 text-amber-50/90"
              : "border-amber-200 text-amber-950"
          }`}
        >
          {instructions}
        </div>
      )}
    </div>
  );
}
