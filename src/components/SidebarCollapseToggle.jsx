import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

/**
 * Expand / collapse control for the desktop sidebar.
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
      className={`flex items-center justify-center overflow-hidden rounded-xl border transition-[width,height,padding,background-color,border-color,color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        collapsed ? "h-9 w-9" : "h-9 w-full gap-2 px-3 text-xs font-semibold"
      } ${
        isDark
          ? "border-white/10 bg-white/[0.03] text-gray-300 hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-300"
          : "border-slate-200/80 en-bg-surface text-slate-600 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800"
      } ${className}`}
    >
      {collapsed ? (
        <PanelLeftOpen size={18} strokeWidth={2.1} className="shrink-0" />
      ) : (
        <>
          <PanelLeftClose size={16} strokeWidth={2.1} className="shrink-0" />
          <span className="en-sidebar-label">Collapse</span>
        </>
      )}
    </button>
  );
}
