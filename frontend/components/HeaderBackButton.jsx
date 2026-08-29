import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../layouts/ThemeContext";

export default function HeaderBackButton({ compact = false }) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const iconSize = compact ? 18 : 18;

  return (
    <button
      type="button"
      onClick={() => navigate(-1)}
      className={`en-header-action-btn flex shrink-0 items-center justify-center transition-colors duration-150 ${
        compact ? "h-9 w-9 rounded-xl sm:h-10 sm:w-10" : "rounded-2xl p-3.5"
      } ${
        isDark
          ? "border border-white/15 bg-white/10 text-emerald-200 hover:bg-white/15"
          : "en-bg-elevated border border-emerald-200 text-teal-700 en-hover shadow-sm"
      }`}
      aria-label="Back to previous page"
      title="Back"
    >
      <ArrowLeft size={iconSize} strokeWidth={2.25} />
    </button>
  );
}
