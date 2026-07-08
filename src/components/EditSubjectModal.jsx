import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import { primaryButton, secondaryButton } from "../utils/themeButtons";
import { YearLevelSelect } from "./YearLevelBadge";
import SectionCountSelect from "./SectionCountSelect";
import { updateSubject } from "../utils/supabaseData";
import { useModalDismiss } from "../hooks/useModalDismiss";
import {
  DEFAULT_SECTION_COUNT,
  getMaxEnrolledSectionIndex,
  indexToSectionLetter,
  normalizeSectionCount,
} from "../utils/sections";
import { DEFAULT_YEAR_LEVEL, normalizeYearLevel } from "../utils/yearLevels";
import ModalPortal from "./ui/ModalPortal";

export default function EditSubjectModal({
  subject,
  classmates = [],
  open,
  onClose,
  onSaved,
}) {
  const { theme } = useTheme();
  const [name, setName] = useState("");
  const [yearLevel, setYearLevel] = useState(DEFAULT_YEAR_LEVEL);
  const [sectionCount, setSectionCount] = useState(DEFAULT_SECTION_COUNT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const minSectionCount = getMaxEnrolledSectionIndex(classmates);

  useModalDismiss(onClose, { enabled: open });

  useEffect(() => {
    if (!open || !subject) return;

    setName(subject.name || "");
    setYearLevel(normalizeYearLevel(subject.year_level));
    setSectionCount(normalizeSectionCount(subject.section_count));
    setError("");
  }, [open, subject]);

  if (!open || !subject) return null;

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Subject name is required.");
      return;
    }

    const nextSectionCount = normalizeSectionCount(sectionCount);
    if (nextSectionCount < minSectionCount) {
      setError(
        `You already have students in Section ${indexToSectionLetter(minSectionCount)}. Use at least ${minSectionCount} section${minSectionCount === 1 ? "" : "s"}.`
      );
      return;
    }

    try {
      setSaving(true);
      setError("");

      const updated = await updateSubject(subject.id, {
        name: trimmedName,
        year_level: normalizeYearLevel(yearLevel),
        section_count: nextSectionCount,
      });

      onSaved?.(updated);
      onClose?.();
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to update subject.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="presentation">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
        className={`relative z-10 w-full max-w-lg rounded-3xl p-6 shadow-2xl ${
          theme === "dark"
            ? "bg-[#031d1f] border border-white/10"
            : "en-bg-surface border border-emerald-300"
        }`}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2
              className={`text-2xl font-bold ${
                theme === "dark" ? "text-emerald-400" : "text-teal-700"
              }`}
            >
              Edit Subject
            </h2>
            <p className={`mt-1 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
              Update the subject name, year level, and class sections.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-lg ${
              theme === "dark"
                ? "text-gray-400 hover:bg-white/10"
                : "text-gray-600 en-hover"
            }`}
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label
              className={`block text-sm font-medium mb-2 ${
                theme === "dark" ? "text-emerald-400" : "text-teal-700"
              }`}
            >
              Subject name
            </label>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              className={`w-full p-3 rounded-xl border outline-none focus:ring-2 focus:ring-emerald-500/40 ${
                theme === "dark"
                  ? "bg-black/30 border-white/10 text-white"
                  : "en-bg-elevated border-emerald-200 text-gray-900"
              }`}
            />
          </div>

          <div>
            <label
              className={`block text-sm font-medium mb-2 ${
                theme === "dark" ? "text-emerald-400" : "text-teal-700"
              }`}
            >
              Year level
            </label>
            <YearLevelSelect value={yearLevel} onChange={setYearLevel} />
          </div>

          <SectionCountSelect
            value={sectionCount}
            onChange={(count) => {
              setSectionCount(count);
              setError("");
            }}
            minCount={minSectionCount}
          />

          {minSectionCount > 1 && (
            <p className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
              Section count cannot go below {minSectionCount} because students are already enrolled
              in higher sections.
            </p>
          )}

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button type="button" onClick={onClose} className={secondaryButton(theme)}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={primaryButton(theme, "disabled:opacity-50")}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}

