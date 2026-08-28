import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useTheme } from "../../layouts/ThemeContext";
import { useAppModal } from "../../contexts/AppModalContext";
import { useNavigate, useLocation } from "react-router-dom";
import BackButton from "../../components/BackButton";
import { ClipboardList, Settings } from "lucide-react";
import AssessmentSchedule from "../../components/AssessmentSchedule";
import SectionPicker from "../../components/SectionPicker";
import {
  AssessmentTypeSelect,
} from "../../components/QuestionBuilderCard";
import {
  assessmentPanelClass,
  assessmentInputClass,
} from "../../utils/assessmentFormStyles";
import AssessmentSettingsPanel from "../../components/AssessmentSettingsPanel";
import FormatGradingSettings from "../../components/FormatGradingSettings";
import AssessmentPointsPanel from "../../components/AssessmentPointsPanel";
import CollapsiblePanel from "../../components/ui/CollapsiblePanel";
import QuestionFormatPrompt from "../../components/QuestionFormatPrompt";
import QuestionSectionsPanel from "../../components/QuestionSectionsPanel";
import QuestionBankPicker from "../../components/QuestionBankPicker";
import AssessmentAiGenerator from "../../components/AssessmentAiGenerator";
import AiGenerationProgress from "../../components/AiGenerationProgress";
import { mapAiQuestionToBuilder, mapAiPayloadToBuilderQuestions } from "../../utils/aiQuestionMapper";
import { getSubjectSections } from "../../utils/sections";
import { createExam } from "../../utils/supabaseData";
import { pageShellWithBellClass } from "../../utils/themeInputs";
import { supabase } from "../../supabaseClient";
import {
  canFacultyManageSubjects,
  FACULTY_AVATAR_REQUIRED_MESSAGE,
  isFacultyRole,
} from "../../utils/avatar";
import { serializeQuestionForDb } from "../../utils/assessmentQuestions";
import { getAssessmentCategoryLabel } from "../../utils/assessmentCategories";
import useQuestionSections from "../../hooks/useQuestionSections";
import { saveQuestionToBank } from "../../utils/questionBank";
import { useScrollIntoViewWhen } from "../../hooks/useScrollIntoViewWhen";

const defaultAssessment = {
  subject_id: "",
  title: "",
  description: "",
  exam_type: "multiple_choice",
  instructions: "",
  allow_review: true,
  shuffle_questions: false,
  lock_completed_sections: false,
  show_result: true,
  show_question_review: true,
  show_correct_answers: true,
  pass_mark: 50,
  duration_value: 60,
  duration_unit: "minutes",
};

export default function CreateAssessment() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const { warning: showWarning, success: showSuccess, error: showError, choose } = useAppModal();

  useLayoutEffect(() => {
    const scrollToTop = () => {
      const mainScroller = document.querySelector("main.en-scroll-region");
      if (mainScroller) mainScroller.scrollTop = 0;
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    scrollToTop();
    const timer = window.setTimeout(scrollToTop, 0);
    return () => window.clearTimeout(timer);
  }, [location.pathname, location.key]);

  const assessmentType = location.state?.type || "exam";
  const assessmentLabel = getAssessmentCategoryLabel(assessmentType);
  const selectedSubject = location.state?.subject;
  const subjectSections = getSubjectSections(selectedSubject);

  const [dateRange, setDateRange] = useState();
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [targetSections, setTargetSections] = useState(() => [...subjectSections]);
  const [exam, setExam] = useState(defaultAssessment);
  const [loading, setLoading] = useState(false);
  const [savingToBankId, setSavingToBankId] = useState(null);
  const [error, setError] = useState("");
  const [fieldErrorsByIndex, setFieldErrorsByIndex] = useState({});
  const [creationMode, setCreationMode] = useState("manual");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiProgress, setAiProgress] = useState(null);
  const [bankPickerOpen, setBankPickerOpen] = useState(false);
  const applyAiExamDetailsRef = useRef(false);
  const aiReplaceSnapshotRef = useRef(null);
  const aiMergeModeRef = useRef("replace");

  const {
    questionSections,
    activeSectionId,
    activeFormat,
    questions,
    formatPrompt,
    gradingSections,
    setActiveSectionId,
    handleFormatChange,
    confirmAddFormatSection,
    cancelFormatChange,
    addQuestionToSection,
    updateQuestion,
    updateChoice,
    updateEnumAnswer,
    updateSectionGrading,
    addEnumAnswer,
    removeEnumAnswer,
    addEnumSlotAlternative,
    updateEnumSlotAlternative,
    removeEnumSlotAlternative,
    addAlternativeAnswer,
    updateAlternativeAnswer,
    removeAlternativeAnswer,
    deleteQuestion,
    validateAllQuestions,
    getQuestionsForSave,
    getExamTypeForSave,
    initializeFromLoadedQuestions,
    resetForAiGeneration,
    appendAiQuestion,
    importBankQuestions,
    questionHasContent,
  } = useQuestionSections(defaultAssessment.exam_type);

  const cachedUser = JSON.parse(localStorage.getItem("examnexus_user") || "{}");
  const [facultyProfile, setFacultyProfile] = useState(cachedUser);
  const facultyCanManage = canFacultyManageSubjects(facultyProfile);

  useEffect(() => {
    const loadFacultyProfile = async () => {
      if (!cachedUser.id || !isFacultyRole(cachedUser.role)) return;

      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("id", cachedUser.id)
        .single();

      if (data) {
        setFacultyProfile(data);
        localStorage.setItem("examnexus_user", JSON.stringify(data));
      }
    };

    loadFacultyProfile();
  }, [cachedUser.id, cachedUser.role]);

  useEffect(() => {
    if (isFacultyRole(facultyProfile.role) && !facultyCanManage) {
      showWarning(FACULTY_AVATAR_REQUIRED_MESSAGE, "Profile photo required");
      navigate("/faculty/profile");
    }
  }, [facultyProfile.role, facultyCanManage, navigate, showWarning]);

  const clearError = () => setError("");
  const clearFieldErrors = (questionIndex) => {
    if (questionIndex == null) {
      setFieldErrorsByIndex({});
      return;
    }
    setFieldErrorsByIndex((prev) => {
      if (!prev[questionIndex]) return prev;
      const next = { ...prev };
      delete next[questionIndex];
      return next;
    });
  };
  const clearQuestionFeedback = (questionIndex) => {
    clearError();
    clearFieldErrors(questionIndex);
  };

  const handleAddQuestionToSection = (sectionId) => {
    clearError();
    const result = addQuestionToSection(sectionId);
    if (!result?.ok && result?.reason === "incomplete_question") {
      setFieldErrorsByIndex({ [result.questionIndex]: result.fields });
      return;
    }
    clearFieldErrors();
  };

  const handleSaveQuestionToBank = async (question) => {
    if (savingToBankId != null) return;
    const key = question.id || question._clientId || question.question || Date.now();
    try {
      setSavingToBankId(key);
      await saveQuestionToBank(question);
      showSuccess("Question saved to your bank.");
    } catch (err) {
      showError(err.message || "Could not save question to bank.");
    } finally {
      setSavingToBankId(null);
    }
  };

  const handleImportFromBank = (bankQuestions) => {
    importBankQuestions(bankQuestions);
    showSuccess(
      `${bankQuestions.length} question${bankQuestions.length === 1 ? "" : "s"} imported from your bank.`
    );
  };

  const onFormatChange = (nextType) => {
    clearError();
    const resolvedType = handleFormatChange(nextType);
    setExam((prev) => ({ ...prev, exam_type: resolvedType }));
  };

  const onConfirmFormatSection = () => {
    const resolvedType = confirmAddFormatSection();
    setExam((prev) => ({ ...prev, exam_type: resolvedType }));
  };

  const resolveExamTypeFromMapped = (mappedQuestions) => {
    const types = [...new Set(mappedQuestions.map((item) => item.type).filter(Boolean))];
    if (types.length === 0) return defaultAssessment.exam_type;
    if (types.length === 1) return types[0];
    return "mixed";
  };

  const handleAiGenerationStart = async (options = {}) => {
    const hasExisting = questions.some((question) => questionHasContent(question));
    let mode = "replace";

    if (options?.preferredMode === "append") {
      mode = "append";
    } else if (hasExisting) {
      const choice = await choose({
        title: "Questions already on this page",
        message:
          "How should AI-generated questions interact with what you already have? Title and description still refresh from the AI result when you replace.",
        tone: "warning",
        actions: [
          { id: "replace", label: "Replace all", tone: "warning" },
          { id: "append", label: "Add to current", variant: "secondary" },
          { id: "cancel", label: "Keep current", variant: "secondary" },
        ],
      });

      if (!choice || choice === "cancel" || choice === false) {
        return { mode: "cancel" };
      }
      mode = choice === "append" ? "append" : "replace";
    }

    aiMergeModeRef.current = mode;

    // Snapshot exam fields so classify-only / failed runs can restore them.
    aiReplaceSnapshotRef.current = {
      questions: questions.map((question) => ({ ...question })),
      examType: getExamTypeForSave() || exam.exam_type || "multiple_choice",
      title: exam.title,
      description: exam.description,
      mode,
    };

    applyAiExamDetailsRef.current = mode === "replace";

    if (mode === "replace") {
      resetForAiGeneration();
      setExam((prev) => ({
        ...prev,
        title: "",
        description: "",
      }));
    }

    setAiGenerating(true);
    setAiProgress(null);
    setError("");
    return { mode };
  };

  const resolveAiExamField = (currentValue, suggestedValue) => {
    if (applyAiExamDetailsRef.current && suggestedValue) {
      return suggestedValue;
    }
    const trimmed = String(currentValue || "").trim();
    return trimmed || suggestedValue || currentValue;
  };

  const handleAiQuestionGenerated = (event) => {
    const mapped = mapAiQuestionToBuilder(event.question);
    if (!mapped) return;

    appendAiQuestion(mapped);

    setAiProgress((prev) => {
      const current = (event.index ?? 0) + 1;
      const total = event.total ?? prev?.total;
      const percent =
        total > 0 ? Math.min(99, Math.round((current / total) * 99)) : prev?.percent;
      return {
        ...(prev || {}),
        phase: event.phase || prev?.phase,
        current,
        total,
        latestType: mapped.type,
        percent,
        status: "revealing",
      };
    });

    if (event.suggestedTitle || event.suggestedDescription) {
      setExam((prev) => ({
        ...prev,
        title: resolveAiExamField(prev.title, event.suggestedTitle),
        description: resolveAiExamField(prev.description, event.suggestedDescription),
      }));
    }
  };

  const restoreAiReplaceSnapshot = () => {
    const snapshot = aiReplaceSnapshotRef.current;
    if (!snapshot) return;

    // Append mode never clears the builder — re-init would remint section ids and
    // briefly orphan questions if anything goes wrong mid-flight.
    if (snapshot.mode === "append") {
      aiReplaceSnapshotRef.current = null;
      return;
    }

    initializeFromLoadedQuestions(snapshot.questions, snapshot.examType);
    setExam((prev) => ({
      ...prev,
      title: snapshot.title,
      description: snapshot.description,
    }));
    aiReplaceSnapshotRef.current = null;
  };

  const handleAiGenerationComplete = (payload) => {
    if (payload?.classifiedOnly) {
      setAiGenerating(false);
      setAiProgress(null);
      applyAiExamDetailsRef.current = false;
      restoreAiReplaceSnapshot();
      return;
    }

    const mappedQuestions = mapAiPayloadToBuilderQuestions(payload);
    const mergeMode = aiMergeModeRef.current || "replace";

    setAiGenerating(false);

    if (!mappedQuestions.length) {
      setAiProgress(null);
      applyAiExamDetailsRef.current = false;
      if (mergeMode === "append") {
        // Keep questionnaire (or prior) questions; only report the source failure.
        aiReplaceSnapshotRef.current = null;
        return;
      }
      restoreAiReplaceSnapshot();
      return;
    }

    aiReplaceSnapshotRef.current = null;

    setAiProgress((prev) => ({
      ...(prev || {}),
      status: "done",
      percent: 100,
      current: mappedQuestions.length,
      total: mappedQuestions.length,
    }));

    setExam((prev) => {
      const nextType = resolveExamTypeFromMapped(mappedQuestions);
      let examType = nextType;
      if (mergeMode === "append" && prev.exam_type) {
        if (prev.exam_type === "mixed" || prev.exam_type !== nextType) {
          examType = "mixed";
        }
      }
      return {
        ...prev,
        title: resolveAiExamField(prev.title, payload.suggestedTitle),
        description: resolveAiExamField(prev.description, payload.suggestedDescription),
        exam_type: examType,
      };
    });
    applyAiExamDetailsRef.current = false;
  };

  const handleAiError = (message) => {
    // AI errors render inside AssessmentAiGenerator; only restore page state here.
    if (!message) return;
    restoreAiReplaceSnapshot();
    setAiGenerating(false);
    setAiProgress(null);
    applyAiExamDetailsRef.current = false;
  };

  const clearAiError = () => {
    // Intentionally empty for AI panel clears — page banner is for publish/validation only.
  };

  const showQuestionPanel =
    creationMode === "manual" || questions.length > 0;

  const showAiProgress = aiGenerating || aiProgress?.status === "done";
  const errorFeedbackRef = useScrollIntoViewWhen(Boolean(error), { deps: [error] });
  const aiResultsRef = useScrollIntoViewWhen(
    aiProgress?.status === "done" && questions.length > 0,
    { deps: [aiProgress?.status, questions.length] }
  );

  const handlePublish = async () => {
    try {
      setLoading(true);
      setError("");

      if (!exam.title.trim()) {
        setError("Please enter an assessment title.");
        setLoading(false);
        return;
      }

      if (questions.length === 0) {
        setError("Add at least one question before publishing.");
        setLoading(false);
        return;
      }

      const passMark = Number(exam.pass_mark);
      if (!Number.isFinite(passMark) || passMark < 0 || passMark > 100) {
        setError("Set a passing rate between 0 and 100% in Settings.");
        setLoading(false);
        return;
      }

      const validation = validateAllQuestions();
      if (validation) {
        setFieldErrorsByIndex(validation.errorsByIndex || {});
        setLoading(false);
        return;
      }

      clearFieldErrors();

      const questionsToSave = getQuestionsForSave();
      const formattedQuestions = questionsToSave
        .filter((q) => q.question.trim())
        .map((q) => serializeQuestionForDb(q));

      const user = JSON.parse(localStorage.getItem("examnexus_user") || "{}");

      await createExam(
        {
          ...exam,
          exam_type: getExamTypeForSave(),
          assessment_category: assessmentType,
          start_datetime: dateRange?.from
            ? `${dateRange.from.toISOString().split("T")[0]}T${startTime}`
            : null,
          end_datetime: dateRange?.to
            ? `${dateRange.to.toISOString().split("T")[0]}T${endTime}`
            : null,
          subject_id: selectedSubject?.id || "",
          created_by: user.id || null,
          target_sections: targetSections,
        },
        formattedQuestions
      );

      navigate("/faculty/dashboard", {
        state: {
          notice: {
            variant: "success",
            message: `${assessmentLabel} published`,
          },
        },
      });
    } catch (err) {
      setError(err.message || "Failed to publish assessment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={pageShellWithBellClass(theme)}>
      <BackButton />

      <div className="mb-8">
        <h1
          className={`text-3xl font-bold ${
            theme === "dark" ? "text-emerald-400" : "text-teal-700"
          }`}
        >
          Create {assessmentLabel}
        </h1>
        <p className={`mt-1 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
          Build manually, generate from a document or prompt, then review and publish.
        </p>

        <div
          className={`mt-4 grid w-full max-w-full grid-cols-3 gap-1 rounded-xl border p-1 ${
            theme === "dark"
              ? "border-white/10 bg-white/[0.03]"
              : "border-emerald-700/20 en-bg-elevated en-panel-glow"
          }`}
        >
          {[
            { id: "manual", label: "Manual" },
            { id: "document", label: "Upload" },
            { id: "prompt", label: "AI prompt" },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setCreationMode(option.id);
                clearError();
              }}
              className={`min-w-0 rounded-lg px-1.5 py-2 text-center text-xs font-medium transition sm:px-3 sm:text-sm ${
                creationMode === option.id
                  ? theme === "dark"
                    ? "bg-emerald-500 text-[#031d1f]"
                    : "bg-teal-600 text-white"
                  : theme === "dark"
                    ? "text-gray-300 hover:bg-white/5"
                    : "text-gray-700 hover:bg-emerald-50"
              }`}
            >
              <span className="block truncate sm:hidden">{option.label}</span>
              <span className="hidden sm:block">
                {option.id === "document" ? "Upload document" : option.label}
              </span>
            </button>
          ))}
        </div>
        {selectedSubject && (
          <p className={`mt-2 text-sm font-medium ${theme === "dark" ? "text-emerald-300" : "text-teal-800"}`}>
            Subject: {selectedSubject.name}
          </p>
        )}
      </div>

      {error && (
        <div
          ref={errorFeedbackRef}
          role="status"
          className={`mb-4 rounded-xl border p-3 text-sm ${
            theme === "dark"
              ? "border-red-500/30 bg-red-500/10 text-red-200"
              : "border-red-300 bg-red-50 text-red-700"
          }`}
        >
          {error}
        </div>
      )}

      <div className="mx-auto w-full max-w-[min(100%,1760px)]">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 xl:items-start xl:gap-8">
          <div className="space-y-6 xl:col-span-3">
            <div className={`${assessmentPanelClass(theme)} space-y-4`}>
              <div className="flex items-center gap-2">
                <ClipboardList className="text-emerald-400" size={18} />
                <h2 className="font-semibold">{assessmentLabel} details</h2>
              </div>

              <input
                className={assessmentInputClass(theme)}
                placeholder="Assessment title"
                value={exam.title}
                onChange={(e) => setExam({ ...exam, title: e.target.value })}
              />

              <textarea
                className={assessmentInputClass(theme)}
                rows={3}
                placeholder="Description (optional)"
                value={exam.description}
                onChange={(e) => setExam({ ...exam, description: e.target.value })}
              />

              <SectionPicker
                value={targetSections}
                onChange={setTargetSections}
                sections={subjectSections}
                label="Assign to sections"
                hint="Only students in the selected sections can take this assessment."
              />

              {creationMode === "manual" && (
                <AssessmentTypeSelect
                  value={activeFormat}
                  onChange={onFormatChange}
                  hint="Switching format with existing questions creates a new section instead of removing them."
                />
              )}
            </div>

            <AssessmentSchedule
              dateRange={dateRange}
              setDateRange={setDateRange}
              startTime={startTime}
              setStartTime={setStartTime}
              endTime={endTime}
              setEndTime={setEndTime}
            />
          </div>

          <div className={`${assessmentPanelClass(theme)} min-h-[420px] xl:col-span-6`}>
            {creationMode !== "manual" && (
              <div className={showQuestionPanel ? "mb-6" : ""}>
                <AssessmentAiGenerator
                  mode={creationMode}
                  disabled={loading || aiGenerating}
                  onGenerationStart={handleAiGenerationStart}
                  onQuestionGenerated={handleAiQuestionGenerated}
                  onProgress={setAiProgress}
                  onGenerated={handleAiGenerationComplete}
                  onError={handleAiError}
                  onClearError={clearAiError}
                />
                {showAiProgress && (
                  <div ref={aiResultsRef} className="mt-6">
                    <AiGenerationProgress
                      progress={aiProgress}
                      questionCount={questions.length}
                      active={aiGenerating}
                    />
                  </div>
                )}
              </div>
            )}

            {showQuestionPanel && (
              <QuestionSectionsPanel
                  questionSections={questionSections}
                  activeSectionId={activeSectionId}
                  questions={questions}
                  fieldErrorsByIndex={fieldErrorsByIndex}
                  onAddQuestionToSection={handleAddQuestionToSection}
                  onUpdateQuestion={(index, field, value) =>
                    updateQuestion(index, field, value, clearQuestionFeedback)
                  }
                  onUpdateChoice={(qIndex, cIndex, value) =>
                    updateChoice(qIndex, cIndex, value, clearQuestionFeedback)
                  }
                  onUpdateEnumAnswer={(qIndex, aIndex, value) =>
                    updateEnumAnswer(qIndex, aIndex, value, clearQuestionFeedback)
                  }
                  onAddEnumAnswer={addEnumAnswer}
                  onRemoveEnumAnswer={removeEnumAnswer}
                  onAddEnumSlotAlternative={addEnumSlotAlternative}
                  onUpdateEnumSlotAlternative={(qIndex, aIndex, altIndex, value) =>
                    updateEnumSlotAlternative(
                      qIndex,
                      aIndex,
                      altIndex,
                      value,
                      clearQuestionFeedback
                    )
                  }
                  onRemoveEnumSlotAlternative={removeEnumSlotAlternative}
                  onAddAlternativeAnswer={addAlternativeAnswer}
                  onUpdateAlternativeAnswer={(qIndex, aIndex, value) =>
                    updateAlternativeAnswer(qIndex, aIndex, value, clearQuestionFeedback)
                  }
                  onRemoveAlternativeAnswer={removeAlternativeAnswer}
                  onDeleteQuestion={(index) => {
                    clearFieldErrors();
                    deleteQuestion(index);
                  }}
                  onSelectSection={setActiveSectionId}
                  onSaveQuestionToBank={handleSaveQuestionToBank}
                  savingToBankId={savingToBankId}
                  onImportFromBank={() => setBankPickerOpen(true)}
              />
            )}
          </div>

          <div className={`${assessmentPanelClass(theme)} space-y-4 xl:col-span-3 xl:sticky xl:top-6`}>
            <div className="flex items-center gap-2">
              <Settings className="text-emerald-400" size={18} />
              <h2 className="font-semibold">Settings</h2>
            </div>

            {questionSections.length > 0 && (
              <CollapsiblePanel
                title="Points per question"
                subtitle="Default points for each question format"
                defaultOpen={false}
              >
                <AssessmentPointsPanel
                  sections={questionSections}
                  onChange={(sectionId, grading) =>
                    updateSectionGrading(sectionId, grading, clearError)
                  }
                />
              </CollapsiblePanel>
            )}

            {gradingSections.length > 0 && (
              <CollapsiblePanel
                title="Format grading"
                subtitle={`${gradingSections.length} format section${gradingSections.length === 1 ? "" : "s"}`}
                defaultOpen={false}
              >
                <div className="space-y-3">
                  {gradingSections.map((section) => (
                    <FormatGradingSettings
                      key={section.id}
                      sectionType={section.type}
                      gradingDefaults={section.gradingDefaults}
                      compact
                      onChange={(grading) =>
                        updateSectionGrading(section.id, grading, clearError)
                      }
                    />
                  ))}
                </div>
              </CollapsiblePanel>
            )}

            <AssessmentSettingsPanel
              exam={exam}
              theme={theme}
              loading={loading}
              publishLabel={`Publish ${assessmentLabel}`}
              onPublish={handlePublish}
              onChange={(patch) => setExam((prev) => ({ ...prev, ...patch }))}
            />
          </div>
        </div>
      </div>

      <QuestionFormatPrompt
        open={Boolean(formatPrompt)}
        nextType={formatPrompt?.nextType}
        currentType={formatPrompt?.currentType}
        onConfirm={onConfirmFormatSection}
        onCancel={cancelFormatChange}
      />

      <QuestionBankPicker
        open={bankPickerOpen}
        onClose={() => setBankPickerOpen(false)}
        onImport={handleImportFromBank}
      />
    </div>
  );
}
