import { useEffect, useState } from "react";
import { Expand, X } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import ModalPortal from "../ui/ModalPortal";
import { isNativeApp } from "../../utils/platform";

async function lockLandscape() {
  try {
    if (isNativeApp()) {
      const { ScreenOrientation } = await import("@capacitor/screen-orientation");
      await ScreenOrientation.lock({ orientation: "landscape" });
      return;
    }
    if (screen?.orientation?.lock) {
      await screen.orientation.lock("landscape");
    }
  } catch {
    /* unsupported on some browsers / devices */
  }
}

async function unlockOrientation() {
  try {
    if (isNativeApp()) {
      const { ScreenOrientation } = await import("@capacitor/screen-orientation");
      await ScreenOrientation.unlock();
      return;
    }
    if (screen?.orientation?.unlock) {
      screen.orientation.unlock();
    }
  } catch {
    /* ignore */
  }
}

function badgeClass(theme, alert = false) {
  if (alert) {
    return theme === "dark"
      ? "bg-red-500/20 text-red-300 ring-1 ring-red-500/35"
      : "bg-red-100 text-red-700 ring-1 ring-red-200";
  }

  return theme === "dark"
    ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25"
    : "en-bg-skeleton text-slate-700 ring-1 ring-slate-200/80";
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

function ChartBars({ items, valueKey, labelKey, theme, barClassName, compact, centered }) {
  const maxValue = Math.max(...items.map((item) => Number(item[valueKey]) || 0), 1);
  const barWidth = compact ? "w-8" : centered ? "w-14" : "w-12";
  const trackHeight = compact ? "96px" : centered ? "min(42vh, 220px)" : "160px";
  const minTrackWidth = compact
    ? undefined
    : Math.max(items.length * (centered ? 56 : 48), centered ? 280 : 200);

  return (
    <div
      className={`en-chart-scroll flex max-w-full items-end gap-1.5 ${
        compact
          ? "h-32 w-full justify-between overflow-hidden"
          : centered
            ? "mx-auto h-[min(50vh,240px)] w-full max-w-5xl justify-center gap-2"
            : "h-56 gap-2"
      }`}
      style={minTrackWidth && !compact ? { minWidth: `${minTrackWidth}px` } : undefined}
    >
      {items.map((item) => {
        const value = Number(item[valueKey]) || 0;
        const height = Math.max(value === 0 ? 4 : 8, (value / maxValue) * 100);
        const label = String(item[labelKey] ?? "");

        return (
          <div
            key={item.key || item[labelKey]}
            className={`flex ${barWidth} ${
              compact ? "min-w-0 flex-1" : "shrink-0"
            } flex-col items-center justify-end gap-1`}
          >
            <span
              className={`text-[10px] font-bold tabular-nums ${
                theme === "dark" ? "text-emerald-300" : "text-teal-700"
              }`}
            >
              {value}
            </span>
            <div
              className="flex w-full items-end justify-center"
              style={{ height: trackHeight }}
            >
              <div
                className={`w-full max-w-[2.5rem] rounded-t-lg bg-gradient-to-t from-emerald-600 to-teal-400 ${
                  value === 0 ? "opacity-30" : ""
                } ${barClassName}`}
                style={{ height: `${height}%` }}
                title={`${label}: ${value}`}
              />
            </div>
            <span
              className={`w-full truncate text-center text-[9px] font-medium leading-tight ${
                theme === "dark" ? "text-gray-400" : "text-gray-600"
              }`}
              title={label}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function AdminVerticalBarChart({
  items = [],
  valueKey = "value",
  labelKey = "label",
  emptyMessage = "No data yet.",
  barClassName = "",
  title = "Chart",
}) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return undefined;
    lockLandscape();
    return () => {
      unlockOrientation();
    };
  }, [expanded]);

  if (!items.length) {
    return (
      <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
        {emptyMessage}
      </p>
    );
  }

  const previewItems = items.slice(0, 5);

  const closeExpanded = () => {
    setExpanded(false);
  };

  return (
    <div className="en-chart-shell relative w-full max-w-full min-w-0 overflow-hidden">
      <ChartBars
        items={previewItems}
        valueKey={valueKey}
        labelKey={labelKey}
        theme={theme}
        barClassName={barClassName}
        compact
      />
      {items.length > 5 && (
        <p className={`mt-1 text-[10px] ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
          Showing {previewItems.length} of {items.length}
        </p>
      )}
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className={`mt-2 inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
          theme === "dark"
            ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30"
            : "bg-teal-50 text-teal-800 ring-1 ring-teal-200"
        }`}
      >
        <Expand size={12} />
        Expand chart
      </button>

      {expanded && (
        <ModalPortal>
          <div className="en-chart-landscape-modal fixed inset-0 z-[140] flex items-center justify-center bg-black/85 p-2 backdrop-blur-sm sm:p-4">
            <button
              type="button"
              className="absolute inset-0"
              aria-label="Close"
              onClick={closeExpanded}
            />
            <div
              className={`relative z-10 flex w-full max-w-[min(96vw,56rem)] flex-col overflow-hidden rounded-3xl border shadow-2xl ${
                theme === "dark"
                  ? "border-emerald-500/25 bg-[#071412]/95 backdrop-blur-md"
                  : "border-emerald-200 bg-white/95 backdrop-blur-md"
              }`}
            >
              <div
                className={`flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3 ${
                  theme === "dark" ? "border-white/10" : "border-emerald-100"
                }`}
              >
                <h3
                  className={`text-sm font-bold ${
                    theme === "dark" ? "text-emerald-300" : "text-teal-800"
                  }`}
                >
                  {title}
                </h3>
                <button
                  type="button"
                  onClick={closeExpanded}
                  className={`rounded-lg p-1.5 ${
                    theme === "dark"
                      ? "text-gray-300 hover:bg-white/10"
                      : "text-gray-600 hover:bg-emerald-50"
                  }`}
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex items-center justify-center overflow-x-auto p-4 sm:p-6">
                <ChartBars
                  items={items}
                  valueKey={valueKey}
                  labelKey={labelKey}
                  theme={theme}
                  barClassName={barClassName}
                  compact={false}
                  centered
                />
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
