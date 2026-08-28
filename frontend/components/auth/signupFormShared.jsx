export function FieldLabel({ children, theme, htmlFor }) {
  return (
    <label
      htmlFor={htmlFor}
      className={`mb-1.5 block text-sm font-medium ${
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
