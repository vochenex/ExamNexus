import { useTheme } from "../../layouts/ThemeContext";

function badgeClass(theme, alert = false) {
  if (alert) {
    return theme === "dark"
      ? "bg-red-500/20 text-red-300 ring-1 ring-red-500/35"
      : "bg-red-100 text-red-700 ring-1 ring-red-200";
  }

  return theme === "dark"
    ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25"
    : "en-bg-skeleton text-teal-800 ring-1 ring-emerald-200";
}

export function AdminStatBadge({ value, label, alert = false }) {
  const { theme } = useTheme();
  const display = value ?? 0;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${badgeClass(
        theme,
        alert && Number(display) > 0
      )}`}
    >
      <span>{display}</span>
      {label && <span className="font-semibold opacity-90">{label}</span>}
    </span>
  );
}

export function AdminVerticalBarChart({
  items = [],
  valueKey = "value",
  labelKey = "label",
  emptyMessage = "No data yet.",
  barClassName = "",
}) {
  const { theme } = useTheme();
  const maxValue = Math.max(...items.map((item) => Number(item[valueKey]) || 0), 1);

  if (!items.length) {
    return (
      <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="flex h-56 items-end gap-2 sm:gap-3">
      {items.map((item) => {
        const value = Number(item[valueKey]) || 0;
        const height = Math.max(value === 0 ? 4 : 8, (value / maxValue) * 100);

        return (
          <div
            key={item.key || item[labelKey]}
            className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2"
          >
            <span
              className={`text-[11px] font-bold tabular-nums ${
                theme === "dark" ? "text-emerald-300" : "text-teal-700"
              }`}
            >
              {value}
            </span>
            <div
              className={`flex w-full max-w-[52px] items-end justify-center ${
                theme === "dark" ? "text-emerald-400" : "text-teal-600"
              }`}
              style={{ height: "160px" }}
            >
              <div
                className={`w-full rounded-t-lg bg-gradient-to-t from-emerald-600 to-teal-400 transition-all duration-700 ${
                  value === 0 ? "opacity-30" : ""
                } ${barClassName}`}
                style={{ height: `${height}%` }}
                title={`${item[labelKey]}: ${value}`}
              />
            </div>
            <span
              className={`w-full truncate text-center text-[10px] font-medium leading-tight ${
                theme === "dark" ? "text-gray-400" : "text-gray-600"
              }`}
              title={item[labelKey]}
            >
              {item[labelKey]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
