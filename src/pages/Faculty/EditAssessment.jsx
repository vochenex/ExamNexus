import { useState, useEffect } from "react";
import { useTheme } from "../../layouts/ThemeContext";
import { fetchExamWithQuestions, fetchSubject, updateExam } from "../../utils/supabaseData";
import { useNavigate, useParams } from "react-router-dom";
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
import { getSubjectSections, normalizeTargetSections } from "../../utils/sections";
import { deserializeQuestion, serializeQuestionForDb } from "../../utils/assessmentQuestions";
import { parseDurationValue, DEFAULT_DURATION_VALUE } from "../../utils/assessmentDuration";

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

export default function EditAssessment() {
  const navigate = useNavigate();
  const { examId } = useParams();
  const { theme } = useTheme();

  const [dateRange, setDateRange] = useState();
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [targetSections, setTargetSections] = useState([]);
  const [exam, setExam] = useState(defaultAssessment);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [subjectSections, setSubjectSections] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);

  const {
    questionSections,
    activeSectionId,
    activeFormat,
    questions,
    formatPrompt,
    gradingSections,
    setActiveSectionId,
    initializeFromLoadedQuestions,
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

  const assessmentLabel = "Assessment";

  useEffect(() => {
    fetchExamWithQuestions(examId)
      .then(async (data) => {
        let sections = [];
        if (data.exam.subject_id) {
          try {
            const subject = await fetchSubject(data.exam.subject_id);
            sections = getSubjectSections(subject);
            setSubjectSections(sections);
          } catch (err) {
            console.error(err);
            sections = getSubjectSections(null);
            setSubjectSections(sections);
          }
        }

        const loadedQuestions = data.questions.map((q) =>
          deserializeQuestion(q, data.exam.exam_type)
        );

        initializeFromLoadedQuestions(loadedQuestions, data.exam.exam_type);

        setExam({
          ...defaultAssessment,
          title: data.exam.title,
          description: data.exam.description,
          exam_type: data.exam.exam_type,
          assessment_category: data.exam.assessment_category || "exam",
          subject_id: data.exam.subject_id,
          start_datetime: data.exam.start_datetime,
          end_datetime: data.exam.end_datetime,
          instructions: data.exam.instructions || "",
          shuffle_questions: Boolean(data.exam.shuffle_questions),
          allow_review: data.exam.allow_review !== false,
          show_result: data.exam.allow_student_view !== false,
          show_question_review: data.exam.allow_question_review !== false,
          show_correct_answers: data.exam.allow_show_correct_answers !== false,
          duration_value: parseDurationValue(data.exam.duration_value, DEFAULT_DURATION_VALUE),
          duration_unit: data.exam.duration_unit || "minutes",
        });
        setTargetSections(
          normalizeTargetSections(data.exam.target_sections, sections)
        );

        if (data.exam.start_datetime) {
          const start = new Date(data.exam.start_datetime);
          const end = new Date(data.exam.end_datetime);

          setDateRange({ from: start, to: end });
          setStartTime(start.toTimeString().slice(0, 5));
          setEndTime(end.toTimeString().slice(0, 5));
        }
      })
      .catch((err) => {
        console.error(err);
        setError(err.message || "Failed to load assessment.");
      })
      .finally(() => setPageLoading(false));
  }, [examId]);

  const formatLocalDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

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
        setError("Add at least one question before saving.");
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
      const formattedQuestions = questionsToSave.map((q) => ({
        id: q.id,
        ...serializeQuestionForDb(q),
      }));

      const updatedExam = {
        ...exam,
        exam_type: getExamTypeForSave(),
        start_datetime: dateRange?.from
          ? `${formatLocalDate(dateRange.from)}T${startTime}`
          : null,
        end_datetime: dateRange?.to
          ? `${formatLocalDate(dateRange.to)}T${endTime}`
          : null,
        target_sections: targetSections,
      };

      await updateExam(examId, updatedExam, formattedQuestions);

      alert("Assessment updated successfully.");
      navigate("/faculty/dashboard");
    } catch (err) {
      setError(err.message || "Failed to save assessment.");
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <div className={`min-h-screen p-6 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
        Loading assessment...
      </div>
    );
  }

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
          Edit {assessmentLabel}
        </h1>
        <p className={`mt-1 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
          Update questions, schedule, and section targeting.
        </p>
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
                value={exam.title || ""}
                onChange={(e) => setExam({ ...exam, title: e.target.value })}
              />

              <textarea
                className={assessmentInputClass(theme)}
                rows={3}
                placeholder="Description (optional)"
                value={exam.description || ""}
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
              publishLabel="Save changes"
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
