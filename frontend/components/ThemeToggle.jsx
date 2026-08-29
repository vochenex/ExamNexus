import { Moon, Sun } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import { headerActionButtonClass } from "../utils/themeButtons";

export default function ThemeToggle({ inverted = false, compact = false }) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  const iconSize = 18;

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`en-theme-toggle-btn ${headerActionButtonClass(theme, {
        compact,
        inverted,
      })}`}
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
