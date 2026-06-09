import { useTheme } from "../layouts/ThemeContext";
import { primaryButton, secondaryButton } from "../utils/themeButtons";
import { getFormatLabel } from "../utils/questionSections";

export default function QuestionFormatPrompt({
  open,
  nextType,
  currentType,
  onConfirm,
  onCancel,
}) {
  const { theme } = useTheme();

  if (!open || !nextType) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className={`w-full max-w-md rounded-3xl p-6 shadow-2xl ${
          theme === "dark"
            ? "bg-[#031d1f] border border-white/10"
            : "en-bg-surface border border-emerald-300"
        }`}
      >
        <h2
          className={`text-xl font-bold ${
            theme === "dark" ? "text-emerald-400" : "text-teal-700"
          }`}
        >
          Add {getFormatLabel(nextType)} section?
        </h2>
        <p className={`mt-3 text-sm ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>
          Your existing {getFormatLabel(currentType).toLowerCase()} questions will stay in their
          own section. A new section will be created for{" "}
          {getFormatLabel(nextType).toLowerCase()} questions.
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className={secondaryButton(theme)}>
            No, keep current section
          </button>
          <button type="button" onClick={onConfirm} className={primaryButton(theme)}>
            Yes, add section
          </button>
        </div>
      </div>
    </div>
  );
}
