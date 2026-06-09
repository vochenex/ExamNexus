import { useTheme } from "../../layouts/ThemeContext";

export default function ChipToggle({ active, onClick, children, className = "" }) {
  const { theme } = useTheme();

  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
        active
          ? theme === "dark"
            ? "bg-emerald-500 text-black shadow-[0_0_16px_rgba(16,185,129,0.25)]"
            : "bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
          : theme === "dark"
            ? "bg-white/10 text-gray-300 hover:bg-white/15"
            : "en-bg-elevated border border-emerald-200 text-gray-700 en-hover"
      } ${className}`}
    >
      {children}
    </button>
  );
}
