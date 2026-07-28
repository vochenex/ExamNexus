export default function RouteFallback() {
  return (
    <div
      className="flex min-h-[50vh] items-center justify-center en-bg-page en-text-primary"
      role="status"
      aria-live="polite"
      aria-label="Loading page"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-200 border-t-teal-600" />
        <p className="text-sm opacity-70">Loading…</p>
      </div>
    </div>
  );
}
