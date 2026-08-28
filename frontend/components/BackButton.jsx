import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import { useNavigationProgress } from "../contexts/NavigationProgressContext";
import { getSafeBackPath } from "../utils/nativeBack";

export default function BackButton({ compact = false, inverted = false }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isNavigating, beginNavigation } = useNavigationProgress();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const onDarkSurface = isDark || inverted;
  const backPath = getSafeBackPath(pathname);

  if (!backPath) return null;

  const iconSize = compact ? 18 : 22;

  return (
    <button
      type="button"
      disabled={isNavigating}
      aria-busy={isNavigating || undefined}
      aria-label="Go back"
      title="Back"
      onClick={() => {
        if (!beginNavigation(backPath)) return;
        navigate(backPath);
      }}
      className={`en-header-action-btn en-back-btn flex shrink-0 items-center justify-center transition-colors duration-150 ${
        compact ? "h-9 w-9 rounded-xl sm:h-10 sm:w-10" : "rounded-2xl p-3.5"
      } ${
        onDarkSurface
          ? "border border-white/15 bg-white/10 text-emerald-200 hover:bg-white/15"
          : "en-bg-elevated border border-emerald-200 text-teal-700 en-hover shadow-sm"
      } disabled:opacity-60`}
    >
      <ArrowLeft size={iconSize} strokeWidth={2.25} />
    </button>
  );
}
