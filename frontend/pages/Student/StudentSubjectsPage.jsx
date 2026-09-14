import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../layouts/ThemeContext";
import { CheckCircle2, XCircle, Plus, LogOut } from "lucide-react";
import { primaryButton, secondaryButton } from "../../utils/themeButtons";
import ProgressButton from "../../components/ui/ProgressButton";
import { resolveStudentId } from "../../utils/authUser";
import {
  getStudentEnrolledSubjects,
  findSubjectByInviteCode,
  isStudentEnrolledInSubject,
  unenrollStudentFromSubject,
} from "../../utils/supabaseData";
import FacultyProfileChip from "../../components/FacultyProfileChip";
import ProfileAvatar from "../../components/ProfileAvatar";
import ActionDialog from "../../components/ui/ActionDialog";
import ModalPortal from "../../components/ui/ModalPortal";
import { formatSectionLabel } from "../../utils/sections";
import { formatFacultyLabel } from "../../utils/subjectDisplay";
import { pageShellWithBellClass, staggerGridClass } from "../../utils/themeInputs";
import { PageLoadingSkeleton } from "../../components/ui/PageLoadingSkeleton";
import { usePolling } from "../../hooks/useRealtimeFetch";
import { API_BASE } from "../../utils/apiBase.js";
import { useScrollIntoViewWhen } from "../../hooks/useScrollIntoViewWhen";
import { getYearLevelLabel } from "../../utils/yearLevels";

export default function StudentSubjects() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("examnexus_user") || "{}");

  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [enrollError, setEnrollError] = useState("");
  const [enrollSuccess, setEnrollSuccess] = useState("");
  const loadErrorRef = useScrollIntoViewWhen(Boolean(loadError), { deps: [loadError] });
  const enrollSuccessRef = useScrollIntoViewWhen(Boolean(enrollSuccess), {
    deps: [enrollSuccess],
  });
  const enrollErrorRef = useScrollIntoViewWhen(Boolean(enrollError), {
    deps: [enrollError],
  });

  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [enrollSection, setEnrollSection] = useState("");
  const [enrollSubjectPreview, setEnrollSubjectPreview] = useState(null);
  const [enrollLookupPending, setEnrollLookupPending] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [unenrollTarget, setUnenrollTarget] = useState(null);
  const [unenrolling, setUnenrolling] = useState(false);

  const sortedSubjects = useMemo(() => {
    return [...subjects].sort((a, b) => {
      const facultyA = formatFacultyLabel(a).toLowerCase();
      const facultyB = formatFacultyLabel(b).toLowerCase();
      const unassignedA = facultyA === "faculty not assigned";
      const unassignedB = facultyB === "faculty not assigned";
      if (unassignedA !== unassignedB) return unassignedA ? 1 : -1;
      const byFaculty = facultyA.localeCompare(facultyB);
      if (byFaculty !== 0) return byFaculty;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }, [subjects]);

  const getAuthContext = async () => {
    let { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      session = refreshed.session;
    }

    const studentId = session?.user?.id || user?.id;

    if (!studentId) {
      throw new Error("Please log in again to enroll in a subject.");
    }

    if (!session?.access_token) {
      throw new Error(
        "Your login session expired. Please log out, log in again, then retry."
      );
    }

    return {
      studentId,
      accessToken: session.access_token,
    };
  };

  const loadSubjects = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setLoadError("");

      const studentId = await resolveStudentId();
      if (!studentId) {
        setSubjects([]);
        setLoadError("Please log in again to view your enrolled subjects.");
        return;
      }

      const subjectsData = await getStudentEnrolledSubjects(studentId);
      setSubjects(subjectsData);
    } catch (err) {
      console.error("Failed to load subjects:", err);
      setSubjects([]);
      setLoadError(
        err.message ||
          "Could not load your subjects. Run database/student_rpc_functions.sql in Supabase SQL Editor, then refresh."
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  usePolling(loadSubjects, []);

  useEffect(() => {
    if (!showEnrollModal) return undefined;

    const normalizedCode = inviteCode.trim().toLowerCase();
    if (!normalizedCode) {
      setEnrollSubjectPreview(null);
      setEnrollSection("");
      setEnrollLookupPending(false);
      return undefined;
    }

    let cancelled = false;
    setEnrollLookupPending(true);

    const timer = window.setTimeout(() => {
      findSubjectByInviteCode(normalizedCode)
        .then((subject) => {
          if (cancelled) return;
          setEnrollSubjectPreview(subject || null);
          setEnrollSection(subject?.section ? String(subject.section).toUpperCase() : "");
        })
        .catch(() => {
          if (!cancelled) {
            setEnrollSubjectPreview(null);
            setEnrollSection("");
          }
        })
        .finally(() => {
          if (!cancelled) setEnrollLookupPending(false);
        });
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [inviteCode, showEnrollModal]);

  useEffect(() => {
    if (!enrollSuccess) return undefined;

    const timer = setTimeout(() => setEnrollSuccess(""), 6000);
    return () => clearTimeout(timer);
  }, [enrollSuccess]);

  const enrollViaRpc = async (normalizedCode, section) => {
    const payload = { p_invite_code: normalizedCode };
    if (section) payload.p_section = section;

    const { data, error } = await supabase.rpc("enroll_student_by_invite_code", payload);

    if (error) {
      if (error.message?.includes("Could not find the function")) {
        return null;
      }

      if (error.message?.includes("Invalid invitation code")) {
        throw new Error("Invalid invitation code. Check the code and try again.");
      }

      if (error.message?.includes("Already enrolled") || error.code === "23505") {
        throw new Error(
          error.message?.includes("Already enrolled")
            ? error.message
            : "You are already enrolled in this subject."
        );
      }

      if (error.message?.includes("Not authenticated")) {
        throw new Error(
          "Your login session expired. Please log out, log in again, then retry."
        );
      }

      if (error.message?.includes("ON CONFLICT") || error.message?.includes("unique or exclusion constraint")) {
        throw new Error(
          "Enrollment database setup is incomplete. Run database/fix_enrollment_unique.sql in Supabase SQL Editor, then try again."
        );
      }

      throw error;
    }

    return data;
  };

  const enrollViaBackend = async (normalizedCode, studentId, accessToken, section) => {
    const res = await fetch(`${API_BASE}/subjects/join`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        invite_code: normalizedCode,
        student_id: studentId,
        section,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 409) {
        throw new Error(data.error || "You are already enrolled in this subject.");
      }
      throw new Error(data.error || "Failed to enroll. Please try again.");
    }

    return data.subject;
  };

  const handleEnroll = async () => {
    if (enrolling) return;
    const normalizedCode = inviteCode.trim().toLowerCase();

    if (!normalizedCode) {
      setEnrollError("Please enter an invitation code.");
      return;
    }

    try {
      setEnrolling(true);
      setEnrollError("");
      setEnrollSuccess("");

      const { studentId, accessToken } = await getAuthContext();

      const targetSubject = await findSubjectByInviteCode(normalizedCode);
      if (targetSubject) {
        const alreadyEnrolled = subjects.some((s) => s.id === targetSubject.id);
        if (alreadyEnrolled) {
          setEnrollError(`You are already enrolled in ${targetSubject.name}.`);
          return;
        }

        const enrolledInDb = await isStudentEnrolledInSubject(
          studentId,
          targetSubject.id
        );
        if (enrolledInDb) {
          setEnrollError(`You are already enrolled in ${targetSubject.name}.`);
          await loadSubjects();
          return;
        }
      }

      let enrolledSubject =
        (await enrollViaRpc(normalizedCode, enrollSection || targetSubject?.section)) ||
        (await enrollViaBackend(
          normalizedCode,
          studentId,
          accessToken,
          enrollSection || targetSubject?.section || "A"
        ));

      setSubjects((prev) => {
        if (prev.some((s) => s.id === enrolledSubject.id)) return prev;
        return [...prev, enrolledSubject];
      });

      setEnrollSuccess(`Successfully enrolled in ${enrolledSubject.name}!`);
      setShowEnrollModal(false);
      setInviteCode("");
      setEnrollSection("");
      setEnrollSubjectPreview(null);
      await loadSubjects();
    } catch (err) {
      console.error(err);
      setEnrollError(err.message || "Failed to enroll. Please try again.");
    } finally {
      setEnrolling(false);
    }
  };

  const closeModal = () => {
    setShowEnrollModal(false);
    setInviteCode("");
    setEnrollSection("");
    setEnrollSubjectPreview(null);
    setEnrollError("");
  };

  const handleUnenroll = async () => {
    if (!unenrollTarget) return;

    try {
      setUnenrolling(true);
      await unenrollStudentFromSubject(unenrollTarget.id);
      setSubjects((prev) => prev.filter((subject) => subject.id !== unenrollTarget.id));
      setEnrollSuccess(`You have left ${unenrollTarget.name}.`);
      setUnenrollTarget(null);
    } catch (err) {
      console.error(err);
      setLoadError(err.message || "Failed to unenroll from this subject.");
      setUnenrollTarget(null);
    } finally {
      setUnenrolling(false);
    }
  };

  if (loading && subjects.length === 0) {
    return <PageLoadingSkeleton theme={theme} variant="cards" />;
  }

  return (
    <div className={pageShellWithBellClass(theme)}>
      <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold">
            {subjects.length === 0 ? "No Enrolled Subjects" : "My Subjects"}
          </h1>
          {subjects.length === 0 && (
            <p className={`mt-2 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
              You are not enrolled in any subjects yet.
            </p>
          )}
        </div>

        <button
          onClick={() => {
            setShowEnrollModal(true);
            setEnrollError("");
            setEnrollSuccess("");
          }}
          className={`shrink-0 self-start sm:mt-1 flex items-center gap-2 ${primaryButton(theme)}`}
        >
          <Plus size={18} />
          Enroll Subject
        </button>
      </div>

      {loadError && (
        <div
          ref={loadErrorRef}
          role="status"
          className="mb-6 flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-500 text-sm"
        >
          <XCircle size={18} className="shrink-0 mt-0.5" />
          <span>{loadError}</span>
        </div>
      )}

      {enrollSuccess && (
        <div
          ref={enrollSuccessRef}
          role="status"
          className={`mb-6 flex items-center gap-3 rounded-xl px-4 py-3 ${
            theme === "dark"
              ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
              : "bg-emerald-50 border border-emerald-300 text-emerald-800"
          }`}
        >
          <CheckCircle2 size={20} />
          <span className="font-medium">{enrollSuccess}</span>
        </div>
      )}

      {subjects.length > 0 && (
        <div
          className={staggerGridClass(
            "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          )}
        >
          {sortedSubjects.map((subject) => {
            const facultyName = formatFacultyLabel(subject);
            const facultyId = subject.teacher_school_id || "";
            const muted = theme === "dark" ? "text-gray-400" : "text-gray-600";
            const yearLabel = getYearLevelLabel(subject.year_level);

            return (
              <div
                key={subject.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/student/subject/${subject.id}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    navigate(`/student/subject/${subject.id}`);
                  }
                }}
                className={`en-static-panel group relative flex h-full min-h-[4.75rem] min-w-0 cursor-pointer flex-col gap-1.5 rounded-xl border px-3 py-2.5 text-left transition ${
                  theme === "dark"
                    ? "border-white/10 bg-white/[0.04] hover:border-emerald-500/35"
                    : "border-slate-200/80 bg-white hover:border-teal-300"
                }`}
              >
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setUnenrollTarget(subject);
                    setLoadError("");
                  }}
                  className={`absolute right-2 top-2 rounded-md border px-1.5 py-1 text-[10px] font-semibold transition ${
                    theme === "dark"
                      ? "border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                      : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                  }`}
                  aria-label={`Unenroll from ${subject.name}`}
                  title="Unenroll"
                >
                  <LogOut size={12} />
                </button>

                <div className="flex min-w-0 items-start gap-2.5 pr-7">
                  <ProfileAvatar
                    src={subject.faculty_avatar_url}
                    alt={facultyName}
                    size="xs"
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm font-semibold leading-snug ${
                        theme === "dark" ? "text-white" : "text-slate-900"
                      }`}
                    >
                      {subject.name}
                    </p>
                    <p className={`mt-0.5 truncate text-[11px] ${muted}`}>
                      {facultyName}
                      {facultyId ? ` · ${facultyId}` : ""}
                    </p>
                  </div>
                </div>
                <p className={`pl-[2.625rem] text-[11px] tabular-nums ${muted}`}>
                  {yearLabel}
                  {subject.section
                    ? ` · ${formatSectionLabel(subject.section)}`
                    : ""}
                  {subject.invite_code ? ` · ${subject.invite_code}` : ""}
                </p>
              </div>
            );
          })}
        </div>
      )}

      </div>

      {showEnrollModal && (
        <ModalPortal>
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="presentation">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeModal}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            className={`relative z-10 w-full max-w-md rounded-3xl p-8 shadow-2xl ${
              theme === "dark"
                ? "bg-[#0b1114] border border-emerald-500/20 shadow-[0_0_60px_rgba(16,185,129,0.12)]"
                : "en-bg-elevated border border-emerald-200"
            }`}
          >
            <h2
              className={`text-2xl font-bold mb-2 ${
                theme === "dark" ? "text-emerald-400" : "text-teal-700"
              }`}
            >
              Enroll in Subject
            </h2>
            <p
              className={`text-sm mb-5 ${
                theme === "dark" ? "text-gray-400" : "text-gray-600"
              }`}
            >
              Enter the section invitation code from your instructor. Each section has its own
              unique code — you will join that section automatically.
            </p>

            <input
              type="text"
              value={inviteCode}
              onChange={(e) => {
                setInviteCode(e.target.value);
                setEnrollError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleEnroll();
              }}
              placeholder="Invitation Code (e.g. ae620860)"
              className={`w-full px-4 py-3 rounded-xl border mb-3 outline-none transition-all focus:ring-2 focus:ring-emerald-500/40 ${
                theme === "dark"
                  ? "bg-[#031d1f] border-white/10 text-white placeholder:text-gray-500"
                  : "en-bg-input border-emerald-200 text-gray-900 placeholder:text-gray-500"
              }`}
            />

            <div
              className={`mb-4 rounded-xl border px-3 py-3 text-sm ${
                theme === "dark"
                  ? "border-white/10 bg-white/[0.03] text-gray-300"
                  : "border-emerald-100 bg-emerald-50/70 text-gray-700"
              }`}
            >
              {!inviteCode.trim() ? (
                <p>Number of sections will show when an invitation code is added.</p>
              ) : enrollLookupPending ? (
                <p>Looking up invitation code…</p>
              ) : enrollSubjectPreview ? (
                <div className="space-y-2">
                  <p>
                    Subject:{" "}
                    <span className="font-semibold">{enrollSubjectPreview.name}</span>
                  </p>
                  <FacultyProfileChip subject={enrollSubjectPreview} compact />
                  <p>
                    Joining:{" "}
                    <span className="font-semibold">
                      {formatSectionLabel(enrollSection || enrollSubjectPreview.section)}
                    </span>
                  </p>
                  <p className={theme === "dark" ? "text-gray-400" : "text-gray-600"}>
                    This subject has {enrollSubjectPreview.section_count || "—"} section
                    {(enrollSubjectPreview.section_count || 0) === 1 ? "" : "s"}.
                  </p>
                </div>
              ) : (
                <p>No subject found for this invitation code yet.</p>
              )}
            </div>

            {enrollError && (
              <div
                ref={enrollErrorRef}
                role="status"
                className="mb-4 flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2 text-red-500 text-sm"
              >
                <XCircle size={18} className="shrink-0 mt-0.5" />
                <span>{enrollError}</span>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={closeModal}
                disabled={enrolling}
                className={secondaryButton(theme, "disabled:opacity-60")}
              >
                Cancel
              </button>
              <ProgressButton
                type="button"
                onClick={handleEnroll}
                loading={enrolling}
                loadingLabel="Joining…"
                disabled={!inviteCode.trim()}
                className={primaryButton(theme)}
              >
                Join Subject
              </ProgressButton>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      <ActionDialog
        open={Boolean(unenrollTarget)}
        title="Leave this subject?"
        confirmLabel="Unenroll"
        cancelLabel="Stay enrolled"
        tone="danger"
        loading={unenrolling}
        onConfirm={handleUnenroll}
        onCancel={() => setUnenrollTarget(null)}
      >
        {unenrollTarget
          ? `You will leave ${unenrollTarget.name}. You can re-enroll later with your section invitation code.`
          : ""}
      </ActionDialog>
    </div>
  );
}
