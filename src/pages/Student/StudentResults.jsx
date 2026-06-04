import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../supabaseClient";

export default function StudentResults() {
  const { examId, studentId } = useParams();

  const [exam, setExam] = useState(null);
  const [result, setResult] = useState(null);
  const [answers, setAnswers] = useState([]);

  /* ================= LOAD DATA ================= */
  useEffect(() => {
    const load = async () => {
      try {
        // Get exam info
        const { data: examData } = await supabase
          .from("exams")
          .select("*")
          .eq("id", examId)
          .single();

        setExam(examData);

        // Get result
        const { data: resultData } = await supabase
          .from("exam_results")
          .select("*")
          .eq("exam_id", examId)
          .eq("student_id", studentId)
          .single();

        setResult(resultData);

        // Get detailed answers
        const { data: answerData } = await supabase
          .from("student_answers")
          .select("*")
          .eq("exam_id", examId)
          .eq("student_id", studentId);

        setAnswers(answerData || []);
      } catch (err) {
        console.error(err.message);
      }
    };

    load();
  }, [examId, studentId]);

  /* ================= LOADING ================= */
  if (!exam || !result) {
    return (
      <div className="text-white p-10">
        Loading results...
      </div>
    );
  }

  /* ================= VISIBILITY CONTROL ================= */
  if (!exam.allow_student_view) {
    return (
      <div className="text-white p-10 text-center">
        <h1 className="text-2xl font-bold text-red-400">
          Results Hidden
        </h1>
        <p className="mt-2 text-gray-300">
          Your teacher has disabled result viewing for this exam.
        </p>
      </div>
    );
  }

  const correctCount = result.score;
  const wrongCount = result.total - result.score;

  /* ================= UI ================= */
  return (
    <div className="min-h-screen bg-[#031d1f] text-white p-10">

      {/* HEADER */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{exam.title}</h1>
        <p className="text-gray-300">{exam.description}</p>
      </div>

      {/* SCORE CARD */}
      <div className="grid grid-cols-3 gap-4 mb-10">

        <div className="bg-green-500/20 p-5 rounded-xl">
          <h2 className="text-xl font-bold">Score</h2>
          <p className="text-2xl">{correctCount}</p>
        </div>

        <div className="bg-red-500/20 p-5 rounded-xl">
          <h2 className="text-xl font-bold">Wrong</h2>
          <p className="text-2xl">{wrongCount}</p>
        </div>

        <div className="bg-blue-500/20 p-5 rounded-xl">
          <h2 className="text-xl font-bold">Percentage</h2>
          <p className="text-2xl">
            {((correctCount / result.total) * 100).toFixed(1)}%
          </p>
        </div>

      </div>

      {/* ANSWER REVIEW */}
      <div className="space-y-4">

        <h2 className="text-xl font-bold mb-4">
          Question Review
        </h2>

        {answers.map((a, i) => (
          <div
            key={i}
            className={`p-4 rounded-xl border ${
              a.is_correct
                ? "border-green-500 bg-green-500/10"
                : "border-red-500 bg-red-500/10"
            }`}
          >
            <p className="font-bold">
              Question {i + 1}
            </p>

            <p className="mt-2">
              {a.is_correct ? "✔ Correct" : "✖ Incorrect"}
            </p>

            <p className="text-sm text-gray-300 mt-1">
              Your Answer: {a.answer || "Not answered"}
            </p>
          </div>
        ))}

      </div>

    </div>
  );
}