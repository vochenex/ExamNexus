import { ShieldAlert } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import { primaryButton } from "../utils/themeButtons";

export default function AssessmentFocusGuard({ open, onContinue }) {
  const { theme } = useTheme();

  if (!open) return null;

  return (
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
  );
}
