import { useTheme } from "../../layouts/ThemeContext";

function Bone({ theme, className = "" }) {
  return (
    <div
      className={`rounded-xl ${
        theme === "dark" ? "animate-pulse bg-white/10" : "en-skeleton-bone"
      } ${className}`}
    />
  );
}

/**
 * Inline skeleton for list/panel cards (students, assessments, analytics, etc.).
 * Keeps the surrounding card chrome visible so empty state is not mistaken for "no data".
 */
export default function PanelContentSkeleton({
  rows = 4,
  variant = "list",
  className = "",
}) {
  const { theme } = useTheme();

  if (variant === "chart") {
    return (
      <div className={`animate-pulse space-y-4 ${className}`} aria-hidden="true">
        <Bone theme={theme} className="h-5 w-36" />
        <Bone theme={theme} className="h-4 w-52 max-w-full" />
        <Bone theme={theme} className="h-28 w-full rounded-2xl" />
        <div className="space-y-2">
          <Bone theme={theme} className="h-3 w-full" />
          <Bone theme={theme} className="h-3 w-[85%]" />
          <Bone theme={theme} className="h-3 w-[70%]" />
        </div>
      </div>
    );
  }

  if (variant === "cards") {
    return (
      <div className={`space-y-3 ${className}`} aria-hidden="true">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className={`rounded-xl border p-4 ${
              theme === "dark" ? "border-white/10 bg-white/[0.03]" : "border-emerald-100 en-bg-muted"
            }`}
          >
            <Bone theme={theme} className="mb-3 h-4 w-[70%] max-w-[12rem]" />
            <Bone theme={theme} className="h-3 w-[50%] max-w-[9rem]" />
            <Bone theme={theme} className="mt-3 h-3 w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "comments") {
    return (
      <div
        className={`space-y-3 ${className}`}
        aria-hidden="true"
        role="status"
        aria-label="Loading comments"
      >
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-start gap-2">
            <Bone theme={theme} className="mt-0.5 h-7 w-7 shrink-0 rounded-full" />
            <div
              className={`min-w-0 flex-1 space-y-2 rounded-xl px-3 py-2.5 ${
                theme === "dark" ? "bg-white/5" : "en-bg-muted"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <Bone theme={theme} className="h-3 w-24" />
                <Bone theme={theme} className="h-2.5 w-16" />
              </div>
              <Bone
                theme={theme}
                className={`h-3 max-w-full ${
                  index % 3 === 0 ? "w-[92%]" : index % 3 === 1 ? "w-[75%]" : "w-[84%]"
                }`}
              />
              {index % 2 === 0 ? (
                <Bone theme={theme} className="h-3 w-[58%] max-w-full" />
              ) : null}
              <Bone theme={theme} className="mt-1 h-2.5 w-10" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`} aria-hidden="true" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Bone theme={theme} className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Bone theme={theme} className="h-3.5 w-[70%] max-w-[14rem]" />
            <Bone theme={theme} className="h-3 w-[45%] max-w-[9rem]" />
          </div>
        </div>
      ))}
    </div>
  );
}
