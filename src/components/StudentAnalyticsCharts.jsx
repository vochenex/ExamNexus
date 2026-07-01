import { useTheme } from "../layouts/ThemeContext";

function panelClass(theme) {
  return `rounded-2xl border p-5 ${
    theme === "dark"
      ? "border-white/10 bg-white/[0.03]"
      : "border-emerald-200/80 en-bg-elevated shadow-sm"
  }`;
}

export function StatCard({ label, value, subtext, icon: Icon, accent = "emerald" }) {
  const { theme } = useTheme();
  const accents = {
    emerald: theme === "dark" ? "text-emerald-400" : "text-teal-700",
    cyan: theme === "dark" ? "text-cyan-400" : "text-cyan-700",
    amber: theme === "dark" ? "text-amber-400" : "text-amber-700",
    violet: theme === "dark" ? "text-violet-400" : "text-violet-700",
  };

  return (
    <div className={panelClass(theme)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide ${accents[accent]}`}>
            {label}
          </p>
          <p className={`mt-2 text-3xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
            {value}
          </p>
          {subtext && (
            <p className={`mt-1 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
              {subtext}
            </p>
          )}
        </div>
        {Icon && (
          <div
            className={`rounded-xl p-2.5 ${
              theme === "dark" ? "bg-emerald-500/10" : "en-bg-muted"
            }`}
          >
            <Icon size={20} className={accents[accent]} />
          </div>
        )}
      </div>
    </div>
  );
}

export function HorizontalBarChart({ items, valueKey = "value", labelKey = "label", maxValue = 100 }) {
  const { theme } = useTheme();

  if (!items?.length) {
    return (
      <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
        No data yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const value = Number(item[valueKey]) || 0;
        const width = Math.max(4, Math.min(100, (value / maxValue) * 100));

        return (
          <div key={item.key || item[labelKey]}>
            <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
              <span className={`font-medium truncate ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}>
                {item[labelKey]}
              </span>
              <span className={`shrink-0 font-semibold ${theme === "dark" ? "text-emerald-400" : "text-teal-700"}`}>
                {value}%
              </span>
            </div>
            <div
              className={`h-2.5 overflow-hidden rounded-full ${
                theme === "dark" ? "bg-white/10" : "en-skeleton-bone"
              }`}
            >
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  value >= 85
                    ? "bg-gradient-to-r from-emerald-400 to-teal-500"
                    : value >= 70
                      ? "bg-gradient-to-r from-cyan-400 to-emerald-400"
                      : "bg-gradient-to-r from-amber-400 to-orange-400"
                }`}
                style={{ width: `${width}%` }}
              />
            </div>
            {item.meta && (
              <p className={`mt-1 text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
                {item.meta}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function DonutChart({ segments, centerLabel, centerValue }) {
  const { theme } = useTheme();
  const total = segments.reduce((sum, seg) => sum + (seg.value || 0), 0) || 1;
  let offset = 0;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={theme === "dark" ? "rgba(255,255,255,0.08)" : "#d1fae5"}
            strokeWidth="12"
          />
          {segments.map((segment) => {
            const length = (segment.value / total) * circumference;
            const dasharray = `${length} ${circumference - length}`;
            const circle = (
              <circle
                key={segment.key}
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth="12"
                strokeDasharray={dasharray}
                strokeDashoffset={-offset}
                strokeLinecap="round"
              />
            );
            offset += length;
            return circle;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className={`text-xs uppercase tracking-wide ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
            {centerLabel}
          </span>
          <span className={`text-xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
            {centerValue}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {segments.map((segment) => (
          <div key={segment.key} className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: segment.color }}
            />
            <span className={theme === "dark" ? "text-gray-300" : "text-gray-700"}>
              {segment.label}
            </span>
            <span className={`ml-auto font-semibold ${theme === "dark" ? "text-gray-200" : "text-gray-900"}`}>
              {segment.display ?? segment.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ScoreTrendChart({ points }) {
  const { theme } = useTheme();

  if (!points?.length) {
    return (
      <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
        Complete assessments to see your score trend.
      </p>
    );
  }

  const width = 320;
  const height = 140;
  const padding = 16;
  const maxY = 100;
  const minY = Math.max(
    0,
    Math.min(...points.map((point) => point.pct)) - 10
  );
  const xStep = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;

  const coords = points.map((point, index) => {
    const x = padding + index * xStep;
    const normalized = (point.pct - minY) / (maxY - minY || 1);
    const y = height - padding - normalized * (height - padding * 2);
    return { x, y, ...point };
  });

  const linePath = coords
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${height - padding} L ${coords[0].x} ${height - padding} Z`;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[280px] w-full h-36">
        {[0, 25, 50, 75, 100].map((tick) => {
          const y =
            height -
            padding -
            ((tick - minY) / (maxY - minY || 1)) * (height - padding * 2);
          return (
            <g key={tick}>
              <line
                x1={padding}
                x2={width - padding}
                y1={y}
                y2={y}
                stroke={theme === "dark" ? "rgba(255,255,255,0.06)" : "#ecfdf5"}
              />
              <text
                x={4}
                y={y + 4}
                fill={theme === "dark" ? "#6b7280" : "#94a3b8"}
                fontSize="8"
              >
                {tick}
              </text>
            </g>
          );
        })}
        <path
          d={areaPath}
          fill={theme === "dark" ? "rgba(16,185,129,0.15)" : "rgba(16,185,129,0.12)"}
        />
        <path
          d={linePath}
          fill="none"
          stroke={theme === "dark" ? "#34d399" : "#0d9488"}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coords.map((point) => (
          <g key={point.id || point.title}>
            <circle
              cx={point.x}
              cy={point.y}
              r="4"
              fill={theme === "dark" ? "#10b981" : "#14b8a6"}
              stroke={theme === "dark" ? "#031d1f" : "#ffffff"}
              strokeWidth="2"
            />
          </g>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-2">
        {points.slice(-4).map((point) => (
          <span
            key={point.id || point.title}
            className={`rounded-full px-2 py-1 text-xs ${
              theme === "dark"
                ? "bg-white/5 text-gray-400"
                : "bg-emerald-50 text-gray-600"
            }`}
          >
            {point.title}: {point.pct}%
          </span>
        ))}
      </div>
    </div>
  );
}

export function AnalyticsPanel({ title, subtitle, children, className = "" }) {
  const { theme } = useTheme();

  return (
    <div className={`${panelClass(theme)} ${className}`}>
      <div className="mb-4">
        <h3 className={`font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
          {title}
        </h3>
        {subtitle && (
          <p className={`mt-1 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}
