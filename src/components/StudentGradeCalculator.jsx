import { useEffect, useMemo, useState } from "react";
import { BookOpen, CalendarX, ClipboardList, GraduationCap } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import { AnalyticsPanel } from "./StudentAnalyticsCharts";
import Select from "./ui/Select";
import {
  computeAttendanceScore,
  computeFinalGrade,
  estimateGradeFromPercentage,
  getDefaultWeights,
} from "../utils/gradeComputation";
import {
  getSubjectGradeSettings,
  updateSubjectGradeSettings,
} from "../utils/studentGradeStorage";

function ScoreRing({ pct, label, theme, colorClass }) {
  const display = pct != null ? `${pct}%` : "—";

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`flex h-24 w-24 flex-col items-center justify-center rounded-full border-4 ${
          theme === "dark" ? "border-white/10 bg-white/[0.03]" : "border-emerald-100 en-bg-muted"
        }`}
      >
        <span className={`text-xl font-black ${colorClass}`}>{display}</span>
        <span className={`text-[10px] uppercase tracking-wide ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
          {label}
        </span>
      </div>
    </div>
  );
}

export default function StudentGradeCalculator({ studentId, subjectGrades = [] }) {
  const { theme } = useTheme();
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [settingsVersion, setSettingsVersion] = useState(0);

  useEffect(() => {
    if (!selectedSubjectId && subjectGrades.length > 0) {
      setSelectedSubjectId(subjectGrades[0].subjectId);
    }
  }, [subjectGrades, selectedSubjectId]);

  const selectedSubject = useMemo(
    () => subjectGrades.find((entry) => entry.subjectId === selectedSubjectId) || null,
    [subjectGrades, selectedSubjectId]
  );

  const settings = useMemo(() => {
    if (!studentId || !selectedSubject) return null;
    return getSubjectGradeSettings(
      studentId,
      selectedSubject.subjectId,
      selectedSubject.subjectType
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, selectedSubject, settingsVersion]);

  const defaults = selectedSubject
    ? getDefaultWeights(selectedSubject.subjectType)
    : getDefaultWeights("major");

  const attendancePct =
    settings != null
      ? computeAttendanceScore(settings.classesMissed, settings.totalClasses)
      : null;

  const finalGrade =
    settings != null && selectedSubject
      ? computeFinalGrade({
          majorExamPct: selectedSubject.majorExamPct,
          classStandingPct: selectedSubject.classStandingPct,
          attendancePct,
          examWeight: settings.examWeight,
          standingWeight: settings.standingWeight,
          attendanceWeight: settings.attendanceWeight,
        })
      : null;

  const finalGradeInfo = estimateGradeFromPercentage(finalGrade);

  const bumpSettings = () => setSettingsVersion((value) => value + 1);

  const handleAttendanceChange = (field, rawValue) => {
    if (!studentId || !selectedSubject) return;
    const parsed = Math.max(0, Number.parseInt(rawValue, 10) || 0);
    updateSubjectGradeSettings(studentId, selectedSubject.subjectId, { [field]: parsed });
    bumpSettings();
  };

  const inputClass =
    theme === "dark"
      ? "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
      : "w-full rounded-lg border border-emerald-200/80 en-bg-elevated px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none";

  if (!subjectGrades.length) {
    return (
      <AnalyticsPanel
        title="Final Grade Calculator"
        subtitle="Select a subject to compute your weighted final grade"
      >
        <div
          className={`rounded-xl border border-dashed p-8 text-center ${
            theme === "dark" ? "border-white/10 text-gray-400" : "border-emerald-200 text-gray-500"
          }`}
        >
          <BookOpen className="mx-auto mb-2 opacity-60" size={28} />
          <p className="text-sm">Enroll in subjects and complete assessments to use the grade calculator.</p>
        </div>
      </AnalyticsPanel>
    );
  }

  const examContribution =
    selectedSubject?.majorExamPct != null && settings
      ? Math.round(selectedSubject.majorExamPct * (settings.examWeight / 100) * 10) / 10
      : null;

  const standingContribution =
    selectedSubject?.classStandingPct != null && settings
      ? Math.round(selectedSubject.classStandingPct * (settings.standingWeight / 100) * 10) / 10
      : null;

  const attendanceContribution =
    attendancePct != null && settings
      ? Math.round(attendancePct * (settings.attendanceWeight / 100) * 10) / 10
      : null;

  return (
    <div className="space-y-5">
      <div
        className={`rounded-2xl border p-5 ${
          theme === "dark"
            ? "border-white/10 bg-white/[0.03]"
            : "border-emerald-200/80 en-bg-elevated shadow-sm"
        }`}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className={`text-lg font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
              Final Grade Calculator
            </h3>
            <p className={`mt-1 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
              Choose a subject to see how major exams, class standing, and attendance combine into your final grade.
            </p>
          </div>

          <div className="flex flex-col gap-1.5 sm:min-w-[240px]">
            <label
              htmlFor="grade-subject-select"
              className={`text-xs font-semibold uppercase tracking-wide ${
                theme === "dark" ? "text-emerald-400" : "text-teal-700"
              }`}
            >
              Subject
            </label>
            <Select
              id="grade-subject-select"
              value={selectedSubjectId}
              onChange={(event) => setSelectedSubjectId(event.target.value)}
            >
              {subjectGrades.map((entry) => (
                <option key={entry.subjectId} value={entry.subjectId}>
                  {entry.subjectName} ({entry.subjectType === "minor" ? "Minor" : "Major"})
                </option>
              ))}
            </Select>
          </div>
        </div>

        {selectedSubject && settings && (
          <p className={`mt-3 text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
            Weights: {defaults.exam}% major exams · {defaults.standing}% class standing ·{" "}
            {defaults.attendance}% attendance.
          </p>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <AnalyticsPanel
          title="Major Exams"
          subtitle={`${settings?.examWeight ?? 70}% of final grade · exam-category assessments`}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <ScoreRing
                pct={selectedSubject?.majorExamPct}
                label="Average"
                theme={theme}
                colorClass={theme === "dark" ? "text-red-400" : "text-red-600"}
              />
              <div className="min-w-0 flex-1 space-y-1">
                <p className={`text-sm font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                  {selectedSubject?.examCount ?? 0} exam
                  {(selectedSubject?.examCount ?? 0) === 1 ? "" : "s"} graded
                </p>
                {examContribution != null ? (
                  <p className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                    Contributes {examContribution} pts ({settings.examWeight}% weight)
                  </p>
                ) : (
                  <p className={`text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
                    Complete major exams to include this component.
                  </p>
                )}
              </div>
            </div>
          </div>
        </AnalyticsPanel>

        <AnalyticsPanel
          title="Class Standing"
          subtitle={`${settings?.standingWeight ?? 20}% of final grade · quizzes & activities`}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <ScoreRing
                pct={selectedSubject?.classStandingPct}
                label="Average"
                theme={theme}
                colorClass={theme === "dark" ? "text-amber-400" : "text-amber-600"}
              />
              <div className="min-w-0 flex-1 space-y-1">
                <p className={`text-sm font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                  {selectedSubject?.quizCount ?? 0} quiz
                  {(selectedSubject?.quizCount ?? 0) === 1 ? "" : "zes"},{" "}
                  {selectedSubject?.activityCount ?? 0} activit
                  {(selectedSubject?.activityCount ?? 0) === 1 ? "y" : "ies"}
                </p>
                {standingContribution != null ? (
                  <p className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                    Contributes {standingContribution} pts ({settings.standingWeight}% weight)
                  </p>
                ) : (
                  <p className={`text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
                    Complete quizzes and activities to include this component.
                  </p>
                )}
              </div>
            </div>
          </div>
        </AnalyticsPanel>

        <AnalyticsPanel
          title="Attendance"
          subtitle={`${settings?.attendanceWeight ?? 10}% of final grade · manual entry`}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`rounded-xl p-2.5 ${
                  theme === "dark" ? "bg-blue-500/10" : "bg-blue-50"
                }`}
              >
                <CalendarX
                  size={20}
                  className={theme === "dark" ? "text-blue-400" : "text-blue-600"}
                />
              </div>
              <p className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                Enter how many classes you missed. Attendance score fills the remaining 10%.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="classes-missed"
                  className={`mb-1 block text-xs font-medium ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                >
                  Classes missed
                </label>
                <input
                  id="classes-missed"
                  type="number"
                  min={0}
                  max={settings?.totalClasses ?? 99}
                  value={settings?.classesMissed ?? 0}
                  onChange={(event) => handleAttendanceChange("classesMissed", event.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label
                  htmlFor="total-classes"
                  className={`mb-1 block text-xs font-medium ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                >
                  Total classes
                </label>
                <input
                  id="total-classes"
                  type="number"
                  min={1}
                  value={settings?.totalClasses ?? 16}
                  onChange={(event) => handleAttendanceChange("totalClasses", event.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <ScoreRing
                pct={attendancePct}
                label="Score"
                theme={theme}
                colorClass={theme === "dark" ? "text-blue-400" : "text-blue-600"}
              />
              <div className="min-w-0 flex-1">
                {attendanceContribution != null ? (
                  <p className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                    {settings.totalClasses - settings.classesMissed} of {settings.totalClasses} classes attended ·
                    contributes {attendanceContribution} pts
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </AnalyticsPanel>
      </div>

      <div
        className={`rounded-2xl border p-6 ${
          theme === "dark"
            ? "border-emerald-500/20 bg-emerald-500/5"
            : "border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50"
        }`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-2xl ${
                theme === "dark" ? "bg-emerald-500/15" : "en-bg-elevated shadow-sm"
              }`}
            >
              <GraduationCap
                size={28}
                className={theme === "dark" ? "text-emerald-400" : "text-teal-700"}
              />
            </div>
            <div>
              <p className={`text-sm font-medium ${theme === "dark" ? "text-emerald-400" : "text-teal-700"}`}>
                {selectedSubject?.subjectName} · Final Grade
              </p>
              <p className={`text-3xl font-black ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                {finalGrade != null ? `${finalGrade}%` : "—"}
              </p>
              {finalGradeInfo && (
                <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                  Est. GWA {finalGradeInfo.label} · {finalGradeInfo.remark}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center sm:min-w-[280px]">
            {[
              {
                label: "Exams",
                value: examContribution,
                icon: GraduationCap,
                weight: settings?.examWeight,
              },
              {
                label: "Standing",
                value: standingContribution,
                icon: ClipboardList,
                weight: settings?.standingWeight,
              },
              {
                label: "Attendance",
                value: attendanceContribution,
                icon: CalendarX,
                weight: settings?.attendanceWeight,
              },
            ].map((item) => (
              <div
                key={item.label}
                className={`rounded-xl px-3 py-2 ${
                  theme === "dark" ? "bg-white/5" : "en-bg-elevated-soft"
                }`}
              >
                <item.icon
                  size={14}
                  className={`mx-auto mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                />
                <p className={`text-lg font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                  {item.value != null ? item.value : "—"}
                </p>
                <p className={`text-[10px] ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
                  {item.label} ({item.weight}%)
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
