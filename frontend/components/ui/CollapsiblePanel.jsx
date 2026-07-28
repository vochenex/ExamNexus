import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";

export default function CollapsiblePanel({
  title,
  subtitle,
  defaultOpen = false,
  children,
  className = "",
}) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={`min-w-0 max-w-full overflow-hidden rounded-3xl border backdrop-blur-md ${
        theme === "dark"
          ? "border-white/10 bg-white/[0.04] shadow-[0_12px_40px_rgba(0,0,0,0.22)]"
          : "border-emerald-100 bg-emerald-50/30"
      } ${className}`}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`flex w-full min-w-0 items-center justify-between gap-3 px-4 py-3 text-left ${
          theme === "dark" ? "text-emerald-300" : "text-teal-800"
        }`}
      >
        <span className="min-w-0 flex-1 overflow-hidden">
          <span className="block break-words text-sm font-semibold leading-snug">{title}</span>
          {subtitle && (
            <span
              className={`mt-0.5 block break-words text-xs leading-snug ${
                theme === "dark" ? "text-gray-400" : "text-gray-600"
              }`}
            >
              {subtitle}
            </span>
          )}
        </span>
        {open ? <ChevronUp size={16} className="shrink-0" /> : <ChevronDown size={16} className="shrink-0" />}
      </button>
      {open && (
        <div className="min-w-0 space-y-3 overflow-hidden border-t border-inherit px-3 py-3 sm:px-4 sm:py-4">
          {children}
        </div>
      )}
    </div>
  );
}
