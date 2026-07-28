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
      className={`flex w-full min-w-0 items-start gap-3 rounded-xl border px-3 py-2.5 ${
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      } ${
        theme === "dark"
          ? "border-white/10 bg-white/[0.03]"
          : "border-emerald-100 bg-emerald-50/40"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 shrink-0"
      />
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
