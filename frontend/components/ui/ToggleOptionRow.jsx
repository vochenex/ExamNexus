import { useEffect, useRef, useState } from "react";

/**
 * Checkbox row with label + hint text that wraps cleanly in narrow panels.
 * Checkmark uses an exaggerated pop when the user toggles it on.
 */
export default function ToggleOptionRow({
  theme,
  label,
  hint,
  checked,
  onChange,
  disabled = false,
}) {
  const [popOn, setPopOn] = useState(false);
  const prevChecked = useRef(checked);

  useEffect(() => {
    if (checked && !prevChecked.current) {
      setPopOn(false);
      // Force a reflow so the animation restarts on every check.
      requestAnimationFrame(() => setPopOn(true));
    } else if (!checked) {
      setPopOn(false);
    }
    prevChecked.current = checked;
  }, [checked]);

  return (
    <label
      className={`en-toggle-row group flex w-full min-w-0 items-start gap-3 rounded-xl border px-3 py-2.5 transition-[border-color,background-color,transform] duration-200 ease-out ${
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer active:scale-[0.99]"
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
          className={`en-toggle-box flex h-5 w-5 items-center justify-center rounded-md border-2 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-400/50 ${
            popOn ? "is-checked" : ""
          } ${
            checked
              ? "border-emerald-500 bg-emerald-500 text-white"
              : theme === "dark"
                ? "scale-95 border-white/30 bg-transparent transition-[transform,border-color,background-color] duration-150"
                : "scale-95 border-teal-300/80 bg-white transition-[transform,border-color,background-color] duration-150"
          }`}
        >
          <svg
            viewBox="0 0 16 16"
            className={`en-toggle-mark h-3.5 w-3.5 ${
              popOn ? "is-checked" : checked ? "opacity-100" : "opacity-0"
            }`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
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
