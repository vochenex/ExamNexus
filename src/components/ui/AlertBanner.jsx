export default function AlertBanner({ variant = "error", children, className = "" }) {
  const styles = {
    error: "text-red-500 border-red-500/30 bg-red-500/5",
    success: "text-emerald-600 border-emerald-300 en-bg-muted",
    info: "text-teal-700 border-emerald-200 en-bg-muted",
  };

  return (
    <div
      className={`mb-4 rounded-xl border px-4 py-3 text-sm ${styles[variant] || styles.error} ${className}`}
    >
      {children}
    </div>
  );
}
