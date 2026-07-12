import { Moon, Sun } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";

export default function ThemeToggle({ inverted = false, compact = false }) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  // `inverted` = force dark-chrome styles (marketing dark header). Do not pass
  // inverted on adaptive native topbars — those turn light in light mode.
  const onDarkSurface = isDark || inverted;
  const iconSize = compact ? 20 : 30;

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`en-header-action-btn en-theme-toggle-btn flex shrink-0 items-center justify-center transition-colors duration-150 ${
        compact ? "h-10 w-10 rounded-xl" : "rounded-2xl p-3.5"
      } ${
        onDarkSurface
          ? "border border-white/15 bg-white/10 text-emerald-200 hover:bg-white/15"
          : "en-bg-elevated border border-emerald-200 text-teal-700 en-hover shadow-sm"
      }`}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {isDark ? (
        <Sun size={iconSize} strokeWidth={2.25} />
      ) : (
        <Moon size={iconSize} strokeWidth={2.25} />
      )}
    </button>
  );
}
