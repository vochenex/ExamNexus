import { Moon, Sun } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`rounded-2xl p-3.5 transition-all duration-200 ${
        isDark
          ? "bg-white/10 text-emerald-400 hover:bg-white/15 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]"
          : "en-bg-elevated border border-emerald-700/20 text-teal-800 en-hover en-panel-glow"
      }`}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {isDark ? <Sun size={30} strokeWidth={2.25} /> : <Moon size={30} strokeWidth={2.25} />}
    </button>
  );
}
