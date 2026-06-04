import { useState } from "react";
import { useTheme } from "../../layouts/ThemeContext";
import { useNavigate, useLocation } from "react-router-dom";
import BackButton from "../../components/BackButton";
import { Plus, Trash2, Sparkles, Settings, } from "lucide-react";
import AssessmentSchedule from "../../components/AssessmentSchedule";

const defaultAssessment = {
  subject_id: "",
  title: "",
  description: "",
  exam_type: "multiple_choice",
  instructions: "",
  allow_review: true,
  shuffle_questions: false,
  show_result: true,
};

export default function CreateAssessment() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();

  const assessmentType =
    location.state?.type || "exam";

  const assessmentLabel =
    assessmentType.charAt(0).toUpperCase() +
    assessmentType.slice(1);

  const selectedSubject =
    location.state?.subject;
 const [dateRange, setDateRange] = useState();

const [startTime, setStartTime] = useState("09:00");
const [endTime, setEndTime] = useState("10:00");

  const [exam, setExam] = useState(defaultAssessment);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

const isLastQuestionComplete = () => {
  if (questions.length === 0) return true;

  const last = questions[questions.length - 1];

  if (!last.question?.trim()) return false;

  if (last.type === "multiple_choice") {
    const choicesValid =
      last.choices?.length === 4 &&
      last.choices.every((c) => c.trim() !== "");

    const answerValid =
      last.answer?.trim() !== "";

    return choicesValid && answerValid;
  }

  if (last.type === "enumeration") {
    const columnsValid =
      last.choices?.length > 0 &&
      last.choices.every((c) => c.trim() !== "");

    const answersValid =
      last.answers?.length > 0 &&
      last.answers.every((a) => a.trim() !== "");

    return columnsValid && answersValid;
  }

  if (last.type === "identification") {
    return last.answer?.trim() !== "";
  }

  return true;
};

  const addQuestion = () => {
    if (!isLastQuestionComplete()) {
      setError("⚠️ Please complete the previous question first");
      return;
    }

    setError("");

    const newQuestion = {
      question: "",
      type: exam.exam_type,
      choices:
        exam.exam_type === "multiple_choice"
          ? ["", "", "", ""]
          : exam.exam_type === "enumeration"
          ? [""]
          : [],
      answers:
        exam.exam_type === "enumeration" ? [""] : [],
      answer: "",
    };

    setQuestions((prev) => [...prev, newQuestion]);
  };

  const updateQuestion = (index, field, value) => {
    setQuestions((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const updateChoice = (qIndex, cIndex, value) => {
    setQuestions((prev) => {
      const updated = [...prev];
      updated[qIndex].choices[cIndex] = value;
      return updated;
    });
  };

  const updateEnumAnswer = (qIndex, aIndex, value) => {
    setQuestions((prev) => {
      const updated = [...prev];
      updated[qIndex].answers[aIndex] = value;
      return updated;
    });
  };

  const addColumnAndAnswer = (index) => {
  console.log("ADD CLICKED");

  setQuestions((prev) =>
    prev.map((q, i) =>
      i === index
        ? {
            ...q,
            choices: [...q.choices, ""],
            answers: [...q.answers, ""],
          }
        : q
    )
  );
};

  const deleteQuestion = (index) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePublish = async () => {
    try {
      setLoading(true);

      const payload = {
        ...exam,
        start_datetime:
          dateRange?.from
            ? `${dateRange.from.toISOString().split("T")[0]}T${startTime}`
            : null,
        end_datetime:
          dateRange?.to
            ? `${dateRange.to.toISOString().split("T")[0]}T${endTime}`
            : null,
        subject_id: selectedSubject?.id || "",
        assessment_type: assessmentType,
        questions: questions.filter(
          (q) => q.question.trim() !== ""
        ),
      };
        
        console.log(
          "START DATETIME:",
          dateRange?.from
            ? `${dateRange.from.toISOString().split("T")[0]}T${startTime}`
            : null
        );

        console.log(
          "END DATETIME:",
          dateRange?.to
            ? `${dateRange.to.toISOString().split("T")[0]}T${endTime}`
            : null
        );
        console.log("DATE RANGE:", dateRange);
        console.log("START TIME:", startTime);
        console.log("END TIME:", endTime);
        console.log("PAYLOAD:", payload);
        
      const res = await fetch("http://localhost:5000/manual-exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      alert(`${assessmentLabel} created successfully!`);
      navigate("/faculty/dashboard");
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
  className={`
    min-h-screen
    p-6

    ${
      theme === "dark"
        ? "bg-[#031d1f] text-white"
        : "bg-[#c3f0e8] text-gray-900"
    }
  `}
>
      <BackButton />
      {/* HEADER */}
      <div className="flex items-center gap-3 mb-6">

        <div>
          <h1
  className={`
    text-2xl
    font-bold

    ${
      theme === "dark"
        ? "text-emerald-400"
        : "text-teal-700"
    }
  `}
>
          Create {assessmentLabel}
        </h1>
          <p
  className={`text-sm ${
    theme === "dark"
      ? "text-gray-400"
      : "text-gray-700"
  }`}
>
          Build structured assessments
        </p>

        {selectedSubject && (
          <p
  className={`text-sm mt-1 ${
    theme === "dark"
      ? "text-emerald-400"
      : "text-teal-700"
  }`}
>
            Subject: {selectedSubject.name}
          </p>
        )}
        </div>
      </div>

      {error && (
        <div
  className={`mb-4 p-3 rounded-xl ${
    theme === "dark"
      ? "bg-red-500/20 text-red-300"
      : "bg-red-100 border border-red-300 text-red-700"
  }`}
>
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* EXAM INFO */}
        <div
  className={`
    p-5
    rounded-2xl
    h-fit

    ${
      theme === "dark"
        ? "bg-white/5 border border-white/10"
        : "bg-white border border-emerald-200 shadow-md"
    }
  `}
>

          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="text-emerald-400" />
            <h2
              className={`font-semibold ${
                theme === "dark"
                  ? "text-white"
                  : "text-gray-900"
              }`}
            >
              {assessmentLabel} Info
            </h2>
          </div>

          <input
            className={`
  w-full
  p-3
  mb-3
  rounded-xl

  ${
    theme === "dark"
      ? "bg-white/10 text-white"
      : "bg-[#f4fffc] border border-emerald-200 text-gray-900"
  }
`}
            placeholder="Title"
            value={exam.title}
            onChange={(e) =>
              setExam({ ...exam, title: e.target.value })
            }
          />

          <textarea
            className={`
  w-full
  p-3
  mb-3
  rounded-xl

  ${
    theme === "dark"
      ? "bg-white/10 text-white"
      : "bg-[#f4fffc] border border-emerald-200 text-gray-900"
  }
`}
            placeholder="Description"
            value={exam.description}
            onChange={(e) =>
              setExam({ ...exam, description: e.target.value })
            }
          />

          <AssessmentSchedule
            dateRange={dateRange}
            setDateRange={setDateRange}
            startTime={startTime}
            setStartTime={setStartTime}
            endTime={endTime}
            setEndTime={setEndTime}
          />

          {/* TYPE */}
          <select
            value={exam.exam_type}
            onChange={(e) =>
              setExam({ ...exam, exam_type: e.target.value })
            }
            className={`
  w-full
  p-3
  rounded-xl
  text-sm

  ${
    theme === "dark"
      ? `
          bg-white/10
          border border-white/10
          text-white
        `
      : `
          bg-white
          border border-emerald-200
          text-gray-900
        `
  }

  focus:outline-none
  focus:ring-2
  focus:ring-emerald-400
`}
          >
            <option
  className={
    theme === "dark"
      ? "bg-[#031d1f]"
      : "bg-white text-black"
  }
  value="multiple_choice"
>
              Multiple Choice
            </option>
            <option
  className={
    theme === "dark"
      ? "bg-[#031d1f]"
      : "bg-white text-black"
  }
  value="enumeration"
>
              Enumeration
            </option>
            <option
  className={
    theme === "dark"
      ? "bg-[#031d1f]"
      : "bg-white text-black"
  }
  value="identification"
>
              Identification
            </option>
          </select>
        </div>

        {/* QUESTIONS */}
        <div
  className={`
    p-5
    rounded-2xl
    h-fit

    ${
      theme === "dark"
        ? "bg-white/5 border border-white/10"
        : "bg-white border border-emerald-200 shadow-md"
    }
  `}
>

          <div className="flex justify-between mb-4">
            <h2
  className={`font-semibold ${
    theme === "dark"
      ? "text-emerald-300"
      : "text-teal-700"
  }`}
>
              Questions ({questions.length})
            </h2>
          </div>

          {questions.map((q, index) => (
            <div
  key={index}
  className={`
    mb-4
    p-4
    rounded-xl

    ${
      theme === "dark"
        ? "bg-black/20"
        : "bg-[#f4fffc] border border-emerald-100"
    }
  `}
>

              <div className="flex justify-between mb-3">
                <span
  className={`text-sm ${
    theme === "dark"
      ? "text-emerald-300"
      : "text-teal-700"
  }`}
>
                  Question {index + 1}
                </span>

                <button
                  onClick={() => deleteQuestion(index)}
                  className="
                    p-2
                    rounded-lg

                    text-red-400

                    hover:bg-red-500/10
                    hover:text-red-300
                    hover:rotate-6
                    hover:-translate-y-0.5
                    hover:shadow-[0_0_20px_rgba(239,68,68,0.25)]

                    active:scale-[0.95]

                    transition-all
                    duration-300
                  "
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <input
                className={`
  w-full
  p-3
  mb-3
  rounded-xl

  ${
    theme === "dark"
      ? "bg-white/10 text-white"
      : "bg-[#f4fffc] border border-emerald-200 text-gray-900"
  }
`}
                placeholder="Enter question"
                value={q.question}
                onChange={(e) =>
                  updateQuestion(index, "question", e.target.value)
                }
              />

              {/* MCQ */}
              {q.type === "multiple_choice" && (
                <div>
                  {q.choices.map((c, i) => (
                    <input
                      key={i}
                      className={`
                      w-full
                      p-2
                      mb-2
                      rounded-xl

                      ${
                        theme === "dark"
                          ? "bg-white/10 text-white"
                          : "bg-white border border-emerald-200 text-gray-900"
                      }
                    `}
                      placeholder={`Choice ${i + 1}`}
                      value={c}
                      onChange={(e) =>
                        updateChoice(index, i, e.target.value)
                      }
                    />
                  ))}
                </div>
              )}

              {/* ENUMERATION */}
              {q.type === "enumeration" && (
                <div>
                  {q.choices.map((c, i) => (
                    <input
                      key={i}
                      className={`
                        w-full
                        p-2
                        mb-2
                        rounded-xl

                        ${
                          theme === "dark"
                            ? "bg-white/10 text-white"
                            : "bg-white border border-emerald-200 text-gray-900"
                        }
                      `}
                      placeholder={`Column ${i + 1}`}
                                          value={c}
                                          onChange={(e) =>
                                            updateChoice(index, i, e.target.value)
                                          }
                                        />
                                      ))}

                                      {q.answers.map((a, i) => (
                                        <input
                                          key={i}
                                          className={`
                                          w-full
                                            p-2
                                            mb-2
                                            rounded-xl

                                            ${
                                              theme === "dark"
                                                ? "bg-black/30 text-white"
                                                : "bg-white border border-emerald-200 text-gray-900"
                                            }
                                          `}
                                          placeholder={`Answer ${i + 1}`}
                                          value={a}
                                          onChange={(e) =>
                                            updateEnumAnswer(index, i, e.target.value)
                                          }
                                        />
                                      ))}

                                      <button
                                        onClick={() => addColumnAndAnswer(index)}
                                        className="
                      mt-2

                      flex items-center gap-1

                      text-sm
                      text-emerald-400

                      hover:text-emerald-300
                      hover:translate-x-1

                      transition-all
                      duration-300
                    "
                                      >
                                        <Plus size={14} />
                                        Add Column & Answer
                                      </button>
                                    </div>
                                  )}

                                  {/* MULTIPLE CHOICE ANSWER */}
                    {q.type === "multiple_choice" && (
                      <input
                        className={`
                          w-full
                          p-3
                          mb-3
                          rounded-xl

                          ${
                            theme === "dark"
                              ? "bg-white/10 text-white"
                              : "bg-[#f4fffc] border border-emerald-200 text-gray-900"
                          }
                        `}
                        placeholder="Correct Answer"
                        value={q.answer}
                        onChange={(e) =>
                          updateQuestion(index, "answer", e.target.value)
                        }
                      />
                    )}

                    {/* IDENTIFICATION */}
      {q.type === "identification" && (
        <input
          className={`
            w-full
            p-3
            mb-3
            rounded-xl

            ${
              theme === "dark"
                ? "bg-white/10 text-white"
                : "bg-[#f4fffc] border border-emerald-200 text-gray-900"
            }
          `}
          placeholder="Correct Answer"
          value={q.answer}
          onChange={(e) =>
            updateQuestion(index, "answer", e.target.value)
          }
        />
      )}
                  </div>
                ))}
                <div
  className="
    sticky
    bottom-6
    z-20
    mt-6
    flex
    justify-center
  "
>
  <button
    onClick={addQuestion}
    className={`
      px-6
      py-3
      rounded-xl
      font-semibold
      flex items-center gap-2

      ${
        theme === "dark"
          ? `
              bg-emerald-500
              text-black
              hover:bg-emerald-400
            `
          : `
              bg-[#10B981]
              text-white
              hover:bg-[#059669]
            `
      }

      hover:-translate-y-1
      hover:shadow-lg
      transition-all
      duration-300
    `}
  >
    <Plus size={18} />
    Add Question
  </button>
</div>
              </div>

              {/* SETTINGS */}
              <div
        className={`
          p-5
          rounded-2xl
          h-fit

          ${
            theme === "dark"
              ? "bg-white/5 border border-white/10"
              : "bg-white border border-emerald-200 shadow-md"
          }
        `}
      >

                <div className="flex items-center gap-2 mb-4">
                  <Settings className="text-emerald-400" />
                  <h2
        className={`font-semibold ${
          theme === "dark"
            ? "text-white"
            : "text-gray-900"
        }`}
      >Settings</h2>
                </div>

                <button
                  onClick={handlePublish}
                  className={`
        px-4
        py-2
        rounded-xl
        font-semibold
        flex items-center gap-2

        ${
          theme === "dark"
            ? `
                bg-emerald-500
                text-black
                hover:bg-emerald-400
              `
            : `
                bg-[#10B981]
                text-white
                hover:bg-[#059669]
              `
        }

        hover:-translate-y-0.5
        hover:shadow-lg
        transition-all
        duration-300
      `}
                >
                {loading
        ? "Publishing..."
        : `Publish ${assessmentLabel}`}
                </button>
              </div>

            </div>
          </div>
        );
      }