import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import {
  createSubject,
  deleteSubjectById,
  fetchFacultyDashboardAnalytics,
  fetchTeacherSubjects,
  updateSubject,
} from "../../utils/supabaseData";
import {
  canFacultyManageSubjects,
  FACULTY_AVATAR_REQUIRED_MESSAGE,
  isFacultyRole,
} from "../../utils/avatar";
import FacultyAvatarRequiredBanner from "../../components/FacultyAvatarRequiredBanner";
import FacultyProfileChip from "../../components/FacultyProfileChip";
import CopyInviteCodeButton from "../../components/CopyInviteCodeButton";
import YearLevelBadge, {
  YearLevelFilter,
} from "../../components/YearLevelBadge";
import {
  DEFAULT_YEAR_LEVEL,
  filterSubjectsByYearLevel,
  normalizeYearLevel,
} from "../../utils/yearLevels";
import {
  DEFAULT_SECTION_COUNT,
  formatSubjectSectionsLabel,
  normalizeSectionCount,
} from "../../utils/sections";
import {
  ClipboardCheck,
  GraduationCap,
  Activity,
  Trash2,
  BookOpen,
  Users,
  LayoutDashboard,
  FileCheck,
} from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import {
  primaryButtonSm,
  secondaryButton,
  secondaryButtonSm,
} from "../../utils/themeButtons";
import { PageLoadingSkeleton } from "../../components/ui/PageLoadingSkeleton";
import { usePolling } from "../../hooks/useRealtimeFetch";
import { useAppModal } from "../../contexts/AppModalContext";
import { staggerGridClass } from "../../utils/themeInputs";
import FacultyDashboardAnalyticsPanel from "../../components/FacultyDashboardAnalyticsPanel";
import FacultyCreateSubjectPanel from "../../components/FacultyCreateSubjectPanel";
import CollapsiblePanel from "../../components/ui/CollapsiblePanel";
import ModalPortal from "../../components/ui/ModalPortal";

function panelClass(theme) {
  return theme === "dark"
    ? "bg-gradient-to-br from-[#173a2e] via-[#123027] to-[#0d211b] border border-emerald-500/20"
    : "en-bg-surface border border-emerald-300 shadow-sm";
}

function StatPill({ icon: Icon, label, value, theme }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${panelClass(theme)}`}
    >
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-xl ${
          theme === "dark" ? "bg-emerald-500/15 text-emerald-400" : "en-bg-elevated text-teal-700"
        }`}
      >
        <Icon size={18} />
      </div>
      <div>
        <p className={`text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
          {label}
        </p>
        <p className={`text-xl font-bold tabular-nums ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

export default function FacultyDashboard() {
  const [subjects, setSubjects] = useState(() => {
    const cached = localStorage.getItem("examnexus_subjects");
    return cached ? JSON.parse(cached) : [];
  });
  const [name, setName] = useState("");
  const [newSubjectYearLevel, setNewSubjectYearLevel] = useState(DEFAULT_YEAR_LEVEL);
  const [newSubjectSectionCount, setNewSubjectSectionCount] = useState(DEFAULT_SECTION_COUNT);
  const [creatingSubject, setCreatingSubject] = useState(false);
  const [yearFilter, setYearFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const navigate = useNavigate();
  const [deletingSubject, setDeletingSubject] = useState(false);
  const [dashAnalytics, setDashAnalytics] = useState(null);
  const [editingSubjectId, setEditingSubjectId] = useState(null);
  const [editingSubjectName, setEditingSubjectName] = useState("");
  const user = JSON.parse(localStorage.getItem("examnexus_user") || "{}");
  const [facultyProfile, setFacultyProfile] = useState(user);
  const teacherId = facultyProfile.school_id || user.school_id;
  const facultyCanManage = canFacultyManageSubjects(facultyProfile);
  const { theme } = useTheme();
  const { error: showError, warning: showWarning, confirm, success } = useAppModal();

  const fetchSubjects = useCallback(async (silent = false) => {
    if (!teacherId) {
      if (!silent) setLoading(false);
      return;
    }

    try {
      if (!silent) setLoading(true);
      const freshSubjects = await fetchTeacherSubjects(teacherId);
      setSubjects(freshSubjects);
      localStorage.setItem("examnexus_subjects", JSON.stringify(freshSubjects));

      try {
        const analytics = await fetchFacultyDashboardAnalytics(teacherId);
        setDashAnalytics(analytics);
      } catch (analyticsErr) {
        console.error("Dashboard analytics:", analyticsErr);
      }
    } catch (err) {
      console.error("Error fetching subjects:", err);
      setSubjects([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [teacherId]);

  usePolling(fetchSubjects, [teacherId]);

  useEffect(() => {
    const loadFacultyProfile = async () => {
      if (!user.id || !isFacultyRole(user.role)) return;

      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error || !data) return;

      setFacultyProfile(data);
      localStorage.setItem("examnexus_user", JSON.stringify(data));
    };

    loadFacultyProfile();
  }, [user.id, user.role]);

  const requireFacultyAvatar = () => {
    if (facultyCanManage) return true;
    showWarning(FACULTY_AVATAR_REQUIRED_MESSAGE, "Profile photo required");
    navigate("/faculty/profile");
    return false;
  };

  const deleteSubject = async (subject) => {
    const ok = await confirm({
      title: "Delete subject?",
      message: `Delete "${subject.name}"? This cannot be undone.`,
      tone: "danger",
      confirmLabel: "Delete",
    });
    if (!ok) return;

    try {
      setDeletingSubject(true);
      await deleteSubjectById(subject.id);
      await success("Subject deleted.");
      await fetchSubjects(true);
    } catch (err) {
      console.error("Delete Subject Error:", err);
      showError(err.message);
    } finally {
      setDeletingSubject(false);
    }
  };

  const addSubject = async () => {
    if (!name.trim()) {
      showWarning("Enter a subject name first.", "Subject name required");
      return;
    }
    if (!requireFacultyAvatar()) return;

    try {
      setCreatingSubject(true);
      await createSubject(name, teacherId, newSubjectYearLevel, newSubjectSectionCount);

      setName("");
      setNewSubjectYearLevel(DEFAULT_YEAR_LEVEL);
      setNewSubjectSectionCount(DEFAULT_SECTION_COUNT);
      await success("Subject created.");
      await fetchSubjects(true);
    } catch (err) {
      console.error("Error adding subject:", err);
      showError(err.message);
    } finally {
      setCreatingSubject(false);
    }
  };

  const yearLevelCounts = useMemo(() => {
    const counts = { all: subjects.length };
    for (const subject of subjects) {
      const key = normalizeYearLevel(subject.year_level);
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [subjects]);

  const filteredSubjects = useMemo(
    () => filterSubjectsByYearLevel(subjects, yearFilter),
    [subjects, yearFilter]
  );

  const totalSections = useMemo(
    () =>
      subjects.reduce(
        (sum, subject) => sum + normalizeSectionCount(subject.section_count),
        0
      ),
    [subjects]
  );

  const startEditingSubject = (subject) => {
    setEditingSubjectId(subject.id);
    setEditingSubjectName(subject.name);
  };

  const saveSubjectName = async (subjectId) => {
    const trimmed = editingSubjectName.trim();
    if (!trimmed) {
      setEditingSubjectId(null);
      return;
    }

    try {
      await updateSubject(subjectId, { name: trimmed });
      setEditingSubjectId(null);
      await fetchSubjects();
    } catch (err) {
      console.error("Error updating subject:", err);
      showError(err.message);
    }
  };

  const handleAssessmentChoice = (type) => {
    if (!requireFacultyAvatar()) return;

    setShowAssessmentModal(false);

    navigate("/faculty/create-assessment", {
      state: {
        type,
        subject: selectedSubject,
      },
    });
  };

  const displayName =
    facultyProfile.first_name ||
    user.first_name ||
    user?.email?.split("@")[0] ||
    "Faculty";

  if (loading && subjects.length === 0) {
    return <PageLoadingSkeleton theme={theme} variant="cards" />;
  }

  return (
    <div
      className={`min-h-screen p-4 sm:p-6 ${
        theme === "dark" ? "text-white" : "en-bg-page text-gray-900"
      }`}
    >
      <div className="mx-auto w-full max-w-7xl">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <LayoutDashboard
              size={16}
              className={theme === "dark" ? "text-emerald-400" : "text-teal-600"}
            />
            <span className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-teal-700"}`}>
              Faculty workspace
            </span>
          </div>
          <h1
            className={`mt-2 text-3xl font-bold sm:text-4xl ${
              theme === "dark" ? "text-white" : "text-slate-900"
            }`}
          >
            Hello, {displayName}
          </h1>
          <p className={`mt-1 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
            Create subjects, share invite codes, and manage assessments.
          </p>
        </div>

        <FacultyProfileChip
          subject={{
            faculty_first_name: facultyProfile.first_name,
            faculty_last_name: facultyProfile.last_name,
            faculty_avatar_url: facultyProfile.avatar_url,
          }}
          subjectCount={subjects.length}
        />
      </div>

      {!facultyCanManage && isFacultyRole(facultyProfile.role) && (
        <div className="mb-6">
          <FacultyAvatarRequiredBanner user={facultyProfile} />
        </div>
      )}

      {subjects.length > 0 && (
        <div className={staggerGridClass("mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4")}>
          <StatPill icon={BookOpen} label="Subjects" value={subjects.length} theme={theme} />
          <StatPill icon={Users} label="Class sections" value={totalSections} theme={theme} />
          <StatPill
            icon={GraduationCap}
            label="Year levels"
            value={Object.keys(yearLevelCounts).length - 1}
            theme={theme}
          />
          <StatPill
            icon={FileCheck}
            label="Total submissions"
            value={dashAnalytics?.totalSubmissions ?? "—"}
            theme={theme}
          />
        </div>
      )}

      <div className="mb-6">
        <FacultyCreateSubjectPanel
          name={name}
          onNameChange={setName}
          yearLevel={newSubjectYearLevel}
          onYearLevelChange={setNewSubjectYearLevel}
          sectionCount={newSubjectSectionCount}
          onSectionCountChange={setNewSubjectSectionCount}
          onSubmit={addSubject}
          creating={creatingSubject}
          disabled={!facultyCanManage}
          defaultOpen={subjects.length === 0}
        />
      </div>

      <div className="mb-6">
        <div className="mb-3 flex items-center gap-2">
          <LayoutDashboard
            size={16}
            className={theme === "dark" ? "text-emerald-400" : "text-teal-600"}
          />
          <h2 className={`text-sm font-semibold ${theme === "dark" ? "text-white" : "text-teal-800"}`}>
            Submission insights
          </h2>
        </div>
        <FacultyDashboardAnalyticsPanel teacherSchoolId={teacherId} />
      </div>

      {subjects.length > 0 && (
        <div className="mb-4">
          <YearLevelFilter
            value={yearFilter}
            onChange={setYearFilter}
            counts={yearLevelCounts}
          />
        </div>
      )}

      <CollapsiblePanel
        title={`Your subjects (${filteredSubjects.length})`}
        subtitle="Invite codes, assessments, and subject pages"
        defaultOpen
        className={`mb-6 ${panelClass(theme)}`}
      >
        {subjects.length === 0 ? (
          <div
            className={`rounded-xl border border-dashed px-4 py-8 text-center ${
              theme === "dark"
                ? "border-white/15 bg-white/[0.02] text-gray-400"
                : "border-emerald-300/80 text-gray-600"
            }`}
          >
            <BookOpen size={28} className="mx-auto mb-2 opacity-60" />
            <p className="font-medium text-sm">No subjects yet</p>
            <p className="mt-1 text-xs">Use the panel on the right to create your first subject.</p>
          </div>
        ) : filteredSubjects.length === 0 ? (
          <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-700"}`}>
            No subjects match this year level filter.
          </p>
        ) : (
          <div className={staggerGridClass("grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3")}>
          {filteredSubjects.map((subject) => (
            <article
              key={subject.id}
              className={`group relative rounded-xl p-4 pr-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${
                theme === "dark"
                  ? "bg-white/[0.04] border border-white/10 hover:border-emerald-500/25"
                  : "en-bg-elevated border border-emerald-200 shadow-md hover:border-teal-300"
              }`}
            >
              <CopyInviteCodeButton inviteCode={subject.invite_code} side="right" />

              <button
                type="button"
                onClick={() => deleteSubject(subject)}
                disabled={deletingSubject}
                className={`absolute top-3 right-3 rounded-lg p-2 opacity-0 transition-all duration-300 group-hover:opacity-100 hover:scale-110 disabled:opacity-40 ${
                  theme === "dark"
                    ? "text-red-400 hover:bg-red-500/10"
                    : "text-red-600 hover:bg-red-100"
                }`}
                aria-label="Delete subject"
              >
                <Trash2 size={16} />
              </button>

              {editingSubjectId === subject.id ? (
                <input
                  autoFocus
                  value={editingSubjectName}
                  onChange={(e) => setEditingSubjectName(e.target.value)}
                  onBlur={() => saveSubjectName(subject.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveSubjectName(subject.id);
                    if (e.key === "Escape") setEditingSubjectId(null);
                  }}
                  className={`mb-3 w-full rounded-lg border px-2 py-1 text-lg font-bold outline-none ${
                    theme === "dark"
                      ? "border-emerald-500/30 bg-black/30 text-emerald-400"
                      : "border-emerald-300/80 en-bg-elevated text-teal-700"
                  }`}
                />
              ) : (
                <h3
                  onDoubleClick={() => startEditingSubject(subject)}
                  title="Double-click to rename"
                  className={`mb-3 pr-8 text-lg font-bold cursor-text ${
                    theme === "dark" ? "text-emerald-400" : "text-teal-700"
                  }`}
                >
                  {subject.name}
                </h3>
              )}

              <div className="mb-4 flex flex-wrap items-center gap-2">
                <YearLevelBadge yearLevel={subject.year_level} />
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    theme === "dark"
                      ? "bg-white/10 text-gray-300"
                      : "bg-emerald-50 text-teal-700"
                  }`}
                >
                  {formatSubjectSectionsLabel(subject.section_count)}
                </span>
              </div>

              <div
                className={`mb-3 rounded-lg border px-2.5 py-2 ${
                  theme === "dark"
                    ? "border-white/10 bg-black/20"
                    : "border-emerald-100 bg-emerald-50/60"
                }`}
              >
                <p
                  className={`text-[10px] font-semibold uppercase tracking-wider ${
                    theme === "dark" ? "text-gray-500" : "text-gray-500"
                  }`}
                >
                  Invite code
                </p>
                <p
                  className={`mt-0.5 font-mono text-xs font-semibold tracking-wide ${
                    theme === "dark" ? "text-emerald-300" : "text-teal-700"
                  }`}
                >
                  {subject.invite_code}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => navigate(`/faculty/subject/${subject.id}`)}
                  className={secondaryButtonSm(theme)}
                >
                  View subject info
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!requireFacultyAvatar()) return;
                    setSelectedSubject(subject);
                    setShowAssessmentModal(true);
                  }}
                  className={primaryButtonSm(theme)}
                >
                  + Assessment
                </button>
              </div>
            </article>
          ))}
          </div>
        )}
      </CollapsiblePanel>
      </div>

      {showAssessmentModal && (
        <ModalPortal>
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="presentation">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowAssessmentModal(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            className={`relative z-10 w-full max-w-3xl rounded-3xl p-8 ${
              theme === "dark"
                ? "bg-[#0a120f] border border-white/10"
                : "en-bg-surface border border-emerald-300"
            } shadow-2xl`}
          >
            <h2 className={`text-xl font-bold mb-2 ${theme === "dark" ? "text-emerald-400" : "text-teal-700"}`}>
              Select assessment type
            </h2>
            <p className={`mb-6 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
              For {selectedSubject?.name}
            </p>

            <div className={staggerGridClass("grid gap-4 md:grid-cols-3")}>
              {[
                { type: "quiz", icon: ClipboardCheck, title: "Quiz", desc: "Quick knowledge checks" },
                { type: "exam", icon: GraduationCap, title: "Exam", desc: "Long-form graded exams" },
                { type: "activity", icon: Activity, title: "Activity", desc: "Practice and participation" },
              ].map(({ type, icon: Icon, title, desc }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleAssessmentChoice(type)}
                  className={`group h-44 rounded-2xl border p-6 transition-all hover:-translate-y-1 ${
                    theme === "dark"
                      ? "border-white/10 bg-white/5 hover:border-emerald-500/30"
                      : "border-emerald-200/80 en-bg-elevated hover:border-teal-400 hover:shadow-md"
                  }`}
                >
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <Icon
                      size={44}
                      className="mb-4 text-emerald-500 transition group-hover:scale-110"
                    />
                    <h3 className={`font-semibold ${theme === "dark" ? "text-white" : "text-teal-800"}`}>
                      {title}
                    </h3>
                    <p className={`mt-2 text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                      {desc}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowAssessmentModal(false)}
              className={`mt-6 ${secondaryButton(theme, "px-5 py-3")}`}
            >
              Cancel
            </button>
          </div>
        </div>
        </ModalPortal>
      )}

    </div>
  );
}
