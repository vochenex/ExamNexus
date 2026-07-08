import { Plus } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import { primaryButtonSm } from "../utils/themeButtons";
import { YearLevelSelect } from "./YearLevelBadge";
import SectionCountSelect from "./SectionCountSelect";
import CollapsiblePanel from "./ui/CollapsiblePanel";

export default function FacultyCreateSubjectPanel({
  name,
  onNameChange,
  yearLevel,
  onYearLevelChange,
  sectionCount,
  onSectionCountChange,
  onSubmit,
  creating,
  disabled,
  defaultOpen = false,
}) {
  const { theme } = useTheme();

  return (
    <CollapsiblePanel
      title="New subject"
      subtitle="Name, year level, and sections"
      defaultOpen={defaultOpen}
      className={
        theme === "dark"
          ? "!border-white/10 !bg-white/[0.04]"
          : "!border-emerald-200/80 !en-bg-elevated"
      }
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label
              htmlFor="faculty-subject-name"
              className={`block text-sm font-medium ${
                theme === "dark" ? "text-emerald-400" : "text-teal-700"
              }`}
            >
              Subject name
            </label>
            <input
              id="faculty-subject-name"
              className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30 ${
                theme === "dark"
                  ? "border-white/10 bg-black/30 text-white placeholder:text-gray-500"
                  : "border-emerald-300/80 en-bg-elevated text-gray-900 placeholder:text-gray-400"
              }`}
              placeholder="e.g. Programming 1"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSubmit()}
              disabled={disabled}
            />
          </div>

          <YearLevelSelect value={yearLevel} onChange={onYearLevelChange} disabled={disabled} />

          <button
            type="button"
            onClick={onSubmit}
            disabled={disabled || creating || !name.trim()}
            className={primaryButtonSm(theme, "w-full justify-center disabled:cursor-not-allowed disabled:opacity-50")}
          >
            <Plus size={16} />
            {creating ? "Creating…" : "Create subject"}
          </button>
        </div>

        <SectionCountSelect
          value={sectionCount}
          onChange={onSectionCountChange}
          disabled={disabled}
        />
      </div>
    </CollapsiblePanel>
  );
}
