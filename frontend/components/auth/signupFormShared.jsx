export function SectionTitle({ children, theme }) {
  return (
    <h3 className="en-signup-section-title mb-4 text-sm font-semibold uppercase tracking-wider">
      {children}
    </h3>
  );
}

export function FieldLabel({ children, theme, htmlFor }) {
  return (
    <label htmlFor={htmlFor} className="en-signup-label mb-1.5 block text-sm font-medium">
      {children}
    </label>
  );
}

export function FieldError({ message }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-400">{message}</p>;
}
