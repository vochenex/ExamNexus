import { NavLink, useNavigate } from "react-router-dom";
import { useTheme } from "../layouts/ThemeContext";
import { motion } from "../utils/motion";

function navigateWithTransition(navigate, to) {
  if (typeof document !== "undefined" && document.startViewTransition) {
    document.startViewTransition(() => {
      navigate(to);
    });
    return;
  }
  navigate(to);
}

function navLinkClass(theme, isActive) {
  if (isActive) {
    return theme === "dark"
      ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.12)]"
      : "bg-teal-600 text-white border border-teal-600 shadow-md shadow-teal-600/20";
  }

  return theme === "dark"
    ? "text-gray-300 border border-transparent hover:bg-white/10 hover:text-emerald-300 hover:border-white/10"
    : "text-gray-700 border border-transparent en-hover hover:text-teal-800 hover:border-slate-200/80";
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

export default function SidebarNavLink({ to, icon: Icon, label, end = false }) {
  const { theme } = useTheme();

  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${motion.navItem} ${navLinkClass(
          theme,
          isActive
        )}`
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${iconWrapClass(
              theme,
              isActive
            )}`}
          >
            <Icon size={18} strokeWidth={2.1} />
          </span>
          <span className="truncate">{label}</span>
        </>
      )}
    </NavLink>
  );
}

export function SidebarSection({ title, theme, children }) {
  return (
    <div className="space-y-1">
      {title && (
        <p
          className={`mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider ${
            theme === "dark" ? "text-gray-500" : "text-slate-500"
          }`}
        >
          {title}
        </p>
      )}
      {children}
    </div>
  );
}
