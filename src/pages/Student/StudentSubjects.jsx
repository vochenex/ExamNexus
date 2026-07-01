import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../layouts/ThemeContext";
import { CheckCircle2, XCircle, BookOpen, ChevronRight, Plus, LogOut } from "lucide-react";
import { primaryButton, secondaryButton } from "../../utils/themeButtons";
import { resolveStudentId } from "../../utils/authUser";
import {
  getStudentEnrolledSubjects,
  findSubjectByInviteCode,
  isStudentEnrolledInSubject,
  unenrollStudentFromSubject,
} from "../../utils/supabaseData";
import FacultyProfileChip from "../../components/FacultyProfileChip";
import YearLevelBadge from "../../components/YearLevelBadge";
import ActionDialog from "../../components/ui/ActionDialog";
import { getSectionsForCount, formatSectionLabel } from "../../utils/sections";
import { pageShellWithBellClass, staggerGridClass } from "../../utils/themeInputs";
import ExamNexusBrand from "../../components/ExamNexusBrand";
import { PageLoadingSkeleton } from "../../components/ui/PageLoadingSkeleton";
import { usePolling } from "../../hooks/useRealtimeFetch";
import { API_BASE } from "../../utils/apiBase.js";

export default function StudentSubjects() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("examnexus_user") || "{}");

  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [enrollError, setEnrollError] = useState("");
  const [enrollSuccess, setEnrollSuccess] = useState("");

  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [enrollSection, setEnrollSection] = useState("A");
  const [enrollSectionCount, setEnrollSectionCount] = useState(3);
  const [enrolling, setEnrolling] = useState(false);
  const [unenrollTarget, setUnenrollTarget] = useState(null);
  const [unenrolling, setUnenrolling] = useState(false);

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
      setEnrollSectionCount(3);
      setEnrollSection("A");
      return undefined;
    }

    let cancelled = false;

    findSubjectByInviteCode(normalizedCode)
      .then((subject) => {
        if (cancelled) return;
        const count = subject?.section_count ?? 3;
        setEnrollSectionCount(count);
        const sections = getSectionsForCount(count);
        setEnrollSection((prev) => (sections.includes(prev) ? prev : "A"));
      })
      .catch(() => {
        if (!cancelled) {
          setEnrollSectionCount(3);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [inviteCode, showEnrollModal]);

  useEffect(() => {
    if (!enrollSuccess) return undefined;

    const timer = setTimeout(() => setEnrollSuccess(""), 6000);
    return () => clearTimeout(timer);
  }, [enrollSuccess]);

  const enrollSections = getSectionsForCount(enrollSectionCount);

  const enrollViaRpc = async (normalizedCode, section) => {
    const { data, error } = await supabase.rpc("enroll_student_by_invite_code", {
      p_invite_code: normalizedCode,
      p_section: section,
    });

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
        (await enrollViaRpc(normalizedCode, enrollSection)) ||
        (await enrollViaBackend(normalizedCode, studentId, accessToken, enrollSection));

      setSubjects((prev) => {
        if (prev.some((s) => s.id === enrolledSubject.id)) return prev;
        return [...prev, enrolledSubject];
      });

      setEnrollSuccess(`Successfully enrolled in ${enrolledSubject.name}!`);
      setShowEnrollModal(false);
      setInviteCode("");
      setEnrollSection("A");
      setEnrollSectionCount(3);
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
    setEnrollSection("A");
    setEnrollSectionCount(3);
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

  if (loading) {
    return <PageLoadingSkeleton theme={theme} variant="cards" />;
  }

  return (
    <div className={pageShellWithBellClass(theme)}>
      <div className="mx-auto max-w-7xl">
      <ExamNexusBrand
        variant="compact"
        idSuffix="student-subjects"
        className="mb-5 opacity-90"
        showTagline={false}
      />
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
        <div className="mb-6 flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-500 text-sm">
          <XCircle size={18} className="shrink-0 mt-0.5" />
          <span>{loadError}</span>
        </div>
      )}

      {enrollSuccess && (
        <div
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
        <div className={staggerGridClass("flex flex-wrap gap-4 items-start")}>
          {subjects.map((subject) => (
            <div
              key={subject.id}
              onClick={() => navigate(`/student/subject/${subject.id}`)}
              className={`
                group
                en-interactive-card
                relative
                w-full
                md:w-[390px]
                p-5
                rounded-2xl
                cursor-pointer
                transition-all
                duration-300
                hover:-translate-y-1
                hover:shadow-xl
                ${
                  theme === "dark"
                    ? "bg-white/5 border border-white/10 hover:border-emerald-500/30 hover:shadow-[0_0_30px_rgba(16,185,129,0.12)]"
                    : "en-bg-elevated border border-emerald-200 shadow-md hover:border-emerald-400"
                }
              `}
            >
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setUnenrollTarget(subject);
                  setLoadError("");
                }}
                className={`absolute right-4 top-4 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                  theme === "dark"
                    ? "border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                    : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                }`}
              >
                <span className="inline-flex items-center gap-1">
                  <LogOut size={14} />
                  Unenroll
                </span>
              </button>

              <div className="flex items-start justify-between gap-3 pr-24">
                <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`
                    p-3
                    rounded-xl
                    shrink-0
                    ${
                      theme === "dark"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "en-bg-skeleton text-teal-700"
                    }
                  `}
                >
                  <BookOpen size={22} />
                </div>
                <YearLevelBadge yearLevel={subject.year_level} className="mt-1" />
                </div>

                <ChevronRight
                  size={20}
                  className={`
                    opacity-0
                    group-hover:opacity-100
                    transition-opacity
                    mt-1
                    ${theme === "dark" ? "text-emerald-400" : "text-teal-600"}
                  `}
                />
              </div>

              <h2
                className={`mt-4 text-xl font-bold ${
                  theme === "dark" ? "text-emerald-400" : "text-teal-700"
                }`}
              >
                {subject.name}
              </h2>

              <div
                className={`mt-3 text-sm space-y-3 ${
                  theme === "dark" ? "text-gray-400" : "text-gray-700"
                }`}
              >
                <FacultyProfileChip subject={subject} />
                <p>
                  Invite Code:{" "}
                  <span
                    className={`
                      px-2
                      py-1
                      rounded-md
                      font-mono
                      text-xs
                      ${
                        theme === "dark"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "en-bg-skeleton text-teal-700"
                      }
                    `}
                  >
                    {subject.invite_code}
                  </span>
                </p>
                {subject.section && (
                  <p>
                    Your Section:{" "}
                    <span className="font-semibold">{formatSectionLabel(subject.section)}</span>
                  </p>
                )}
              </div>

              <p
                className={`mt-4 text-sm font-medium ${
                  theme === "dark"
                    ? "text-emerald-300/80 group-hover:text-emerald-300"
                    : "text-teal-600 group-hover:text-teal-700"
                }`}
              >
                View subject details
              </p>
            </div>
          ))}
        </div>
      )}

      </div>

      {showEnrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div
            className={`w-full max-w-md rounded-3xl p-8 shadow-2xl ${
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
              Enter the invitation code from your instructor. You can join subjects from any
              year level (for example, a 1st year class while you are in 3rd year).
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

            <p
              className={`text-sm mb-2 ${
                theme === "dark" ? "text-gray-400" : "text-gray-600"
              }`}
            >
              Select your section
            </p>
            <div className="flex gap-2 mb-4">
              {enrollSections.map((section) => (
                <button
                  key={section}
                  type="button"
                  onClick={() => setEnrollSection(section)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                    enrollSection === section
                      ? theme === "dark"
                        ? "bg-emerald-500 text-black"
                        : "bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
                      : theme === "dark"
                        ? "bg-white/5 border border-white/10 text-gray-300"
                        : "en-bg-elevated border border-emerald-200 text-gray-700"
                  }`}
                >
                  Section {section}
                </button>
              ))}
            </div>

            {enrollError && (
              <div className="mb-4 flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2 text-red-500 text-sm">
                <XCircle size={18} className="shrink-0 mt-0.5" />
                <span>{enrollError}</span>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={closeModal} className={secondaryButton(theme)}>
                Cancel
              </button>
              <button
                onClick={handleEnroll}
                disabled={enrolling || !inviteCode.trim()}
                className={primaryButton(theme)}
              >
                {enrolling ? "Joining..." : "Join Subject"}
              </button>
            </div>
          </div>
        </div>
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
          ? `You will leave ${unenrollTarget.name}. You can re-enroll later with the invite code and choose your section again.`
          : ""}
      </ActionDialog>
    </div>
  );
}
