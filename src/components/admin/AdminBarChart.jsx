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
    // Mobile browsers often require a short fullscreen gesture before lock works.
    const root = document.documentElement;
    if (root.requestFullscreen) {
      await root.requestFullscreen().catch(() => {});
    } else if (root.webkitRequestFullscreen) {
      root.webkitRequestFullscreen();
    }
    if (screen?.orientation?.lock) {
      await screen.orientation.lock("landscape");
    }
  } catch {
    /* unsupported on some browsers / devices — modal still works in current orientation */
  }
}

async function unlockOrientation() {
  try {
    if (isNativeApp()) {
      const { ScreenOrientation } = await import("@capacitor/screen-orientation");
      await ScreenOrientation.unlock();
      return;
    }
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      if (document.exitFullscreen) {
        await document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
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

function ChartBars({ items, valueKey, labelKey, theme, barClassName, compact }) {
  const maxValue = Math.max(...items.map((item) => Number(item[valueKey]) || 0), 1);
  const colWidth = compact ? undefined : 72;
  const trackHeight = compact ? "88px" : "min(48vh, 220px)";
  const minTrackWidth = compact
    ? undefined
    : Math.max(items.length * colWidth, Math.min(items.length, 1) * 120);

  return (
    <div
      className={`en-chart-scroll flex items-end gap-1.5 ${
        compact
          ? "h-28 w-full max-w-full justify-between overflow-hidden"
          : "h-[min(56vh,260px)] gap-2"
      }`}
      style={
        minTrackWidth
          ? { minWidth: `${minTrackWidth}px`, width: "max-content" }
          : undefined
      }
    >
      {items.map((item) => {
        const value = Number(item[valueKey]) || 0;
        const height = Math.max(value === 0 ? 4 : 8, (value / maxValue) * 100);
        const label = String(item[labelKey] ?? "");

        return (
          <div
            key={item.key || item[labelKey]}
            className={`flex flex-col items-center justify-end gap-1 ${
              compact ? "min-w-0 w-8 flex-1" : "w-[4.5rem] shrink-0"
            }`}
            style={!compact ? { width: colWidth } : undefined}
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
                className={`pointer-events-none w-full max-w-[2.75rem] rounded-t-lg bg-gradient-to-t from-emerald-600 to-teal-400 ${
                  value === 0 ? "opacity-30" : ""
                } ${barClassName}`}
                style={{ height: `${height}%` }}
                title={`${label}: ${value}`}
              />
            </div>
            <span
              className={`w-full text-center text-[9px] font-medium leading-tight ${
                compact ? "truncate" : "break-words"
              } ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
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
              className={`relative z-10 flex max-h-[96dvh] w-full max-w-[min(96vw,56rem)] flex-col overflow-hidden rounded-2xl border shadow-2xl sm:rounded-3xl ${
                theme === "dark"
                  ? "border-emerald-500/25 bg-[#071412]/95 backdrop-blur-md"
                  : "border-emerald-200 bg-white/95 backdrop-blur-md"
              }`}
            >
              <div
                className={`flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2.5 ${
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
              {/* Scroll works when dragging on bars or empty padding around them */}
              <div className="en-chart-scroll-area en-chart-expanded en-inner-scroll min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-x-contain p-3 sm:p-5">
                <div className="inline-block min-w-full py-1">
                  <ChartBars
                    items={items}
                    valueKey={valueKey}
                    labelKey={labelKey}
                    theme={theme}
                    barClassName={barClassName}
                    compact={false}
                  />
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
