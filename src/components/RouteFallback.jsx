export default function RouteFallback() {
  return (
    <div
      className="flex min-h-[50vh] items-center justify-center en-bg-page en-text-primary"
      role="status"
      aria-live="polite"
      aria-label="Loading page"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-200 border-t-teal-600" />
    </div>
  );
}
