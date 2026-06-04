import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";

export default function TakeExam() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);

  const [loading, setLoading] = useState(true);

  const [currentQuestion, setCurrentQuestion] = useState(0);

  const [answers, setAnswers] = useState({});

  const [timeLeft, setTimeLeft] = useState(0);

  /* ================= LOAD EXAM ================= */
  useEffect(() => {
    const loadExam = async () => {
      try {
        // GET EXAM
        const { data: examData } = await supabase
          .from("exams")
          .select("*")
          .eq("id", id)
          .single();

        setExam(examData);

        // GET QUESTIONS
        const { data: questionData } = await supabase
          .from("questions")
          .select("*")
          .eq("exam_id", id);

        setQuestions(questionData || []);

        // TIMER
        let duration = examData.duration_value || 60;

        switch (examData.duration_unit) {
          case "hours":
            duration *= 60 * 60;
            break;

          case "days":
            duration *= 60 * 60 * 24;
            break;

          case "weeks":
            duration *= 60 * 60 * 24 * 7;
            break;

          default:
            duration *= 60;
        }

        setTimeLeft(duration);

      } catch (err) {
        console.error(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadExam();
  }, [id]);

  /* ================= TIMER ================= */
  useEffect(() => {
    if (timeLeft <= 0) {
      if (!loading && questions.length > 0) {
        submitExam();
      }
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  /* ================= FORMAT TIMER ================= */
  const formatTime = () => {
    const hours = Math.floor(timeLeft / 3600);
    const minutes = Math.floor((timeLeft % 3600) / 60);
    const seconds = timeLeft % 60;

    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  /* ================= ANSWER ================= */
  const selectAnswer = (answer) => {
    setAnswers({
      ...answers,
      [currentQuestion]: answer,
    });
  };

  /* ================= SUBMIT ================= */
  const submitExam = async () => {
    try {
      let score = 0;

      const answerLogs = questions.map((q, i) => {
        const selected = answers[i] || "";

        const isCorrect =
          selected.toUpperCase() ===
          q.correct_answer.toUpperCase();

        if (isCorrect) score++;

        return {
          question_id: q.id,
          answer: selected,
          is_correct: isCorrect,
        };
      });

      await fetch("http://localhost:5000/submit-exam", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          examId: id,
          studentId: "student-1",
          score,
          total: questions.length,
          answers: answerLogs,
        }),
      });

      alert(`Exam submitted!\nScore: ${score}/${questions.length}`);

      navigate("/student");

    } catch (err) {
      alert(err.message);
    }
  };

  /* ================= LOADING ================= */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#031d1f] text-white">
        Loading exam...
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#031d1f] text-white">
        No questions found.
      </div>
    );
  }

  const q = questions[currentQuestion];

  const progress =
    ((currentQuestion + 1) / questions.length) * 100;

  /* ================= UI ================= */
  return (
    <div className="min-h-screen bg-[#031d1f] text-white p-8">

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">

        <div>
          <h1 className="text-3xl font-bold text-teal-300">
            {exam.title}
          </h1>

          <p className="text-gray-300 mt-1">
            Question {currentQuestion + 1} of {questions.length}
          </p>
        </div>

        {/* TIMER */}
        <div className="bg-red-500/20 border border-red-500 px-5 py-3 rounded-xl">
          ⏱ {formatTime()}
        </div>
      </div>

      {/* PROGRESS */}
      <div className="w-full bg-white/10 h-3 rounded-full mb-8">
        <div
          className="bg-teal-400 h-3 rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* QUESTION CARD */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-8">

        <h2 className="text-2xl font-bold mb-8">
          {q.question}
        </h2>

        <div className="grid gap-4">

          {["A", "B", "C", "D"].map((letter) => {
            const value = q[`option_${letter.toLowerCase()}`];

            return (
              <button
                key={letter}
                onClick={() => selectAnswer(letter)}
                className={`p-4 rounded-xl text-left border transition ${
                  answers[currentQuestion] === letter
                    ? "bg-teal-500 text-black border-teal-300"
                    : "bg-white/5 border-white/10 hover:bg-white/10"
                }`}
              >
                <span className="font-bold mr-3">
                  {letter}.
                </span>

                {value}
              </button>
            );
          })}

        </div>
      </div>

      {/* NAVIGATION */}
      <div className="flex justify-between mt-8">

        <button
          disabled={currentQuestion === 0}
          onClick={() =>
            setCurrentQuestion((prev) => prev - 1)
          }
          className="px-6 py-3 rounded-xl bg-white/10 disabled:opacity-30"
        >
          Previous
        </button>

        {currentQuestion === questions.length - 1 ? (
          <button
            onClick={() => {
              const confirmSubmit = window.confirm(
                "Are you sure you want to submit?"
              );

              if (confirmSubmit) submitExam();
            }}
            className="px-6 py-3 rounded-xl bg-green-500 text-black font-bold"
          >
            Submit Exam
          </button>
        ) : (
          <button
            onClick={() =>
              setCurrentQuestion((prev) => prev + 1)
            }
            className="px-6 py-3 rounded-xl bg-teal-500 text-black font-bold"
          >
            Next
          </button>
        )}
      </div>

    </div>
  );
}