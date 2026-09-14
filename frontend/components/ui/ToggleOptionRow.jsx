/**
 * Checkbox row with label + hint text that wraps cleanly in narrow panels.
 */
export default function ToggleOptionRow({
  theme,
  label,
  hint,
  checked,
  onChange,
  disabled = false,
}) {
  return (
    <label
      className={`en-toggle-row group flex w-full min-w-0 items-start gap-3 rounded-xl border px-3 py-2.5 transition-[border-color,background-color,transform] duration-200 ease-out ${
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      } ${
        checked
          ? theme === "dark"
            ? "border-emerald-400/45 bg-emerald-500/10"
            : "border-teal-300 bg-teal-50/80"
          : theme === "dark"
            ? "border-white/10 bg-white/[0.03] hover:border-white/20"
            : "border-emerald-100 bg-emerald-50/40 hover:border-teal-200"
      }`}
    >
      <span className="relative mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="en-toggle-checkbox peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
        <span
          aria-hidden="true"
          className={`en-toggle-box flex h-5 w-5 items-center justify-center rounded-md border-2 transition-all duration-200 ease-out peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-400/50 ${
            checked
              ? "scale-100 border-emerald-500 bg-emerald-500 text-white shadow-sm"
              : theme === "dark"
                ? "scale-95 border-white/30 bg-transparent"
                : "scale-95 border-teal-300/80 bg-white"
          }`}
        >
          <svg
            viewBox="0 0 16 16"
            className={`h-3 w-3 transition-all duration-200 ease-out ${
              checked ? "scale-100 opacity-100" : "scale-50 opacity-0"
            }`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3.5 8.2 6.4 11l6.1-6.5" />
          </svg>
        </span>
      </span>
      <span className="min-w-0 flex-1 overflow-hidden">
        <span className="block break-words text-sm font-medium leading-snug">{label}</span>
        {hint ? (
          <span
            className={`mt-0.5 block break-words text-xs leading-snug ${
              theme === "dark" ? "text-gray-400" : "text-gray-600"
            }`}
          >
            {hint}
          </span>
        ) : null}
      </span>
    </label>
  );
}
