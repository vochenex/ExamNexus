import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { useTheme } from "../../layouts/ThemeContext";
import BackButton from "../../components/BackButton";
import { pageShellWithBellClass } from "../../utils/themeInputs";
import {
  formatQuestionCorrectAnswers,
  parseStoredAnswer,
} from "../../utils/assessmentQuestions";
import { getFormatLabel } from "../../utils/questionSections";
import {
  dedupeExamQuestions,
  getQuestionFormatType,
  groupQuestionsForNavigation,
} from "../../utils/assessmentTake";

function QuestionResultCard({
  question,
  questionNumber,
  entry,
  examType,
  theme,
  showCorrectAnswers,
  formatStudentAnswer,
}) {
  const pendingReview = entry?.is_correct === null;
  const isCorrect = entry?.is_correct === true;
  const isIncorrect = entry?.is_correct === false;
  const correctAnswers = formatQuestionCorrectAnswers(question, examType);
  const questionType = getQuestionFormatType(question, examType);

  return (
    <div
      className={`rounded-2xl border p-5 ${
        pendingReview
          ? theme === "dark"
            ? "border-amber-500/30 bg-amber-500/10"
            : "border-amber-200 bg-amber-50"
          : isCorrect
            ? theme === "dark"
              ? "border-emerald-500/30 bg-emerald-500/10"
              : "border-emerald-200 bg-emerald-50"
            : isIncorrect
              ? theme === "dark"
                ? "border-red-500/30 bg-red-500/10"
                : "border-red-200 bg-red-50"
              : theme === "dark"
                ? "border-white/10 bg-white/5"
                : "border-emerald-200/80 en-bg-elevated"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">Question {questionNumber}</span>
        {pendingReview ? (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              theme === "dark"
                ? "bg-amber-500/20 text-amber-200"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            Pending teacher review
          </span>
        ) : isCorrect ? (
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-300">
            Correct
          </span>
        ) : isIncorrect ? (
          <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-300">
            Incorrect
          </span>
        ) : null}
      </div>

      <p className={`mt-3 font-medium ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
        {question.question}
      </p>

      <p className={`mt-3 text-sm ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>
        Your answer: {formatStudentAnswer(question, entry)}
      </p>

      {showCorrectAnswers && questionType !== "essay" && correctAnswers.length > 0 && (
        <p
          className={`mt-2 text-sm ${
            theme === "dark" ? "text-emerald-200/90" : "text-teal-800"
          }`}
        >
          Correct answer
          {correctAnswers.length > 1 ? "s" : ""}:{" "}
          {questionType === "enumeration"
            ? correctAnswers.map((value, index) => `${index + 1}. ${value}`).join(" · ")
            : correctAnswers.join(" · ")}
        </p>
      )}
    </div>
  );
}

export default function StudentResults() {
  const { examId, studentId } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();

  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [result, setResult] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [{ data: examData }, { data: resultData }, { data: questionData }, { data: answerData }] =
          await Promise.all([
            supabase.from("exams").select("*").eq("id", examId).single(),
            supabase
              .from("exam_results")
              .select("*")
              .eq("exam_id", examId)
              .eq("student_id", studentId)
              .single(),
            supabase
              .from("questions")
              .select("*")
              .eq("exam_id", examId)
              .order("created_at", { ascending: true }),
            supabase
              .from("student_answers")
              .select("*")
              .eq("exam_id", examId)
              .eq("student_id", studentId),
          ]);

        setExam(examData);
        setResult(resultData);
        setQuestions(dedupeExamQuestions(questionData || []));
        setAnswers(answerData || []);
      } catch (err) {
        console.error(err.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [examId, studentId]);

  const examType = exam?.exam_type || "multiple_choice";

  const questionGroups = useMemo(
    () => groupQuestionsForNavigation(questions, examType),
    [questions, examType]
  );

  const answerByQuestionId = useMemo(
    () => Object.fromEntries(answers.map((entry) => [entry.question_id, entry])),
    [answers]
  );

  const getQuestionTypeFor = (question) =>
    getQuestionFormatType(question, examType);

  const formatStudentAnswer = (question, entry) => {
    if (!entry?.answer) return "Not answered";

    const questionType = getQuestionTypeFor(question);
    const parsed = parseStoredAnswer(entry.answer, questionType);

    if (questionType === "enumeration" && Array.isArray(parsed)) {
      return parsed.map((value, index) => `${index + 1}. ${value}`).join(" · ");
    }

    if (questionType === "true_false") {
      return parsed === "true" ? "True" : parsed === "false" ? "False" : parsed;
    }

    if (questionType === "multiple_choice") {
      const letter = String(parsed).toUpperCase();
      const option = question[`option_${letter.toLowerCase()}`];
      return option ? `${letter}. ${option}` : letter;
    }

    return parsed;
  };

  if (loading) {
    return (
      <div className={pageShellWithBellClass(theme)}>
        <div className="mx-auto max-w-4xl animate-pulse">
          <div className={`h-10 w-64 rounded-xl ${theme === "dark" ? "bg-white/10" : "en-bg-skeleton"}`} />
        </div>
      </div>
    );
  }

  if (!exam || !result) {
    return (
      <div className={pageShellWithBellClass(theme)}>
        <BackButton />
        <p className="mt-4">Results not found.</p>
      </div>
    );
  }

  if (!exam.allow_student_view) {
    return (
      <div className={`${pageShellWithBellClass(theme)} text-center`}>
        <h1 className="text-2xl font-bold text-red-400">Results hidden</h1>
        <p className={`mt-2 ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}>
          Your teacher has disabled result viewing for this assessment.
        </p>
      </div>
    );
  }

  const showQuestionReview = exam.allow_question_review !== false;
  const showCorrectAnswers = exam.allow_show_correct_answers !== false;
  const hasEssayQuestions = questions.some(
    (question) => getQuestionTypeFor(question) === "essay"
  );
  const isEssayOnly = examType === "essay";
  const pendingReviewCount = answers.filter((entry) => entry.is_correct === null).length;
  const wrongCount = answers.filter((entry) => entry.is_correct === false).length;

  return (
    <div className={pageShellWithBellClass(theme)}>
      <BackButton />

      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <p
            className={`text-xs font-semibold uppercase tracking-wide ${
              theme === "dark" ? "text-emerald-400" : "text-teal-700"
            }`}
          >
            {getFormatLabel(examType) || "Assessment results"}
          </p>
          <h1 className="mt-1 text-3xl font-bold">{exam.title}</h1>
          {exam.description && (
            <p className={`mt-2 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
              {exam.description}
            </p>
          )}
        </div>

        <div className="mb-10 grid gap-4 sm:grid-cols-3">
          <div
            className={`rounded-2xl border p-5 ${
              theme === "dark"
                ? "border-emerald-500/20 bg-emerald-500/10"
                : "border-emerald-200/80 en-bg-elevated"
            }`}
          >
            <h2 className="text-sm font-semibold uppercase tracking-wide">Score</h2>
            <p className="mt-2 text-3xl font-bold">
              {isEssayOnly ? "—" : result.score}
            </p>
          </div>

          <div
            className={`rounded-2xl border p-5 ${
              theme === "dark"
                ? "border-red-500/20 bg-red-500/10"
                : "border-red-200/80 en-bg-elevated"
            }`}
          >
            <h2 className="text-sm font-semibold uppercase tracking-wide">
              {isEssayOnly ? "Pending review" : "Incorrect"}
            </h2>
            <p className="mt-2 text-3xl font-bold">
              {isEssayOnly ? pendingReviewCount : wrongCount}
            </p>
          </div>

          <div
            className={`rounded-2xl border p-5 ${
              theme === "dark"
                ? "border-cyan-500/20 bg-cyan-500/10"
                : "border-cyan-200/80 en-bg-elevated"
            }`}
          >
            <h2 className="text-sm font-semibold uppercase tracking-wide">
              {isEssayOnly ? "Submitted" : "Percentage"}
            </h2>
            <p className="mt-2 text-3xl font-bold">
              {isEssayOnly
                ? questions.length
                : result.total
                  ? `${((result.score / result.total) * 100).toFixed(1)}%`
                  : "0%"}
            </p>
          </div>
        </div>

        {!showQuestionReview && (
          <div
            className={`mb-8 rounded-2xl border px-5 py-4 text-sm ${
              theme === "dark"
                ? "border-amber-500/20 bg-amber-500/10 text-amber-100"
                : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            Your teacher has limited this result to your score only. Question-by-question
            review is not available for this assessment.
          </div>
        )}

        {showQuestionReview && !showCorrectAnswers && (
          <div
            className={`mb-8 rounded-2xl border px-5 py-4 text-sm ${
              theme === "dark"
                ? "border-white/10 bg-white/[0.03] text-gray-300"
                : "border-emerald-200/80 en-bg-muted text-gray-700"
            }`}
          >
            Your teacher has hidden the correct answers. You can review your responses, but
            the expected answers are not shown.
          </div>
        )}

        {(isEssayOnly || (hasEssayQuestions && pendingReviewCount > 0)) && showQuestionReview && (
          <div
            className={`mb-8 rounded-2xl border px-5 py-4 text-sm ${
              theme === "dark"
                ? "border-amber-500/20 bg-amber-500/10 text-amber-100"
                : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            Essay responses are not auto-graded. Your teacher will review them and update
            your results when grading is complete.
          </div>
        )}

        {showQuestionReview && (
          <div className="space-y-8">
            <h2 className="text-xl font-bold">Question review</h2>

            {questionGroups.map((group) => (
              <section key={group.type} className="space-y-4">
                <div className="flex items-center gap-3">
                  <h3
                    className={`text-sm font-semibold uppercase tracking-wide ${
                      theme === "dark" ? "text-emerald-400" : "text-teal-700"
                    }`}
                  >
                    {group.label}
                  </h3>
                  <span
                    className={`text-xs ${
                      theme === "dark" ? "text-gray-500" : "text-gray-500"
                    }`}
                  >
                    {group.items.length} question{group.items.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="space-y-4">
                  {group.items.map((item) => {
                    const question = questions[item.index];
                    if (!question) return null;

                    return (
                      <QuestionResultCard
                        key={question.id}
                        question={question}
                        questionNumber={item.number}
                        entry={answerByQuestionId[question.id]}
                        examType={examType}
                        theme={theme}
                        showCorrectAnswers={showCorrectAnswers}
                        formatStudentAnswer={formatStudentAnswer}
                      />
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => navigate("/student/results")}
          className={`mt-8 rounded-xl px-5 py-3 text-sm font-semibold ${
            theme === "dark"
              ? "bg-white/10 text-white hover:bg-white/15"
              : "en-bg-elevated text-teal-800 border border-emerald-200 en-hover"
          }`}
        >
          Back to results
        </button>
      </div>
    </div>
  );
}
