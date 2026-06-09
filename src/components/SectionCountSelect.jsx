import { useTheme } from "../layouts/ThemeContext";
import {
  getSectionsForCount,
  MAX_SECTION_COUNT,
  MIN_SECTION_COUNT,
  normalizeSectionCount,
} from "../utils/sections";

const QUICK_COUNTS = [1, 2, 3, 4, 5, 6];

export default function SectionCountSelect({
  value,
  onChange,
  disabled = false,
  minCount = MIN_SECTION_COUNT,
  className = "",
}) {
  const { theme } = useTheme();
  const normalizedValue = normalizeSectionCount(value);
  const sections = getSectionsForCount(normalizedValue);
  const showCustom = normalizedValue > 6 || !QUICK_COUNTS.includes(normalizedValue);

  const handleCustomChange = (raw) => {
    const digits = String(raw).replace(/\D/g, "");
    if (!digits) return;
    const next = normalizeSectionCount(Number.parseInt(digits, 10));
    onChange(Math.max(minCount, next));
  };

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <p
          className={`text-sm font-medium ${
            theme === "dark" ? "text-emerald-400" : "text-teal-700"
          }`}
        >
          Class sections
        </p>
        <span className={`text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
          Up to {MAX_SECTION_COUNT} (A–{String.fromCharCode(64 + MAX_SECTION_COUNT)})
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {QUICK_COUNTS.filter((count) => count >= minCount).map((count) => {
          const active = normalizedValue === count && !showCustom;
          const preview = getSectionsForCount(count);

          return (
            <button
              key={count}
              type="button"
              disabled={disabled}
              onClick={() => onChange(count)}
              className={`
                rounded-xl px-3 py-3 text-left transition-all
                disabled:opacity-50 disabled:cursor-not-allowed
                ${
                  active
                    ? theme === "dark"
                      ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/25"
                      : "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md"
                    : theme === "dark"
                      ? "bg-white/5 border border-white/10 text-gray-200 hover:border-emerald-500/30"
                      : "en-bg-elevated border border-emerald-200 text-gray-700 hover:border-emerald-400"
                }
              `}
            >
              <span className="block text-sm font-semibold">
                {count} section{count === 1 ? "" : "s"}
              </span>
              <span className={`block text-xs mt-1 truncate ${active ? "opacity-90" : "opacity-70"}`}>
                {preview.join(", ")}
              </span>
            </button>
          );
        })}
      </div>

      <div
        className={`rounded-xl border px-3 py-3 ${
          theme === "dark"
            ? "border-white/10 bg-white/[0.03]"
            : "border-emerald-200/80 en-bg-elevated/80"
        }`}
      >
        <label
          htmlFor="custom-section-count"
          className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${
            theme === "dark" ? "text-gray-400" : "text-gray-500"
          }`}
        >
          Custom count
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="custom-section-count"
            type="text"
            inputMode="numeric"
            disabled={disabled}
            value={showCustom ? String(normalizedValue) : ""}
            placeholder={`${minCount}–${MAX_SECTION_COUNT}`}
            onChange={(event) => handleCustomChange(event.target.value)}
            className={`w-20 rounded-lg border px-3 py-2 text-sm text-center outline-none focus:ring-2 focus:ring-emerald-500/30 ${
              theme === "dark"
                ? "border-white/10 bg-black/30 text-white"
                : "border-emerald-200 en-bg-input text-gray-900"
            }`}
          />
          <span className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
            {sections.length > 0
              ? `Sections: ${sections.join(", ")}`
              : `Enter ${minCount}–${MAX_SECTION_COUNT} sections`}
          </span>
        </div>
      </div>
    </div>
  );
}
