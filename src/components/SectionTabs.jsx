import { useTheme } from "../layouts/ThemeContext";
import { SUBJECT_SECTIONS } from "../utils/sections";

export default function SectionTabs({
  active,
  onChange,
  counts = {},
  sections = SUBJECT_SECTIONS,
}) {
  const { theme } = useTheme();
  const tabs = ["All", ...sections];

  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const isActive = active === tab;
        const count = tab === "All" ? counts.all : counts[tab] || 0;

        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            className={`
              px-4 py-2 rounded-xl text-sm font-semibold transition-all
              ${
                isActive
                  ? theme === "dark"
                    ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/25"
                    : "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md"
                  : theme === "dark"
                    ? "bg-white/5 border border-white/10 text-gray-300 hover:border-emerald-500/30"
                    : "en-bg-elevated border border-emerald-200 text-gray-700 hover:border-emerald-400"
              }
            `}
          >
            {tab === "All" ? "All Sections" : `Section ${tab}`}
            <span className="ml-2 opacity-80">({count})</span>
          </button>
        );
      })}
    </div>
  );
}
