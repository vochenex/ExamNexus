import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Floating edge control to expand / collapse the desktop sidebar.
 */
export default function SidebarCollapseToggle({
  collapsed,
  onToggle,
  theme,
  className = "",
}) {
  const isDark = theme === "dark";
  const label = collapsed ? "Expand sidebar" : "Collapse sidebar";

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-expanded={!collapsed}
      title={label}
      className={`pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border shadow-lg transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-105 active:scale-95 sm:h-10 sm:w-10 ${
        isDark
          ? "border-emerald-500/30 bg-[#0b1114] text-emerald-300 hover:border-emerald-400/50 hover:bg-emerald-500/10"
          : "border-teal-200 bg-white text-teal-700 hover:border-teal-400 hover:bg-teal-50"
      } ${className}`}
    >
      {collapsed ? (
        <ChevronRight size={18} strokeWidth={2.4} className="shrink-0" />
      ) : (
        <ChevronLeft size={18} strokeWidth={2.4} className="shrink-0" />
      )}
    </button>
  );
}
