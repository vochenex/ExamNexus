import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Flag } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { useTheme } from "../../layouts/ThemeContext";
import { useAssessmentLockdown } from "../../contexts/AssessmentLockdownContext";
import { primaryButton, secondaryButton } from "../../utils/themeButtons";
import BackButton from "../../components/BackButton";
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
  shouldShowSubmitButton,
  shuffleQuestionsForStudent,
  orderQuestionsByIds,
} from "../../utils/assessmentTake";
import {
  formatAssessmentDurationLabel,
  getAssessmentDurationSeconds,
} from "../../utils/assessmentDuration";
import { resolveStudentId } from "../../utils/authUser";
import { isNativeApp, openOnWebsite } from "../../utils/platform";
import {
  clearExamSession,
  computeRemainingSeconds,
  enterAssessmentFullscreen,
  exitAssessmentFullscreen,
  loadExamSession,
  loadIntegrityStrikes,
  MAX_INTEGRITY_STRIKES,
  saveExamSession,
} from "../../utils/examIntegrity";

function formatDurationLabel(examData) {
  return formatAssessmentDurationLabel(examData);
}

/**
 * Assessments can never be taken inside the native mobile app — the integrity
 * lockdown (fullscreen, tab-switch detection) only works in a real browser.
 * If a student reaches this route in the app (notification, deep link), we
 * redirect to the website and never mount the heavy exam experience.
 */
export default function TakeAssessment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();

  useEffect(() => {
    if (!isNativeApp()) return;
    openOnWebsite(`/student/take-assessment/${id}`);
    navigate("/student/assessments", { replace: true });
  }, [id, navigate]);

  if (isNativeApp()) {
    return (
      <div
        className={`flex min-h-[60vh] flex-col items-center justify-center gap-3 p-8 text-center ${
          theme === "dark" ? "text-gray-300" : "text-gray-700"
        }`}
      >
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-500" />
        <p className="text-sm font-medium">Opening the assessment on the website…</p>
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
  const alertTimerRef = useRef(null);
  const submitExamRef = useRef(null);
  const autoSubmittingRef = useRef(false);

  const isActive = phase === "active";
  const interactionLocked =
    submitting || confirmSubmitOpen || Boolean(resultDialog) || autoSubmitting;

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
      showIntegrityAlert(
        `Integrity violation recorded (${strikes}/${maxStrikes}). ${remaining} alert${remaining === 1 ? "" : "s"} left before auto-submit.`
      );
    },
    [showIntegrityAlert]
  );

  const handleAutoSubmit = useCallback(() => {
    if (autoSubmittingRef.current) return;
    autoSubmittingRef.current = true;
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

  const { clearFocusViolation } = useAssessmentIntegrity({
    examId: id,
    active: isActive,
    isRetakeAttempt,
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

        const submitted = await hasStudentSubmittedExam(id);
        if (submitted) {
          setAlreadySubmitted(true);
          setLoading(false);
          setPhase("done");
          endLockdown();
          await exitAssessmentFullscreen();
          return;
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

        if (saved?.commenced && saved.startedAt) {
          const sessionTotalSeconds = Number(saved.totalSeconds);
          const activeTotalSeconds =
            Number.isFinite(sessionTotalSeconds) && sessionTotalSeconds > 0
              ? sessionTotalSeconds
              : durationSeconds;
          const remaining = computeRemainingSeconds(saved.startedAt, activeTotalSeconds);

          if (remaining > 0) {
            orderedQuestions = saved.questionOrder?.length
              ? orderQuestionsByIds(uniqueQuestions, saved.questionOrder)
              : uniqueQuestions;
            resumeSession = { saved, activeTotalSeconds, remaining };
          } else {
            clearExamSession(id);
          }
        }

        setExam(examData);
        setQuestions(orderedQuestions);
        setTotalSeconds(durationSeconds);

        if (resumeSession) {
          const { saved: session, activeTotalSeconds, remaining } = resumeSession;
          setAnswers(session.answers || {});
          setCurrentQuestion(session.currentQuestion || 0);
          setFlaggedIndices(new Set(session.flaggedIndices || []));
          setTimeLeft(remaining);
          setTotalSeconds(activeTotalSeconds);
          replaceTimes(session.questionTimes || {});
          setIntegrityStrikes(loadIntegrityStrikes(id));
          setPhase("active");
          setShowLockdownModal(false);
          startLockdown(id, examData.title);
        } else {
          setTimeLeft(durationSeconds);
          setPhase("ready");
          setShowLockdownModal(true);
        }
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to load assessment.");
        setPhase("error");
      } finally {
        setLoading(false);
      }
    };

    loadExam();
  }, [id, startLockdown, endLockdown]);

  useEffect(() => {
    if (!isActive || !id) return;

    const existing = loadExamSession(id);

    saveExamSession(id, {
      commenced: true,
      startedAt: existing?.startedAt || new Date().toISOString(),
      totalSeconds: existing?.totalSeconds || totalSeconds,
      studentId,
      answers,
      currentQuestion,
      flaggedIndices: [...flaggedIndices],
      questionOrder: existing?.questionOrder || questions.map((question) => question.id),
      questionTimes: getTimesSnapshot(),
    });
  }, [
    answers,
    currentQuestion,
    flaggedIndices,
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

  const checkNavigable = useCallback(
    (index) =>
      exam
        ? isIndexNavigable(index, navGroups, questions, exam.exam_type, answers)
        : false,
    [answers, exam, navGroups, questions]
  );

  const checkSectionLocked = useCallback(
    (groupIndex) =>
      exam
        ? isSectionLocked(groupIndex, navGroups, questions, exam.exam_type, answers)
        : true,
    [answers, exam, navGroups, questions]
  );

  const previousIndex = useMemo(
    () =>
      exam
        ? getPreviousNavigableIndex(
            currentQuestion,
            navGroups,
            questions,
            exam.exam_type,
            answers
          )
        : null,
    [answers, currentQuestion, exam, navGroups, questions]
  );

  const nextUnansweredIndex = useMemo(
    () =>
      exam
        ? getNextUnansweredIndex(
            currentQuestion,
            questions,
            exam.exam_type,
            answers,
            navGroups
          )
        : null,
    [answers, currentQuestion, exam, navGroups, questions]
  );

  useEffect(() => {
    if (!isActive || !exam || !questions.length) return;

    if (!isIndexNavigable(currentQuestion, navGroups, questions, exam.exam_type, answers)) {
      const fallback =
        getNextUnansweredIndex(
          -1,
          questions,
          exam.exam_type,
          answers,
          navGroups
        ) ??
        navGroups
          .flatMap((group) => group.items)
          .find((item) =>
            isIndexNavigable(item.index, navGroups, questions, exam.exam_type, answers)
          )?.index;

      if (fallback != null && fallback !== currentQuestion) {
        setCurrentQuestion(fallback);
      }
    }
  }, [isActive, exam, questions, navGroups, answers, currentQuestion]);

  const submitExam = useCallback(async (options = {}) => {
    const { reason } = options;
    if (submitting || submitBlocked) return;

    try {
      setSubmitting(true);
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
        exitLockdown: autoSubmitted,
      });
    } catch (err) {
      const alreadySubmitted = /already submitted/i.test(err.message || "");
      if (alreadySubmitted) {
        setSubmitBlocked(true);
        clearExamSession(id);
      }

      setResultDialog({
        tone: "danger",
        title: alreadySubmitted ? "Already submitted" : "Submission failed",
        message: alreadySubmitted
          ? "This attempt could not be saved because a submission already exists. You have been returned to your assessments list."
          : err.message || "Could not submit your answers. Please try again.",
        exitLockdown: alreadySubmitted,
      });
    } finally {
      setSubmitting(false);
    }
  }, [
    answers,
    exam,
    flushCurrentQuestionTime,
    getTimesSnapshot,
    id,
    questions,
    submitBlocked,
    submitting,
  ]);

  submitExamRef.current = submitExam;

  const handleResultDialogClose = useCallback(async () => {
    const dialog = resultDialog;
    setResultDialog(null);

    if (dialog?.tone === "success" || dialog?.exitLockdown) {
      setSubmitBlocked(true);
      endLockdown();
      await exitAssessmentFullscreen();
      navigate("/student/assessments");
    }
  }, [endLockdown, navigate, resultDialog]);

  const handleSubmissionSuccessComplete = useCallback(async () => {
    setResultDialog(null);
    setSubmitBlocked(true);
    endLockdown();
    await exitAssessmentFullscreen();
    navigate("/student/assessments");
  }, [endLockdown, navigate]);

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
    setTimeLeft(totalSeconds);
    startLockdown(id, exam?.title || "Assessment");
    await enterAssessmentFullscreen();
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

    setAnswers((prev) => ({
      ...prev,
      [currentQ.id]: value,
    }));

    const questionType = getQuestionFormatType(currentQ, exam.exam_type);
    if (isAnswerProvided(value, questionType)) {
      setFlaggedIndices((prev) => {
        if (!prev.has(currentQuestion)) return prev;
        const next = new Set(prev);
        next.delete(currentQuestion);
        return next;
      });
    }
  };

  const toggleFlag = () => {
    if (!isActive) return;
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
      setCurrentQuestion(index);
    }
  };

  const goToNextUnanswered = () => {
    if (nextUnansweredIndex != null) {
      setCurrentQuestion(nextUnansweredIndex);
    }
  };

  const goToPrevious = () => {
    if (previousIndex != null) {
      setCurrentQuestion(previousIndex);
    }
  };

  const shellClass = `min-h-screen ${
    isActive ? "px-4 pt-6 pb-8 md:px-8 md:pt-8 md:pb-10" : "p-6 md:p-8"
  } ${
    theme === "dark" ? "bg-[#031d1f] text-white" : "en-bg-page text-gray-900"
  }`;

  if (loading || phase === "loading") {
    return <PageLoadingSkeleton theme={theme} variant="assessment" />;
  }

  if (alreadySubmitted || phase === "done") {
    return (
      <div className={shellClass}>
        <BackButton />
        <p className="mt-4">You have already submitted this assessment.</p>
        <button
          type="button"
          className={`mt-4 ${secondaryButton(theme)}`}
          onClick={() => navigate("/student/assessments")}
        >
          Back to assessments
        </button>
      </div>
    );
  }

  if (error || !exam || phase === "error") {
    return (
      <div className={shellClass}>
        <BackButton />
        <p className="mt-4 text-red-500">{error || "Assessment not found."}</p>
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div className={shellClass}>
        <BackButton />
        <p className="mt-4">No questions found for this assessment.</p>
      </div>
    );
  }

  if (phase === "ready") {
    return (
      <div className={shellClass}>
        <BackButton />
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
