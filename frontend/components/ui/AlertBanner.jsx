import { useEffect } from "react";
import { useScrollIntoViewWhen } from "../../hooks/useScrollIntoViewWhen";
import { useTheme } from "../../layouts/ThemeContext";

export default function AlertBanner({
  variant = "error",
  children,
  className = "",
  scrollIntoView = true,
  autoDismissMs = 0,
  onDismiss,
  inline = false,
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const styles = {
    error: isDark
      ? "text-red-300 border-red-500/30 bg-red-500/10"
      : "text-red-700 border-red-300 bg-red-50",
    success: isDark
      ? "text-emerald-100 border-emerald-400/40 bg-emerald-500/15"
      : "text-emerald-900 border-emerald-400 bg-emerald-50",
    info: isDark
      ? "text-teal-200 border-emerald-500/25 bg-emerald-500/10"
      : "text-teal-800 border-emerald-200 bg-emerald-50/80",
  };

  const contentKey =
    typeof children === "string" || typeof children === "number"
      ? String(children)
      : null;
  const ref = useScrollIntoViewWhen(scrollIntoView && Boolean(children), {
    deps: contentKey == null ? [] : [contentKey],
  });

  useEffect(() => {
    if (!autoDismissMs || !children) return undefined;
    const timer = window.setTimeout(() => {
      onDismiss?.();
    }, autoDismissMs);
    return () => window.clearTimeout(timer);
  }, [autoDismissMs, children, onDismiss, contentKey]);

  return (
    <div
      ref={ref}
      role="status"
      className={`${inline ? "inline-flex w-fit max-w-full" : ""} mb-4 rounded-xl border px-5 py-4 text-base font-semibold leading-snug ${styles[variant] || styles.error} ${className}`}
    >
      {children}
    </div>
  );
}
