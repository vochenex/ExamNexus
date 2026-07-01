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
      className={`rounded-xl border ${
        theme === "dark"
          ? "border-white/10 bg-white/[0.03]"
          : "border-emerald-100 bg-emerald-50/30"
      } ${className}`}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left ${
          theme === "dark" ? "text-emerald-300" : "text-teal-800"
        }`}
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{title}</span>
          {subtitle && (
            <span
              className={`mt-0.5 block text-xs ${
                theme === "dark" ? "text-gray-400" : "text-gray-600"
              }`}
            >
              {subtitle}
            </span>
          )}
        </span>
        {open ? <ChevronUp size={16} className="shrink-0" /> : <ChevronDown size={16} className="shrink-0" />}
      </button>
      {open && <div className="space-y-3 border-t border-inherit px-4 py-4">{children}</div>}
    </div>
  );
}
