import { pageShellClass } from "../../utils/themeInputs";

function Bone({ theme, className = "" }) {
  return (
    <div
      className={`rounded-xl ${
        theme === "dark"
          ? "animate-pulse bg-white/10"
          : "en-skeleton-bone"
      } ${className}`}
    />
  );
}

function SkeletonFrame({ theme, className = "", children }) {
  return (
    <div className={`${pageShellClass(theme)} ${className}`}>{children}</div>
  );
}

export function PageLoadingSkeleton({ theme = "dark", variant = "cards", className = "" }) {
  if (variant === "dashboard") {
    return (
      <SkeletonFrame theme={theme} className={className}>
        <div className="mx-auto max-w-7xl space-y-6">
          <Bone theme={theme} className="h-10 w-72" />
          <Bone theme={theme} className="h-4 w-96 max-w-full" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Bone key={i} theme={theme} className="h-28 rounded-2xl" />
            ))}
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Bone theme={theme} className="h-72 rounded-2xl" />
            <Bone theme={theme} className="h-72 rounded-2xl" />
          </div>
          <Bone theme={theme} className="h-56 rounded-2xl" />
        </div>
      </SkeletonFrame>
    );
  }

  if (variant === "detail") {
    return (
      <SkeletonFrame theme={theme} className={className}>
        <div className="mx-auto max-w-7xl space-y-6">
          <Bone theme={theme} className="h-8 w-32" />
          <Bone theme={theme} className="h-12 w-80 max-w-full" />
          <div className="grid gap-5 lg:grid-cols-3">
            <Bone theme={theme} className="h-44 rounded-2xl lg:col-span-1" />
            <Bone theme={theme} className="h-44 rounded-2xl lg:col-span-1" />
            <Bone theme={theme} className="h-44 rounded-2xl lg:col-span-1" />
          </div>
          <Bone theme={theme} className="h-8 w-48" />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Bone key={i} theme={theme} className="h-24 rounded-2xl" />
            ))}
          </div>
        </div>
      </SkeletonFrame>
    );
  }

  if (variant === "list") {
    return (
      <SkeletonFrame theme={theme} className={className}>
        <div className="mx-auto max-w-7xl space-y-5">
          <Bone theme={theme} className="h-10 w-64" />
          <Bone theme={theme} className="h-4 w-80 max-w-full" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Bone key={i} theme={theme} className="h-20 rounded-2xl" />
          ))}
        </div>
      </SkeletonFrame>
    );
  }

  if (variant === "assessment") {
    return (
      <div
        className={`min-h-screen p-6 ${
          theme === "dark" ? "bg-[#031d1f] text-white" : "en-bg-page text-[#1a332c]"
        }`}
      >
        <div className="mx-auto max-w-5xl space-y-6">
          <Bone theme={theme} className="h-8 w-40" />
          <Bone theme={theme} className="h-14 w-full rounded-2xl" />
          <Bone theme={theme} className="h-64 w-full rounded-2xl" />
          <div className="flex justify-between gap-4">
            <Bone theme={theme} className="h-11 w-28 rounded-xl" />
            <Bone theme={theme} className="h-11 w-28 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === "profile") {
    return (
      <SkeletonFrame theme={theme} className={className}>
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="flex items-center gap-5">
            <Bone theme={theme} className="h-24 w-24 rounded-full" />
            <div className="flex-1 space-y-3">
              <Bone theme={theme} className="h-8 w-48" />
              <Bone theme={theme} className="h-4 w-64" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Bone key={i} theme={theme} className="h-24 rounded-2xl" />
            ))}
          </div>
          <Bone theme={theme} className="h-80 w-full rounded-2xl" />
        </div>
      </SkeletonFrame>
    );
  }

  return (
    <SkeletonFrame theme={theme} className={className}>
      <div className="mx-auto max-w-7xl space-y-6">
        <Bone theme={theme} className="h-10 w-64" />
        <Bone theme={theme} className="h-4 w-80 max-w-full" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Bone key={i} theme={theme} className="h-40 rounded-2xl" />
          ))}
        </div>
      </div>
    </SkeletonFrame>
  );
}
