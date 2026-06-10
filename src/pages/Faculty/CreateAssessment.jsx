import { useState, useEffect } from "react";
import { useTheme } from "../../layouts/ThemeContext";
import { useAppModal } from "../../contexts/AppModalContext";
import { useNavigate, useLocation } from "react-router-dom";
import BackButton from "../../components/BackButton";
import { ClipboardList, Settings } from "lucide-react";
import AssessmentSchedule from "../../components/AssessmentSchedule";
import SectionPicker from "../../components/SectionPicker";
import {
  AssessmentTypeSelect,
  assessmentPanelClass,
  assessmentInputClass,
} from "../../components/QuestionBuilderCard";
import AssessmentSettingsPanel from "../../components/AssessmentSettingsPanel";
import FormatGradingSettings from "../../components/FormatGradingSettings";
import QuestionFormatPrompt from "../../components/QuestionFormatPrompt";
import QuestionSectionsPanel from "../../components/QuestionSectionsPanel";
import { getSubjectSections } from "../../utils/sections";
import { createExam } from "../../utils/supabaseData";
import { supabase } from "../../supabaseClient";
import {
  canFacultyManageSubjects,
  FACULTY_AVATAR_REQUIRED_MESSAGE,
  isFacultyRole,
} from "../../utils/avatar";
import { serializeQuestionForDb } from "../../utils/assessmentQuestions";
import { getAssessmentCategoryLabel } from "../../utils/assessmentCategories";
import useQuestionSections from "../../hooks/useQuestionSections";

const defaultAssessment = {
  subject_id: "",
  title: "",
  description: "",
  exam_type: "multiple_choice",
  instructions: "",
  allow_review: true,
  shuffle_questions: false,
  show_result: true,
  show_question_review: true,
  show_correct_answers: true,
  duration_value: 60,
  duration_unit: "minutes",
};

export default function CreateAssessment() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const { warning: showWarning, success: showSuccess } = useAppModal();

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
  const [error, setError] = useState("");

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
    addAlternativeAnswer,
    updateAlternativeAnswer,
    removeAlternativeAnswer,
    deleteQuestion,
    validateAllQuestions,
    getQuestionsForSave,
    getExamTypeForSave,
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
  }, [facultyProfile.role, facultyCanManage, navigate]);

  const clearError = () => setError("");

  const onFormatChange = (nextType) => {
    clearError();
    const resolvedType = handleFormatChange(nextType);
    setExam((prev) => ({ ...prev, exam_type: resolvedType }));
  };

  const onConfirmFormatSection = () => {
    const resolvedType = confirmAddFormatSection();
    setExam((prev) => ({ ...prev, exam_type: resolvedType }));
  };

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

      const validationError = validateAllQuestions();
      if (validationError) {
        setError(validationError);
        setLoading(false);
        return;
      }

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

      showSuccess(`${assessmentLabel} created successfully.`);
      navigate("/faculty/dashboard");
    } catch (err) {
      setError(err.message || "Failed to publish assessment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen p-6 ${
        theme === "dark" ? "bg-[#031d1f] text-white" : "en-bg-page text-gray-900"
      }`}
    >
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
          Build questions, set a schedule, and publish to selected sections.
        </p>
        {selectedSubject && (
          <p className={`mt-2 text-sm font-medium ${theme === "dark" ? "text-emerald-300" : "text-teal-800"}`}>
            Subject: {selectedSubject.name}
          </p>
        )}
      </div>

      {error && (
        <div
          className={`mb-4 rounded-xl border p-3 text-sm ${
            theme === "dark"
              ? "border-red-500/30 bg-red-500/10 text-red-200"
              : "border-red-300 bg-red-50 text-red-700"
          }`}
        >
          {error}
        </div>
      )}

      <div className="mx-auto max-w-[1440px]">
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-12 xl:items-start">
          <div className="space-y-6 xl:col-span-4">
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

              <AssessmentTypeSelect
                value={activeFormat}
                onChange={onFormatChange}
                hint="Switching format with existing questions creates a new section instead of removing them."
              />
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

          <div className={`${assessmentPanelClass(theme)} min-h-[420px] xl:col-span-5`}>
            <QuestionSectionsPanel
              questionSections={questionSections}
              activeSectionId={activeSectionId}
              questions={questions}
              onAddQuestionToSection={(sectionId) =>
                addQuestionToSection(sectionId, setError, clearError)
              }
              onUpdateQuestion={(index, field, value) =>
                updateQuestion(index, field, value, clearError)
              }
              onUpdateChoice={(qIndex, cIndex, value) =>
                updateChoice(qIndex, cIndex, value, clearError)
              }
              onUpdateEnumAnswer={(qIndex, aIndex, value) =>
                updateEnumAnswer(qIndex, aIndex, value, clearError)
              }
              onAddEnumAnswer={addEnumAnswer}
              onRemoveEnumAnswer={removeEnumAnswer}
              onAddAlternativeAnswer={addAlternativeAnswer}
              onUpdateAlternativeAnswer={(qIndex, aIndex, value) =>
                updateAlternativeAnswer(qIndex, aIndex, value, clearError)
              }
              onRemoveAlternativeAnswer={removeAlternativeAnswer}
              onDeleteQuestion={deleteQuestion}
              onSelectSection={setActiveSectionId}
            />
          </div>

          <div className={`${assessmentPanelClass(theme)} space-y-4 xl:col-span-3 xl:sticky xl:top-6`}>
            <div className="flex items-center gap-2">
              <Settings className="text-emerald-400" size={18} />
              <h2 className="font-semibold">Settings</h2>
            </div>

            {gradingSections.length > 0 && (
              <div className="space-y-4">
                <p
                  className={`text-xs font-semibold uppercase tracking-wide ${
                    theme === "dark" ? "text-emerald-400/80" : "text-teal-700"
                  }`}
                >
                  Format grading
                </p>
                {gradingSections.map((section) => (
                  <FormatGradingSettings
                    key={section.id}
                    sectionType={section.type}
                    gradingDefaults={section.gradingDefaults}
                    onChange={(grading) =>
                      updateSectionGrading(section.id, grading, clearError)
                    }
                  />
                ))}
              </div>
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
    </div>
  );
}
