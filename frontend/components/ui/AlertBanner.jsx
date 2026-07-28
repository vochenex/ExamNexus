import { useScrollIntoViewWhen } from "../../hooks/useScrollIntoViewWhen";

export default function AlertBanner({
  variant = "error",
  children,
  className = "",
  scrollIntoView = true,
}) {
  const styles = {
    error: "text-red-500 border-red-500/30 bg-red-500/5",
    success: "text-emerald-600 border-emerald-300 en-bg-muted",
    info: "text-teal-700 border-emerald-200 en-bg-muted",
  };

  const contentKey =
    typeof children === "string" || typeof children === "number"
      ? String(children)
      : null;
  const ref = useScrollIntoViewWhen(scrollIntoView && Boolean(children), {
    deps: contentKey == null ? [] : [contentKey],
  });

  return (
    <div
      ref={ref}
      role="status"
      className={`mb-4 rounded-xl border px-4 py-3 text-sm ${styles[variant] || styles.error} ${className}`}
    >
      {children}
    </div>
  );
}
