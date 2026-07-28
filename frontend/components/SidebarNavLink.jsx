import { ProgressNavLink } from "./ProgressLink";
import { useTheme } from "../layouts/ThemeContext";
import { motion } from "../utils/motion";

function navLinkClass(theme, isActive, collapsed) {
  const base = collapsed
    ? "justify-center px-2 py-2.5"
    : "gap-3 px-3 py-2.5";

  if (isActive) {
    return `${base} ${
      theme === "dark"
        ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.12)]"
        : "bg-teal-600 text-white border border-teal-600 shadow-md shadow-teal-600/20"
    }`;
  }

  return `${base} ${
    theme === "dark"
      ? "text-gray-300 border border-transparent hover:bg-white/10 hover:text-emerald-300 hover:border-white/10"
      : "text-gray-700 border border-transparent en-hover hover:text-teal-800 hover:border-slate-200/80"
  }`;
}

function iconWrapClass(theme, isActive) {
  if (isActive) {
    return theme === "dark"
      ? "bg-emerald-500/25 text-emerald-300"
      : "bg-white/20 text-white";
  }

  return theme === "dark"
    ? "bg-white/10 text-emerald-400 group-hover:bg-emerald-500/15 group-hover:text-emerald-300"
    : "bg-slate-100 text-slate-600 group-hover:bg-teal-50 group-hover:text-teal-700";
}

export default function SidebarNavLink({
  to,
  icon: Icon,
  label,
  end = false,
  collapsed = false,
}) {
  const { theme } = useTheme();

  return (
    <ProgressNavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      aria-label={label}
      className={({ isActive }) =>
        `group relative flex items-center rounded-xl text-sm font-medium ${motion.navItem} ${navLinkClass(
          theme,
          isActive,
          collapsed
        )}`
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-[colors,transform] duration-300 ${iconWrapClass(
              theme,
              isActive
            )}`}
          >
            <Icon size={18} strokeWidth={2.1} />
          </span>
          <span
            className={`en-sidebar-label truncate ${collapsed ? "is-collapsed" : ""}`}
            aria-hidden={collapsed}
          >
            {label}
          </span>
        </>
      )}
    </ProgressNavLink>
  );
}

export function SidebarSection({ title, theme, collapsed = false, children }) {
  return (
    <div className="space-y-1">
      {title ? (
        <>
          <p
            className={`en-sidebar-section-title mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider ${
              collapsed ? "is-collapsed" : ""
            } ${theme === "dark" ? "text-gray-500" : "text-slate-500"}`}
          >
            {title}
          </p>
          <div
            className={`mx-auto overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              collapsed ? "mb-2 h-px w-8 opacity-100" : "mb-0 h-0 w-0 opacity-0"
            } ${theme === "dark" ? "bg-white/10" : "bg-slate-200"}`}
            aria-hidden="true"
          />
        </>
      ) : null}
      {children}
    </div>
  );
}
