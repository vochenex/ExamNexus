export function SectionTitle({ children, theme }) {
  const isDark = theme === "dark";
  return (
    <h3
      className={`en-signup-section-title mb-3 text-sm font-semibold uppercase tracking-wider ${
        isDark ? "text-emerald-400/85" : "text-emerald-700"
      }`}
    >
      {children}
    </h3>
  );
}

export function FieldLabel({ children, theme, htmlFor }) {
  return (
    <label
      htmlFor={htmlFor}
      className={`mb-2 block text-sm font-medium ${
        theme === "dark" ? "text-gray-300" : "text-gray-700"
      }`}
    >
      {children}
    </label>
  );
}

export function FieldError({ message }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-500">{message}</p>;
}
