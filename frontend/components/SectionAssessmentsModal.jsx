import { useMemo, useState } from "react";
import { ClipboardList, X } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import ModalPortal from "./ui/ModalPortal";
import PanelContentSkeleton from "./ui/PanelContentSkeleton";
import SectionTabs from "./SectionTabs";
import { getAssessmentStatus } from "../utils/assessmentStatus";
import {
  formatTargetSectionsLabel,
  getSubjectSections,
  isVisibleToSection,
} from "../utils/sections";

export default function SectionAssessmentsModal({
  open,
  onClose,
  subject,
  assessments = [],
  loading = false,
  onSelectAssessment,
}) {
  const { theme } = useTheme();
  const subjectSections = getSubjectSections(subject);
  const [activeSection, setActiveSection] = useState("All");

  const sectionCounts = useMemo(() => {
    const counts = { all: assessments.length };
    for (const section of subjectSections) {
      counts[section] = assessments.filter((assessment) =>
        isVisibleToSection(assessment.target_sections, section, subjectSections)
      ).length;
    }
    return counts;
  }, [assessments, subjectSections]);

  const visibleAssessments = useMemo(() => {
    if (activeSection === "All") return assessments;
    return assessments.filter((assessment) =>
      isVisibleToSection(assessment.target_sections, activeSection, subjectSections)
    );
  }, [activeSection, assessments, subjectSections]);

  if (!open) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[160] flex items-end justify-center p-3 sm:items-center sm:p-4" role="presentation">
        <button
          type="button"
          aria-label="Close section assessments"
          className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
          onClick={onClose}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="section-assessments-title"
          className={`relative z-10 flex max-h-[min(90dvh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-3xl border shadow-2xl ${
            theme === "dark"
              ? "border-white/10 bg-[#071316]/95 backdrop-blur-xl"
              : "border-emerald-200/80 bg-white/95 backdrop-blur-xl"
          }`}
        >
          <div
            className={`flex items-start justify-between gap-3 border-b px-4 py-4 sm:px-5 ${
              theme === "dark" ? "border-white/10" : "border-emerald-100"
            }`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <ClipboardList size={18} className="text-emerald-400" />
                <h2
                  id="section-assessments-title"
                  className={`text-lg font-bold ${theme === "dark" ? "text-white" : "text-slate-900"}`}
                >
                  Section assessments
                </h2>
              </div>
              <p className={`mt-1 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                See what was posted for each section in {subject?.name || "this subject"}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className={`rounded-lg p-2 transition ${
                theme === "dark"
                  ? "text-gray-400 hover:bg-white/10 hover:text-white"
                  : "text-gray-500 hover:bg-emerald-50 hover:text-teal-800"
              }`}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            {loading ? (
              <PanelContentSkeleton rows={5} variant="list" />
            ) : (
              <>
                <SectionTabs
                  active={activeSection}
                  onChange={setActiveSection}
                  counts={sectionCounts}
                  sections={subjectSections}
                />

                <div className="mt-4 space-y-2">
                  {visibleAssessments.length === 0 ? (
                    <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                      {activeSection === "All"
                        ? "No assessments yet."
                        : `No assessments posted for Section ${activeSection}.`}
                    </p>
                  ) : (
                    visibleAssessments.map((assessment) => {
                      const status = getAssessmentStatus(assessment);
                      return (
                        <button
                          key={assessment.id}
                          type="button"
                          onClick={() => onSelectAssessment?.(assessment)}
                          className={`mb-0 w-full rounded-xl border p-4 text-left transition last:mb-0 hover:-translate-y-0.5 ${
                            theme === "dark"
                              ? "border-white/10 bg-white/[0.03] hover:border-emerald-500/30 hover:bg-emerald-500/5"
                              : "border-emerald-100 bg-emerald-50/40 hover:border-teal-300"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p
                                className={`truncate text-sm font-semibold ${
                                  theme === "dark" ? "text-emerald-300" : "text-teal-800"
                                }`}
                              >
                                {assessment.title}
                              </p>
                              <p className={`mt-1 text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-600"}`}>
                                {formatTargetSectionsLabel(
                                  assessment.target_sections,
                                  subjectSections
                                )}
                              </p>
                            </div>
                            <span
                              className={`shrink-0 text-[11px] font-bold ${
                                status === "active"
                                  ? "text-emerald-400"
                                  : status === "scheduled"
                                    ? "text-amber-500"
                                    : "text-red-400"
                              }`}
                            >
                              {status === "active"
                                ? "Active"
                                : status === "scheduled"
                                  ? "Scheduled"
                                  : "Closed"}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
