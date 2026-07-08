import { Moon, Sun } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";

export default function ThemeToggle({ inverted = false, compact = false }) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  const onDarkSurface = isDark || inverted;
  const iconSize = compact ? 18 : 30;

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`flex shrink-0 items-center justify-center rounded-xl transition-colors duration-150 ${
        compact ? "h-10 w-10" : "rounded-2xl p-3.5"
      } ${
        onDarkSurface
          ? "border border-white/15 bg-white/10 text-emerald-200 hover:bg-white/15"
          : "en-bg-elevated border border-emerald-700/20 text-teal-800 en-hover"
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
