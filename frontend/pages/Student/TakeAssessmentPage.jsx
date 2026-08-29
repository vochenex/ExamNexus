import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Flag } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { useTheme } from "../../layouts/ThemeContext";
import { useAssessmentLockdown } from "../../contexts/AssessmentLockdownContext";
import { primaryButton, secondaryButton } from "../../utils/themeButtons";
import AssessmentQuestionInput from "../../components/AssessmentQuestionInput";
import AssessmentQuestionNav from "../../components/AssessmentQuestionNav";
import AssessmentLockdownModal from "../../components/AssessmentLockdownModal";
import ActionDialog from "../../components/ui/ActionDialog";
import SubmissionSuccessOverlay from "../../components/SubmissionSuccessOverlay";
import { PageLoadingSkeleton } from "../../components/ui/PageLoadingSkeleton";
import AssessmentFocusGuard from "../../components/AssessmentFocusGuard";
import AssessmentExamInstructionsBar from "../../components/AssessmentExamInstructionsBar";
import IntegrityAlertToast from "../../components/IntegrityAlertToast";
import useAssessmentIntegrity from "../../hooks/useAssessmentIntegrity";
import useQuestionTimeTracking from "../../hooks/useQuestionTimeTracking";
import useConnectionStatus from "../../hooks/useConnectionStatus";
import ExamNetworkRecoveryOverlay from "../../components/ExamNetworkRecoveryOverlay";
import { isNetworkIssue } from "../../utils/networkErrors";
import { formatSupabaseError } from "../../utils/supabaseErrors";
import {
  submitStudentExam,
  hasStudentSubmittedExam,
  getStudentRetakeStatus,
} from "../../utils/supabaseData";
import { EXAM_TYPE_LABELS } from "../../utils/assessmentQuestions";
import { getFormatLabel } from "../../utils/questionSections";
import {
  dedupeExamQuestions,
  groupQuestionsForNavigation,
  getQuestionFormatType,
  isAnswerProvided,
  countAnsweredQuestions,
  isIndexNavigable,
  isSectionLocked,
  getNextUnansweredIndex,
  getPreviousNavigableIndex,
  getSectionIndexForQuestion,
  shouldShowSubmitButton,
  shuffleQuestionsForStudent,
  orderQuestionsByIds,
  isQuestionAnswered,
} from "../../utils/assessmentTake";
import {
  formatAssessmentDurationLabel,
  getAssessmentDurationSeconds,
  normalizeDurationUnit,
} from "../../utils/assessmentDuration";
import { resolveStudentId } from "../../utils/authUser";
import { canTakeAssessmentOnThisDevice } from "../../utils/platform";
import {
  clearExamSession,
  computeExamRemainingSeconds,
  enterAssessmentFullscreen,
  exitAssessmentFullscreen,
  loadExamSession,
  loadIntegrityStrikes,
  MAX_INTEGRITY_STRIKES,
  saveExamSession,
  secondsUntilEndDatetime,
} from "../../utils/examIntegrity";

function formatDurationLabel(examData) {
  return formatAssessmentDurationLabel(examData);
}

/**
 * Assessments may only be taken on a computer / laptop browser.
 * Phones, tablets, iPads, and the native mobile app are blocked even if
 * the student opens the website on those devices.
 */
export default function TakeAssessment() {
  const { id: _id } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const blocked = !canTakeAssessmentOnThisDevice();

  useEffect(() => {
    if (!blocked) return undefined;

    const onResize = () => {
      // Keep page blocked if the viewport stays below desktop size.
      if (!canTakeAssessmentOnThisDevice()) return;
      // Soft refresh once a genuine desktop width is available.
      window.location.reload();
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [blocked]);

  if (blocked) {
    return (
      <div
        className={`flex min-h-[70vh] flex-col items-center justify-center gap-4 p-8 text-center ${
          theme === "dark" ? "bg-[#031d1f] text-gray-200" : "en-bg-page text-gray-800"
        }`}
      >
        <div
          className={`max-w-md rounded-2xl border px-6 py-8 ${
            theme === "dark"
              ? "border-amber-500/25 bg-amber-500/5"
              : "border-amber-200 bg-amber-50"
          }`}
        >
          <p
            className={`text-xs font-semibold uppercase tracking-wide ${
              theme === "dark" ? "text-amber-300" : "text-amber-800"
            }`}
          >
            Desktop required
          </p>
          <h1
            className={`mt-2 text-2xl font-bold ${
              theme === "dark" ? "text-white" : "text-gray-900"
            }`}
          >
            Assessments can only be taken on a computer or laptop
          </h1>
          <p
            className={`mt-3 text-sm leading-relaxed ${
              theme === "dark" ? "text-gray-400" : "text-gray-600"
            }`}
          >
            Phones, tablets, iPads, and the ExamNexus mobile app do not support the
            secure exam lockdown (fullscreen + integrity checks). Please open
            ExamNexus on a desktop or laptop browser to continue.
          </p>
          <button
            type="button"
            className={`mt-6 ${secondaryButton(theme)}`}
            onClick={() => navigate("/student/assessments", { replace: true })}
          >
            Back to assessments
          </button>
        </div>
      </div>
    );
  }

  return <TakeAssessmentExperience />;
}

function TakeAssessmentExperience() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { startLockdown, endLockdown } = useAssessmentLockdown();

  const [exam, setExam] = useState(null);
  const [studentId, setStudentId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState("loading");
  const [showLockdownModal, setShowLockdownModal] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flaggedIndices, setFlaggedIndices] = useState(() => new Set());
  const [furthestSectionIndex, setFurthestSectionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [error, setError] = useState("");
  const [integrityAlert, setIntegrityAlert] = useState("");
  const [focusBlocked, setFocusBlocked] = useState(false);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [resultDialog, setResultDialog] = useState(null);
  const [integrityStrikes, setIntegrityStrikes] = useState(0);
  const [submitBlocked, setSubmitBlocked] = useState(false);
  const [isRetakeAttempt, setIsRetakeAttempt] = useState(false);
  const [autoSubmitting, setAutoSubmitting] = useState(false);
  const [loadRetryToken, setLoadRetryToken] = useState(0);
  const [networkRecovery, setNetworkRecovery] = useState(false);
  const [pendingSubmitRetry, setPendingSubmitRetry] = useState(false);
  const alertTimerRef = useRef(null);
  const submitExamRef = useRef(null);
  const autoSubmittingRef = useRef(false);
  const pendingIntegrityAutoSubmitRef = useRef(false);
  const pendingSubmitOptionsRef = useRef(null);
  const examRef = useRef(null);
  const { isOffline, isUnstable, isOnline, refresh: refreshConnection } = useConnectionStatus({
    enabled: true,
    fast: true,
  });

  const isActive = phase === "active";
  const interactionLocked =
    submitting || confirmSubmitOpen || Boolean(resultDialog) || autoSubmitting;
  const connectionDegraded = isOffline || isUnstable;
  const networkErrorActive = Boolean(error) && isNetworkIssue(null, error);
  const showNetworkRecovery =
    networkRecovery ||
    pendingSubmitRetry ||
    networkErrorActive ||
    (isActive && connectionDegraded);

  const recoveryDetail = pendingSubmitRetry
    ? "Submitting your answers as soon as the connection is stable…"
    : "Retrying it now for you…";

  // Drop recovery as soon as the browser reports online again.
  useEffect(() => {
    if (!isOnline) return;
    setNetworkRecovery(false);
    if (networkErrorActive) {
      setError("");
    }
  }, [isOnline, networkErrorActive]);

  useEffect(() => {
    if (!showNetworkRecovery) return undefined;

    const softRefresh = () => {
      if (alreadySubmitted) return;

      void refreshConnection();

      // Active exam offline: keep answers mounted; connection hook probes in background.
      if (isActive && exam && !networkErrorActive && !networkRecovery) {
        return;
      }

      if (!exam || networkErrorActive || networkRecovery) {
        setError("");
        setPhase("loading");
        setLoading(true);
        setLoadRetryToken((value) => value + 1);
      }
    };

    if (!connectionDegraded) {
      softRefresh();
    }

    const intervalId = window.setInterval(() => {
      softRefresh();
    }, 2000);

    return () => window.clearInterval(intervalId);
  }, [
    alreadySubmitted,
    connectionDegraded,
    exam,
    isActive,
    networkErrorActive,
    networkRecovery,
    refreshConnection,
    showNetworkRecovery,
  ]);

  useEffect(() => {
    if (!pendingSubmitRetry || connectionDegraded || submitting) return;
    submitExamRef.current?.(pendingSubmitOptionsRef.current || {});
  }, [pendingSubmitRetry, connectionDegraded, submitting]);

  useEffect(() => {
    examRef.current = exam;
  }, [exam]);

  const {
    flushCurrentQuestionTime,
    getTimesSnapshot,
    replaceTimes,
  } = useQuestionTimeTracking({
    active: isActive,
    questions,
    currentQuestionIndex: currentQuestion,
  });

  const showIntegrityAlert = useCallback((message) => {
    setIntegrityAlert(message);
    if (alertTimerRef.current) {
      clearTimeout(alertTimerRef.current);
    }
    alertTimerRef.current = setTimeout(() => {
      setIntegrityAlert("");
    }, 9000);
  }, []);

  const handleStrikeChange = useCallback(
    ({ strikes, remaining, maxStrikes }) => {
      setIntegrityStrikes(strikes);
      if (strikes >= maxStrikes) {
        showIntegrityAlert(
          `Integrity violation recorded (${strikes}/${maxStrikes}). Maximum reached — submitting automatically.`
        );
        return;
      }
      showIntegrityAlert(
        `Integrity violation recorded (${strikes}/${maxStrikes}). ${remaining} alert${remaining === 1 ? "" : "s"} left before auto-submit.`
      );
    },
    [showIntegrityAlert]
  );

  const handleAutoSubmit = useCallback(() => {
    if (autoSubmittingRef.current) return;

    // Offline never auto-submits. Queue integrity auto-submit until connection returns.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      pendingIntegrityAutoSubmitRef.current = true;
      showIntegrityAlert(
        "Maximum integrity violations reached. Submission will run automatically once your connection returns."
      );
      return;
    }

    autoSubmittingRef.current = true;
    pendingIntegrityAutoSubmitRef.current = false;
    setAutoSubmitting(true);
    setFocusBlocked(false);
    showIntegrityAlert(
      "Maximum integrity violations reached. Your assessment is being submitted automatically."
    );
    submitExamRef.current?.({ reason: "integrity" });
  }, [showIntegrityAlert]);

  useEffect(() => {
    if (!isActive || !id || autoSubmittingRef.current) return;
    if (loadIntegrityStrikes(id) >= MAX_INTEGRITY_STRIKES) {
      handleAutoSubmit();
    }
  }, [handleAutoSubmit, id, isActive]);

  useEffect(() => {
    if (isOffline || !isActive) return;
    if (!pendingIntegrityAutoSubmitRef.current) return;
    if (loadIntegrityStrikes(id) < MAX_INTEGRITY_STRIKES) {
      pendingIntegrityAutoSubmitRef.current = false;
      return;
    }
    handleAutoSubmit();
  }, [handleAutoSubmit, id, isActive, isOffline]);

  const { clearFocusViolation } = useAssessmentIntegrity({
    examId: id,
    active: isActive,
    isRetakeAttempt,
    isOffline: connectionDegraded,
    onAlert: showIntegrityAlert,
    onFocusViolation: setFocusBlocked,
    onStrikeChange: handleStrikeChange,
    onAutoSubmit: handleAutoSubmit,
    suppressAlerts: interactionLocked,
  });

  useEffect(() => {
    const loadExam = async () => {
      try {
        setError("");
        setSubmitBlocked(false);

        const currentStudentId = await resolveStudentId();
        setStudentId(currentStudentId || null);

        const retakeStatus = await getStudentRetakeStatus(id);
        const isApprovedRetake = retakeStatus === "approved";
        setIsRetakeAttempt(isApprovedRetake);

        if (isApprovedRetake) {
          clearExamSession(id);
        }

        const { data: examData, error: examError } = await supabase
          .from("exams")
          .select("*")
          .eq("id", id)
          .single();

        if (examError) throw examError;

        const { data: questionData, error: questionError } = await supabase
          .from("questions")
          .select("*")
          .eq("exam_id", id)
          .order("created_at", { ascending: true });

        if (questionError) throw questionError;

        const uniqueQuestions = dedupeExamQuestions(questionData || []);
        const durationSeconds = getAssessmentDurationSeconds(examData);

        let saved = isApprovedRetake ? null : loadExamSession(id);

        // If a different student previously used this browser for this exam,
        // discard that session so answers/lockdown state are never reused
        // across accounts.
        if (saved?.studentId && currentStudentId && saved.studentId !== currentStudentId) {
          clearExamSession(id);
          saved = null;
        }

        let orderedQuestions = uniqueQuestions;
        let resumeSession = null;

        // Server submission always wins — never resume lockdown after submit
        // (stale local session / back-button / refresh must go to results).
        const submitted = await hasStudentSubmittedExam(id);

        let excluded = false;
        try {
          const { data: exclusionRow } = await supabase
            .from("exam_student_exclusions")
            .select("id")
            .eq("exam_id", id)
            .eq("student_id", currentStudentId)
            .maybeSingle();
          excluded = Boolean(exclusionRow?.id);
        } catch {
          excluded = false;
        }

        if ((submitted || excluded) && !isApprovedRetake) {
          clearExamSession(id);
          setAlreadySubmitted(true);
          setLoading(false);
          setPhase("done");
          endLockdown();
          await exitAssessmentFullscreen();
          navigate(
            currentStudentId
              ? `/student/results/${id}/${currentStudentId}`
              : `/student/results/${id}`,
            { replace: true }
          );
          return;
        }

        if (saved?.commenced && saved.startedAt) {
          const sessionTotalSeconds = Number(saved.totalSeconds);
          const activeTotalSeconds =
            Number.isFinite(sessionTotalSeconds) && sessionTotalSeconds > 0
              ? sessionTotalSeconds
              : durationSeconds;
          const remaining = computeExamRemainingSeconds(
            saved.startedAt,
            activeTotalSeconds,
            examData.end_datetime
          );

          if (remaining > 0) {
            orderedQuestions = saved.questionOrder?.length
              ? orderQuestionsByIds(uniqueQuestions, saved.questionOrder)
              : uniqueQuestions;
            resumeSession = { saved, activeTotalSeconds, remaining };
          } else {
            clearExamSession(id);
          }
        }

        setAlreadySubmitted(false);

        setExam(examData);
        setQuestions(orderedQuestions);
        setTotalSeconds(durationSeconds);
        setNetworkRecovery(false);

        if (resumeSession) {
          const { saved: session, activeTotalSeconds, remaining } = resumeSession;
          setAnswers(session.answers || {});
          setCurrentQuestion(session.currentQuestion || 0);
          setFlaggedIndices(new Set(session.flaggedIndices || []));
          setFurthestSectionIndex(Number(session.furthestSectionIndex) || 0);
          setTimeLeft(remaining);
          setTotalSeconds(activeTotalSeconds);
          replaceTimes(session.questionTimes || {});
          setIntegrityStrikes(loadIntegrityStrikes(id));
          // Explicit Continue screen — do not auto-lock until the student confirms
          // (also restores a real user gesture for fullscreen after crash/blackout).
          setPhase("resume");
          setShowLockdownModal(false);
          endLockdown();
        } else {
          const readySeconds = Math.min(
            durationSeconds,
            secondsUntilEndDatetime(examData.end_datetime)
          );
          setTimeLeft(readySeconds);
          setPhase("ready");
          setShowLockdownModal(true);
        }
      } catch (err) {
        console.error(err);
        const friendly = formatSupabaseError(err, {
          fallback: "Failed to load assessment.",
        });
        const networkIssue = isNetworkIssue(err, friendly);

        // Keep an in-progress local session visible during blackouts / offline.
        const session = loadExamSession(id);
        if (networkIssue && session?.commenced && examRef.current) {
          setError("");
          setNetworkRecovery(false);
          return;
        }

        if (networkIssue) {
          setNetworkRecovery(true);
          setError("");
          setPhase("loading");
          return;
        }

        setError(friendly);
        setPhase("error");
      } finally {
        setLoading(false);
      }
    };

    loadExam();
  }, [id, startLockdown, endLockdown, loadRetryToken, replaceTimes, navigate]);

  useEffect(() => {
    if (!isActive || !id) return;

    const existing = loadExamSession(id);

    saveExamSession(id, {
      commenced: true,
      startedAt: existing?.startedAt || new Date().toISOString(),
      totalSeconds,
      studentId,
      answers,
      currentQuestion,
      flaggedIndices: [...flaggedIndices],
      furthestSectionIndex,
      questionOrder: existing?.questionOrder || questions.map((question) => question.id),
      questionTimes: getTimesSnapshot(),
    });
  }, [
    answers,
    currentQuestion,
    flaggedIndices,
    furthestSectionIndex,
    getTimesSnapshot,
    id,
    isActive,
    questions,
    studentId,
    totalSeconds,
  ]);

  useEffect(
    () => () => {
      if (alertTimerRef.current) {
        clearTimeout(alertTimerRef.current);
      }
    },
    []
  );

  const navGroups = useMemo(
    () => (exam ? groupQuestionsForNavigation(questions, exam.exam_type) : []),
    [exam, questions]
  );

  const answeredCount = useMemo(
    () => countAnsweredQuestions(questions, exam?.exam_type, answers),
    [answers, exam?.exam_type, questions]
  );

  const canSubmit = useMemo(
    () =>
      exam
        ? shouldShowSubmitButton(currentQuestion, questions, exam.exam_type, answers)
        : false,
    [answers, currentQuestion, exam, questions]
  );

  const lockCompletedSections = Boolean(exam?.lock_completed_sections);

  // Keep exam metadata/settings in sync while ready or actively taking
  // (title, instructions, schedule, duration, and lock/review toggles).
  useEffect(() => {
    const syncing = phase === "ready" || phase === "active";
    if (!syncing || !id) return undefined;

    const SETTINGS_KEYS = [
      "title",
      "instructions",
      "end_datetime",
      "duration_value",
      "duration_unit",
      "lock_completed_sections",
      "shuffle_questions",
      "allow_review",
      "show_result",
      "show_question_review",
      "show_correct_answers",
    ];

    const settingValuesEqual = (key, previous, next) => {
      if (key === "duration_value") {
        return Number(previous) === Number(next);
      }
      if (key === "duration_unit") {
        return normalizeDurationUnit(previous) === normalizeDurationUnit(next);
      }
      return previous === next;
    };

    const applySettings = (incoming) => {
      if (!incoming) return;

      const current = examRef.current;
      if (!current) return;

      let changed = false;
      const next = { ...current };
      for (const key of SETTINGS_KEYS) {
        if (incoming[key] === undefined) continue;
        if (!settingValuesEqual(key, current[key], incoming[key])) {
          next[key] = incoming[key];
          changed = true;
        }
      }
      if (!changed) return;

      const prevDuration = getAssessmentDurationSeconds(current);
      const nextDuration = getAssessmentDurationSeconds(next);
      const durationChanged = prevDuration !== nextDuration;
      const endChanged = current.end_datetime !== next.end_datetime;
      const titleChanged = current.title !== next.title;

      examRef.current = next;
      setExam(next);

      if (titleChanged && phase === "active") {
        startLockdown(id, next.title || "");
      }

      if (phase === "ready" && (durationChanged || endChanged)) {
        const readySeconds = Math.min(
          nextDuration,
          secondsUntilEndDatetime(next.end_datetime)
        );
        setTotalSeconds(nextDuration);
        setTimeLeft(readySeconds);
      }

      if (phase === "active" && (durationChanged || endChanged)) {
        const session = loadExamSession(id);
        const startedAt = session?.startedAt;
        if (!startedAt) return;

        const activeTotal = durationChanged
          ? nextDuration
          : Number(session?.totalSeconds) > 0
            ? Number(session.totalSeconds)
            : nextDuration;

        if (durationChanged) {
          setTotalSeconds(activeTotal);
          saveExamSession(id, {
            ...session,
            totalSeconds: activeTotal,
          });
        }

        setTimeLeft(
          computeExamRemainingSeconds(startedAt, activeTotal, next.end_datetime)
        );
      }
    };

    const refreshSettings = async () => {
      try {
        const { data, error } = await supabase
          .from("exams")
          .select(SETTINGS_KEYS.join(","))
          .eq("id", id)
          .maybeSingle();
        if (!error && data) applySettings(data);
      } catch {
        // Ignore transient polling failures during an active exam.
      }
    };

    const refreshQuestions = async () => {
      try {
        const { data, error } = await supabase
          .from("questions")
          .select("*")
          .eq("exam_id", id)
          .order("created_at", { ascending: true });
        if (error || !data) return;

        const uniqueQuestions = dedupeExamQuestions(data);
        setQuestions((prev) => {
          if (prev.length === uniqueQuestions.length) {
            const same = prev.every((question, index) => {
              const next = uniqueQuestions[index];
              return (
                question?.id === next?.id &&
                question?.question === next?.question &&
                JSON.stringify(question?.options) === JSON.stringify(next?.options) &&
                JSON.stringify(question?.grading_options || question?.grading) ===
                  JSON.stringify(next?.grading_options || next?.grading)
              );
            });
            if (same) return prev;
          }

          // Preserve student order when already commenced.
          const session = loadExamSession(id);
          if (session?.questionOrder?.length) {
            return orderQuestionsByIds(uniqueQuestions, session.questionOrder);
          }
          return uniqueQuestions;
        });
      } catch {
        // Ignore transient question poll failures.
      }
    };

    refreshSettings();
    refreshQuestions();
    const intervalId = window.setInterval(() => {
      refreshSettings();
      refreshQuestions();
    }, 4000);

    const channel = supabase
      .channel(`take-exam-settings-${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "exams",
          filter: `id=eq.${id}`,
        },
        (payload) => applySettings(payload?.new)
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "questions",
          filter: `exam_id=eq.${id}`,
        },
        () => {
          void refreshQuestions();
        }
      )
      .subscribe();

    return () => {
      window.clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [phase, id, startLockdown]);

  const sectionNavOptions = useMemo(
    () => ({
      lockCompletedSections,
      furthestSectionIndex,
    }),
    [furthestSectionIndex, lockCompletedSections]
  );

  const checkNavigable = useCallback(
    (index) =>
      exam
        ? isIndexNavigable(
            index,
            navGroups,
            questions,
            exam.exam_type,
            answers,
            sectionNavOptions
          )
        : false,
    [answers, exam, navGroups, questions, sectionNavOptions]
  );

  const checkSectionLocked = useCallback(
    (groupIndex) =>
      exam
        ? isSectionLocked(
            groupIndex,
            navGroups,
            questions,
            exam.exam_type,
            answers,
            sectionNavOptions
          )
        : true,
    [answers, exam, navGroups, questions, sectionNavOptions]
  );

  const previousIndex = useMemo(
    () =>
      exam
        ? getPreviousNavigableIndex(
            currentQuestion,
            navGroups,
            questions,
            exam.exam_type,
            answers,
            sectionNavOptions
          )
        : null,
    [answers, currentQuestion, exam, navGroups, questions, sectionNavOptions]
  );

  const nextUnansweredIndex = useMemo(
    () =>
      exam
        ? getNextUnansweredIndex(
            currentQuestion,
            questions,
            exam.exam_type,
            answers,
            navGroups,
            sectionNavOptions
          )
        : null,
    [answers, currentQuestion, exam, navGroups, questions, sectionNavOptions]
  );

  useEffect(() => {
    if (!isActive || !exam || !questions.length) return;
    const section = getSectionIndexForQuestion(currentQuestion, navGroups);
    setFurthestSectionIndex((prev) => Math.max(prev, section));
  }, [currentQuestion, exam, isActive, navGroups, questions.length]);

  useEffect(() => {
    if (!isActive || !exam || !questions.length) return;

    if (
      !isIndexNavigable(
        currentQuestion,
        navGroups,
        questions,
        exam.exam_type,
        answers,
        sectionNavOptions
      )
    ) {
      const fallback =
        getNextUnansweredIndex(
          -1,
          questions,
          exam.exam_type,
          answers,
          navGroups,
          sectionNavOptions
        ) ??
        navGroups
          .flatMap((group) => group.items)
          .find((item) =>
            isIndexNavigable(
              item.index,
              navGroups,
              questions,
              exam.exam_type,
              answers,
              sectionNavOptions
            )
          )?.index;

      if (fallback != null && fallback !== currentQuestion) {
        setCurrentQuestion(fallback);
      }
    }
  }, [
    isActive,
    exam,
    questions,
    navGroups,
    answers,
    currentQuestion,
    sectionNavOptions,
  ]);

  /** Leaving an unanswered item auto-flags it for review (yellow in the nav). */
  const flagIfUnansweredOnLeave = useCallback(
    (questionIndex) => {
      const question = questions[questionIndex];
      if (!question || !exam) return;
      if (isQuestionAnswered(question, exam.exam_type, answers)) return;
      setFlaggedIndices((prev) => {
        if (prev.has(questionIndex)) return prev;
        const next = new Set(prev);
        next.add(questionIndex);
        return next;
      });
    },
    [answers, exam, questions]
  );

  const submitExam = useCallback(async (options = {}) => {
    const { reason } = options;
    if (submitting || submitBlocked) return;

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      // Integrity auto-submit must not force a submit while offline.
      if (reason === "integrity") {
        autoSubmittingRef.current = false;
        pendingIntegrityAutoSubmitRef.current = true;
        setAutoSubmitting(true);
      }
      pendingSubmitOptionsRef.current = options;
      setPendingSubmitRetry(true);
      return;
    }

    try {
      setSubmitting(true);
      setPendingSubmitRetry(false);
      pendingSubmitOptionsRef.current = null;
      flushCurrentQuestionTime();

      const result = await submitStudentExam({
        examId: id,
        examType: exam.exam_type,
        questions,
        answersByQuestionId: answers,
        timeSpentByQuestionId: getTimesSnapshot(),
        autoSubmitted: reason === "integrity",
      });

      clearExamSession(id);
      setFocusBlocked(false);
      pendingIntegrityAutoSubmitRef.current = false;
      setPendingSubmitRetry(false);
      pendingSubmitOptionsRef.current = null;
      setAutoSubmitting(false);
      autoSubmittingRef.current = false;
      // Drop lockdown immediately so post-submit navigation never keeps the banner.
      endLockdown();
      void exitAssessmentFullscreen();

      const hasEssayQuestions = questions.some(
        (question) => getQuestionFormatType(question, exam.exam_type) === "essay"
      );
      const autoSubmitted = reason === "integrity";

      let message;
      if (autoSubmitted) {
        message = `Your answers were submitted automatically after ${MAX_INTEGRITY_STRIKES} integrity violations (leaving the tab or opening extra tabs).`;
        if (hasEssayQuestions) {
          message += " Essay responses are pending teacher review.";
        } else {
          message += ` Your score: ${result.score} / ${result.total}.`;
        }
      } else if (hasEssayQuestions) {
        message =
          "Your answers were submitted. Essay responses are pending teacher review.";
      } else {
        message = `Your score: ${result.score} / ${result.total}`;
      }

      setResultDialog({
        tone: autoSubmitted ? "danger" : "success",
        title: autoSubmitted ? "Assessment auto-submitted" : undefined,
        message,
        exitLockdown: true,
      });
    } catch (err) {
      const alreadySubmitted = /already submitted/i.test(err.message || "");
      const networkError = isNetworkIssue(err, err.message);

      if (alreadySubmitted) {
        setSubmitBlocked(true);
        clearExamSession(id);
        endLockdown();
        void exitAssessmentFullscreen();
        setResultDialog({
          tone: "danger",
          title: "Already submitted",
          message:
            "This attempt could not be saved because a submission already exists. Opening your results.",
          exitLockdown: true,
          goToResults: true,
        });
        return;
      }

      if (networkError) {
        if (reason === "integrity") {
          autoSubmittingRef.current = false;
          pendingIntegrityAutoSubmitRef.current = true;
          setAutoSubmitting(true);
        }
        pendingSubmitOptionsRef.current = options;
        setPendingSubmitRetry(true);
        return;
      }

      setResultDialog({
        tone: "danger",
        title: "Submission failed",
        message: err.message || "Could not submit your answers. Please try again.",
        exitLockdown: false,
      });
    } finally {
      setSubmitting(false);
    }
  }, [
    answers,
    endLockdown,
    exam,
    flushCurrentQuestionTime,
    getTimesSnapshot,
    id,
    questions,
    submitBlocked,
    submitting,
  ]);

  submitExamRef.current = submitExam;

  const goToResults = useCallback(async () => {
    const sid = studentId || (await resolveStudentId());
    endLockdown();
    await exitAssessmentFullscreen();
    const target = sid
      ? `/student/results/${id}/${sid}`
      : `/student/results/${id}`;
    navigate(target, { replace: true });
  }, [endLockdown, id, navigate, studentId]);

  const handleSubmissionSuccessComplete = useCallback(async () => {
    setResultDialog(null);
    setSubmitBlocked(true);
    await goToResults();
  }, [goToResults]);

  const handleResultDialogClose = useCallback(async () => {
    const dialog = resultDialog;
    setResultDialog(null);

    if (dialog?.tone === "success" || dialog?.exitLockdown || dialog?.goToResults) {
      setSubmitBlocked(true);
      if (dialog?.tone === "success" || dialog?.goToResults) {
        await goToResults();
      } else {
        endLockdown();
        await exitAssessmentFullscreen();
        navigate("/student/assessments", { replace: true });
      }
    }
  }, [endLockdown, goToResults, navigate, resultDialog]);

  const buildSubmitConfirmMessage = () => {
    const flagged = flaggedIndices.size;
    const remaining = questions.length - answeredCount;
    let message = "You cannot change your answers after submitting.";
    if (remaining > 0) {
      message += `\n\n${remaining} item${remaining === 1 ? "" : "s"} still unanswered.`;
    }
    if (flagged > 0) {
      message += `\n\n${flagged} item${flagged === 1 ? "" : "s"} flagged for review.`;
    }
    return message;
  };

  const handleConfirmSubmit = () => {
    setConfirmSubmitOpen(false);
    submitExam();
  };

  useEffect(() => {
    if (!isActive || timeLeft <= 0 || !questions.length || interactionLocked) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, timeLeft, questions.length, interactionLocked]);

  useEffect(() => {
    if (
      isActive &&
      timeLeft === 0 &&
      questions.length > 0 &&
      !submitting &&
      !submitBlocked &&
      !interactionLocked
    ) {
      submitExam();
    }
  }, [isActive, timeLeft, questions.length, submitting, submitBlocked, interactionLocked, submitExam]);

  const commenceExam = async () => {
    // Request fullscreen immediately while still inside the click gesture.
    // Any await before this can cause browsers to reject fullscreen.
    const fullscreenOk = await enterAssessmentFullscreen();

    let orderedQuestions = questions;

    if (exam?.shuffle_questions) {
      const currentStudentId = studentId || (await resolveStudentId());
      if (currentStudentId) {
        orderedQuestions = shuffleQuestionsForStudent(questions, id, currentStudentId);
        setQuestions(orderedQuestions);
      }
    }

    clearExamSession(id);

    const startedAt = new Date().toISOString();
    setIntegrityStrikes(0);
    autoSubmittingRef.current = false;
    setAutoSubmitting(false);
    saveExamSession(id, {
      commenced: true,
      startedAt,
      totalSeconds,
      studentId,
      answers,
      currentQuestion: 0,
      flaggedIndices: [],
      questionOrder: orderedQuestions.map((question) => question.id),
      questionTimes: {},
    });
    setShowLockdownModal(false);
    setPhase("active");
    setTimeLeft(
      Math.min(totalSeconds, secondsUntilEndDatetime(exam?.end_datetime))
    );
    startLockdown(id, exam?.title || "Assessment");

    if (!fullscreenOk && !document.fullscreenElement) {
      // Second attempt right after lockdown UI settles (still tied to begin click).
      void enterAssessmentFullscreen();
    }
  };

  const continueExam = async () => {
    // Resume after crash / blackout / closed tab — user must click Continue.
    const fullscreenOk = await enterAssessmentFullscreen();
    setShowLockdownModal(false);
    setPhase("active");
    startLockdown(id, exam?.title || "Assessment");
    if (!fullscreenOk && !document.fullscreenElement) {
      void enterAssessmentFullscreen();
    }
  };

  const handleCancelLockdown = () => {
    setShowLockdownModal(false);
    navigate("/student/assessments");
  };

  const formatTime = () => {
    const hours = Math.floor(timeLeft / 3600);
    const minutes = Math.floor((timeLeft % 3600) / 60);
    const seconds = timeLeft % 60;

    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const currentQ = questions[currentQuestion];

  const setAnswer = (value) => {
    if (!currentQ?.id || !isActive || interactionLocked || !exam) return;

    const nextAnswers = {
      ...answers,
      [currentQ.id]: value,
    };
    setAnswers(nextAnswers);

    // Sync under-review flag immediately from answered state (no Next required).
    const answered = isQuestionAnswered(currentQ, exam.exam_type, nextAnswers);
    setFlaggedIndices((flags) => {
      const hasFlag = flags.has(currentQuestion);
      if (answered && hasFlag) {
        const updated = new Set(flags);
        updated.delete(currentQuestion);
        return updated;
      }
      if (!answered && !hasFlag) {
        // Re-flag only if the student already visited/left this item earlier
        // (auto-flag path). Manual flags cleared by answering stay cleared until leave.
        return flags;
      }
      return flags;
    });
  };

  const toggleFlag = () => {
    if (!isActive || !exam || !currentQ) return;

    setFlaggedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(currentQuestion)) {
        next.delete(currentQuestion);
      } else {
        next.add(currentQuestion);
      }
      return next;
    });
  };

  const goToQuestion = (index) => {
    if (!isActive || !exam) return;
    if (index >= 0 && index < questions.length && checkNavigable(index)) {
      flagIfUnansweredOnLeave(currentQuestion);
      const section = getSectionIndexForQuestion(index, navGroups);
      setFurthestSectionIndex((prev) => Math.max(prev, section));
      setCurrentQuestion(index);
    }
  };

  const goToNextUnanswered = () => {
    flagIfUnansweredOnLeave(currentQuestion);
    if (nextUnansweredIndex != null) {
      const section = getSectionIndexForQuestion(nextUnansweredIndex, navGroups);
      setFurthestSectionIndex((prev) => Math.max(prev, section));
      setCurrentQuestion(nextUnansweredIndex);
    }
  };

  const goToPrevious = () => {
    flagIfUnansweredOnLeave(currentQuestion);
    if (previousIndex != null) {
      setCurrentQuestion(previousIndex);
    }
  };

  const shellClass = `min-h-screen ${
    isActive ? "px-4 pt-6 pb-8 md:px-8 md:pt-8 md:pb-10" : "p-6 md:p-8"
  } ${
    theme === "dark" ? "bg-[#031d1f] text-white" : "en-bg-page text-gray-900"
  }`;

  if (showNetworkRecovery) {
    return (
      <ExamNetworkRecoveryOverlay
        title="Sorry — there was an internet interruption"
        message="We're retrying the connection for you now. Please stay on this page; your answers are safe on this device."
        detail={recoveryDetail}
      />
    );
  }

  if (loading || phase === "loading") {
    return <PageLoadingSkeleton theme={theme} variant="assessment" />;
  }

  if (alreadySubmitted || phase === "done") {
    // Submitted attempts redirect to results; keep a tiny fallback while navigating.
    return <PageLoadingSkeleton theme={theme} variant="assessment" />;
  }

  if (error || !exam || phase === "error") {
    return (
      <div className={shellClass}>
        <div
          className={`mt-4 rounded-2xl border p-5 ${
            theme === "dark"
              ? "border-white/10 bg-white/[0.04]"
              : "border-emerald-200 bg-white"
          }`}
        >
          <p className={`text-sm font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
            Couldn’t load this assessment
          </p>
          <p className={`mt-2 text-sm ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>
            {error || "Assessment not found."}
          </p>
        </div>
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div className={shellClass}>
        <p className="mt-4">No questions found for this assessment.</p>
      </div>
    );
  }

  if (phase === "ready") {
    return (
      <div className={shellClass}>
        <div className="mx-auto max-w-2xl pt-8">
          <h1
            className={`text-3xl font-bold ${
              theme === "dark" ? "text-white" : "text-gray-900"
            }`}
          >
            {exam.title}
          </h1>
          <p className={`mt-2 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
            {questions.length} item{questions.length === 1 ? "" : "s"} · Time limit:{" "}
            {formatDurationLabel(exam)}
          </p>
          {exam.instructions?.trim() && (
            <div
              className={`mt-6 rounded-2xl border p-5 ${
                theme === "dark"
                  ? "border-white/10 bg-white/5"
                  : "border-emerald-200/80 en-bg-elevated"
              }`}
            >
              <p className="text-sm font-semibold mb-2">Instructions</p>
              <p className={`text-sm whitespace-pre-wrap ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>
                {exam.instructions}
              </p>
            </div>
          )}
          <p className={`mt-6 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
            Review the lockdown rules, then begin when you are ready.
          </p>
        </div>

        <AssessmentLockdownModal
          open={showLockdownModal}
          examTitle={exam.title}
          durationLabel={formatDurationLabel(exam)}
          questionCount={questions.length}
          instructions={exam.instructions}
          maxStrikes={MAX_INTEGRITY_STRIKES}
          onConfirm={commenceExam}
          onCancel={handleCancelLockdown}
        />
      </div>
    );
  }

  if (phase === "resume") {
    const answered = Object.keys(answers || {}).length;
    return (
      <div className={shellClass}>
        <div className="mx-auto max-w-2xl pt-8">
          <h1
            className={`text-3xl font-bold ${
              theme === "dark" ? "text-white" : "text-gray-900"
            }`}
          >
            Continue assessment
          </h1>
          <p className={`mt-2 text-lg font-semibold ${theme === "dark" ? "text-emerald-300" : "text-teal-800"}`}>
            {exam.title}
          </p>
          <p className={`mt-4 text-sm leading-relaxed ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>
            Your previous attempt was saved on this device (browser crash, blackout, closed tab,
            or connection loss). Your timer is still running. Continue to restore lockdown and
            fullscreen, then pick up where you left off.
          </p>
          <div
            className={`mt-6 grid gap-3 rounded-2xl border p-4 text-sm sm:grid-cols-3 ${
              theme === "dark"
                ? "border-white/10 bg-white/5 text-gray-200"
                : "border-emerald-200 en-bg-elevated text-gray-800"
            }`}
          >
            <div>
              <p className="text-xs uppercase tracking-wide opacity-70">Time left</p>
              <p className="mt-1 font-semibold">{formatTime()}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide opacity-70">Answers saved</p>
              <p className="mt-1 font-semibold">
                {answered} / {questions.length}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide opacity-70">Integrity alerts used</p>
              <p className="mt-1 font-semibold">
                {integrityStrikes} / {MAX_INTEGRITY_STRIKES}
              </p>
            </div>
          </div>
          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => navigate("/student/assessments")}
              className={secondaryButton(theme)}
            >
              Back to assessments
            </button>
            <button type="button" onClick={continueExam} className={primaryButton(theme)}>
              Continue assessment
            </button>
          </div>
        </div>
      </div>
    );
  }

  const questionType = getQuestionFormatType(currentQ, exam.exam_type);
  const progress = questions.length
    ? (answeredCount / questions.length) * 100
    : 0;
  const headerLabel =
    exam.exam_type === "mixed"
      ? getFormatLabel(questionType)
      : EXAM_TYPE_LABELS[exam.exam_type] || getFormatLabel(questionType);

  return (
    <div className={shellClass}>
      <AssessmentFocusGuard
        open={isActive && focusBlocked && !autoSubmitting}
        integrityStrikes={integrityStrikes}
        maxStrikes={MAX_INTEGRITY_STRIKES}
        onContinue={() => clearFocusViolation()}
      />

      <IntegrityAlertToast
        message={integrityAlert}
        onDismiss={() => setIntegrityAlert("")}
      />

      <div className="mx-auto max-w-6xl">
        <AssessmentExamInstructionsBar
          instructions={exam.instructions}
          integrityStrikes={integrityStrikes}
          maxStrikes={MAX_INTEGRITY_STRIKES}
        />

        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p
              className={`text-xs font-semibold uppercase tracking-wide ${
                theme === "dark" ? "text-emerald-400" : "text-teal-700"
              }`}
            >
              {headerLabel}
            </p>
            <h1
              className={`mt-1 text-3xl font-bold ${
                theme === "dark" ? "text-white" : "text-gray-900"
              }`}
            >
              {exam.title}
            </h1>
            <p className={`mt-2 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
              Item {currentQuestion + 1} of {questions.length} · {answeredCount} answered
              {flaggedIndices.size > 0 && ` · ${flaggedIndices.size} flagged`}
            </p>
          </div>

          <div
            className={`rounded-2xl border px-5 py-3 text-center font-mono text-lg font-semibold ${
              theme === "dark"
                ? "border-red-500/30 bg-red-500/10 text-red-300"
                : "border-red-300 bg-red-50 text-red-700"
            }`}
          >
            {formatTime()}
          </div>
        </div>

        <div
          className={`mb-8 h-2 overflow-hidden rounded-full ${
            theme === "dark" ? "bg-white/10" : "en-bg-elevated-soft"
          }`}
        >
          <div
            className={`h-full rounded-full transition-all ${
              theme === "dark" ? "bg-emerald-400" : "bg-teal-500"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <AssessmentQuestionNav
            groups={navGroups}
            currentIndex={currentQuestion}
            answersByQuestionId={answers}
            flaggedIndices={flaggedIndices}
            examType={exam.exam_type}
            getQuestionFormatType={getQuestionFormatType}
            isAnswerProvided={isAnswerProvided}
            isIndexNavigable={checkNavigable}
            isSectionLocked={checkSectionLocked}
            onSelect={goToQuestion}
          />

          <div>
            <div
              className={`rounded-2xl border p-6 md:p-8 ${
                theme === "dark"
                  ? "border-white/10 bg-white/5"
                  : "border-emerald-200/80 en-bg-elevated shadow-md"
              }`}
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <span
                  className={`text-sm font-medium ${
                    theme === "dark" ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  Question {currentQuestion + 1}
                </span>

                <button
                  type="button"
                  onClick={toggleFlag}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                    flaggedIndices.has(currentQuestion)
                      ? theme === "dark"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        : "bg-amber-100 text-amber-900 border border-amber-300"
                      : theme === "dark"
                        ? "bg-white/5 text-gray-300 border border-white/10 hover:bg-amber-500/10 hover:text-amber-300"
                        : "en-bg-elevated text-gray-700 border border-emerald-200 hover:bg-amber-50 hover:text-amber-900"
                  }`}
                >
                  <Flag size={14} />
                  Flag answer
                </button>
              </div>

              <h2
                className={`mb-6 text-xl font-semibold leading-relaxed md:text-2xl ${
                  theme === "dark" ? "text-white" : "text-gray-900"
                }`}
              >
                {currentQ.question}
              </h2>

              <AssessmentQuestionInput
                question={currentQ}
                examType={questionType}
                value={answers[currentQ.id]}
                onChange={setAnswer}
              />
            </div>

            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                disabled={previousIndex == null}
                onClick={goToPrevious}
                className={secondaryButton(theme, "disabled:opacity-30")}
              >
                Previous
              </button>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                {nextUnansweredIndex != null && !canSubmit && (
                  <button
                    type="button"
                    onClick={goToNextUnanswered}
                    className={primaryButton(theme)}
                  >
                    Next question
                  </button>
                )}

                {canSubmit && (
                  <button
                    type="button"
                    disabled={submitting || interactionLocked}
                    onClick={() => setConfirmSubmitOpen(true)}
                    className={primaryButton(theme, "disabled:opacity-60")}
                  >
                    {submitting ? "Submitting..." : "Submit"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <ActionDialog
        open={confirmSubmitOpen}
        title="Submit your answers?"
        confirmLabel="Submit"
        cancelLabel="Keep working"
        onConfirm={handleConfirmSubmit}
        onCancel={() => setConfirmSubmitOpen(false)}
        loading={submitting}
      >
        {buildSubmitConfirmMessage()}
      </ActionDialog>

      <SubmissionSuccessOverlay
        open={resultDialog?.tone === "success"}
        message={resultDialog?.message}
        onComplete={handleSubmissionSuccessComplete}
      />

      <ActionDialog
        open={Boolean(resultDialog && resultDialog.tone !== "success")}
        title={resultDialog?.title || ""}
        confirmLabel="OK"
        showCancel={false}
        tone="danger"
        onConfirm={handleResultDialogClose}
        onCancel={handleResultDialogClose}
      >
        {resultDialog?.message}
      </ActionDialog>
    </div>
  );
}
