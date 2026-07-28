import { ShieldAlert } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import { primaryButton } from "../utils/themeButtons";
import { MAX_INTEGRITY_STRIKES } from "../utils/examIntegrity";
import ModalPortal from "./ui/ModalPortal";

export default function AssessmentFocusGuard({
  open,
  onContinue,
  integrityStrikes = 0,
  maxStrikes = MAX_INTEGRITY_STRIKES,
}) {
  const { theme } = useTheme();
  const remaining = Math.max(0, maxStrikes - integrityStrikes);

  if (!open) return null;

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="focus-guard-title"
        className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl ${
          theme === "dark"
            ? "border-red-500/30 bg-[#0a1f1f] text-white"
            : "border-red-300/80 en-bg-elevated text-gray-900"
        }`}
      >
        <div className="mb-4 flex items-center gap-3">
          <div
            className={`rounded-xl p-2.5 ${
              theme === "dark" ? "bg-red-500/15 text-red-300" : "bg-red-100 text-red-700"
            }`}
          >
            <ShieldAlert size={22} />
          </div>
          <h2 id="focus-guard-title" className="text-lg font-bold">
            Stay on the assessment
          </h2>
        </div>

        <p className={`text-sm leading-relaxed ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>
          You switched tabs, opened another app on top of the assessment, or tried to leave
          fullscreen. This is not allowed until you submit or time runs out. The incident has
          been recorded and sent to your teacher.
        </p>

        <p
          className={`mt-3 rounded-xl border px-3 py-2 text-xs font-medium ${
            remaining <= 1
              ? theme === "dark"
                ? "border-red-500/30 bg-red-500/10 text-red-200"
                : "border-red-300 bg-red-50 text-red-800"
              : theme === "dark"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                : "border-amber-300 bg-amber-50 text-amber-900"
          }`}
        >
          Violation {integrityStrikes} of {maxStrikes}. You have{" "}
          <strong>
            {remaining} alert{remaining === 1 ? "" : "s"} left
          </strong>{" "}
          before your assessment is submitted automatically.
        </p>

        <p className={`mt-3 text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
          Close other apps and windows, stay on this tab, and return to fullscreen to continue.
        </p>

        <button
          type="button"
          onClick={onContinue}
          className={`mt-6 w-full ${primaryButton(theme, "py-3")}`}
        >
          Return to assessment
        </button>
      </div>
    </div>
    </ModalPortal>
  );
}
