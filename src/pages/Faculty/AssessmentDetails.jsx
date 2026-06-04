import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import BackButton from "../../components/BackButton";

/* ================= UTILITIES ================= */

const formatDate = (date) => {
  if (!date) return "Not set";

  return new Date(date).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const StatusBadge = ({ status }) => {
  const styles = {
    scheduled:
      "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    active:
      "bg-green-500/20 text-green-400 border-green-500/30",
    closed:
      "bg-red-500/20 text-red-400 border-red-500/30",
  };

  const labels = {
    scheduled: "🟡 Scheduled",
    active: "🟢 Active",
    closed: "🔴 Closed",
  };

  return (
    <span
      className={`px-3 py-1 rounded-full border text-sm ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
};

/* ================= COMPONENT ================= */

export default function AssessmentDetails() {
  const { examId } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [showDeleteModal, setShowDeleteModal] =
  useState(false);
  const [deleting, setDeleting] = useState(false);

  /* ================= DELETE ================= */

  const handleDelete = async () => {
  try {
    setDeleting(true);

    const response = await fetch(
      `http://localhost:5000/exam/${examId}`,
      {
        method: "DELETE",
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || "Delete failed"
      );
    }

    setShowDeleteModal(false);
    navigate(-1);

  } catch (err) {
    console.error(err);
    alert(err.message);
  } finally {
    setDeleting(false);
  }
};

  /* ================= FETCH DATA ================= */

  useEffect(() => {
    fetch(`http://localhost:5000/exam/${examId}`)
      .then((res) => res.json())
      .then(setData)
      .catch(console.error);

    fetch(`http://localhost:5000/analytics/${examId}`)
      .then((res) => res.json())
      .then(setAnalytics)
      .catch(console.error);
  }, [examId]);

  /* ================= LOADING ================= */

  if (!data) {
    return (
      <div className="p-6 text-white">
        Loading...
      </div>
    );
  }

  /* ================= UI ================= */

  return (
    <div className="min-h-screen text-white p-6">

      <BackButton />

      {/* HEADER */}
      <div className="mb-8">

        <div className="flex items-start justify-between">

          <div>
            <h1 className="text-3xl font-bold text-emerald-400">
              {data.exam.title}
            </h1>

            <div className="mt-3">
              <StatusBadge
                status={data.exam.status}
              />
            </div>
          </div>

          <button
            onClick={() => setShowDeleteModal(true)}
            className="
              px-4 py-2
              rounded-xl

              bg-red-500/20
              border border-red-500/30

              text-red-400
              font-medium

              hover:bg-red-500/30
              hover:border-red-400

              transition-all
            "
          >
            Delete Assessment
          </button>

        </div>

        <div className="mt-5 space-y-2 text-gray-400">

          <p>
            Available From:
            <span className="ml-2 text-emerald-400">
              {formatDate(
                data.exam.start_datetime
              )}
            </span>
          </p>

          <p>
            Available Until:
            <span className="ml-2 text-emerald-400">
              {formatDate(
                data.exam.end_datetime
              )}
            </span>
          </p>

          {data.exam.timeRemaining && (
            <p>
              Ends In:
              <span className="ml-2 text-yellow-400 font-semibold">
                {data.exam.timeRemaining}
              </span>
            </p>
          )}

        </div>

      </div>

      {/* QUESTIONS */}
      <div className="mb-10">

        <h2 className="text-xl font-semibold mb-4">
          Questions
        </h2>

        {data.questions.length === 0 ? (
          <p className="text-gray-400">
            No questions found.
          </p>
        ) : (
          data.questions.map((q, index) => (
            <div
              key={q.id}
              className="
                mb-4
                p-4
                bg-white/5
                rounded-xl
                border border-white/10
              "
            >
              <p className="font-semibold">
                {index + 1}. {q.question}
              </p>

              {q.option_a && (
                <div className="mt-3 space-y-1 text-sm text-gray-300">
                  <p>A. {q.option_a}</p>
                  <p>B. {q.option_b}</p>
                  <p>C. {q.option_c}</p>
                  <p>D. {q.option_d}</p>
                </div>
              )}

              <p className="mt-3 text-emerald-400 text-sm">
                Answer: {q.correct_answer}
              </p>
            </div>
          ))
        )}

      </div>

      {/* ANALYTICS */}
      <div>

        <h2 className="text-xl font-semibold mb-4">
          Analytics
        </h2>

        {!analytics ? (
          <p className="text-gray-400">
            Loading analytics...
          </p>
        ) : (
          <>
            {/* CLASS AVERAGE */}
            <div className="mb-6 p-5 bg-white/5 rounded-xl border border-white/10">

              <h3 className="font-semibold">
                Class Average
              </h3>

              <p className="text-3xl text-emerald-400 mt-2">
                {analytics.classAverage}%
              </p>

            </div>

            {/* QUESTION DIFFICULTY */}
            <div className="mb-6">

              <h3 className="font-semibold mb-3">
                Question Difficulty
              </h3>

              {analytics.questionDifficulty.length === 0 ? (
                <p className="text-gray-400">
                  No responses yet
                </p>
              ) : (
                analytics.questionDifficulty.map((q) => (
                  <div
                    key={q.question_id}
                    className="
                      mb-2
                      p-3
                      bg-white/5
                      rounded-xl
                      border border-white/10
                    "
                  >
                    <p className="text-sm">
                      Question {q.question_id.slice(0, 8)}
                    </p>

                    <p className="text-emerald-400">
                      Accuracy: {q.accuracy_rate}%
                    </p>
                  </div>
                ))
              )}

            </div>

            {/* STUDENT PERFORMANCE */}
            <div>

              <h3 className="font-semibold mb-3">
                Student Performance
              </h3>

              {analytics.studentPerformance.length === 0 ? (
                <p className="text-gray-400">
                  No submissions yet
                </p>
              ) : (
                analytics.studentPerformance.map((student) => (
                  <div
                    key={student.student_id}
                    className="
                      mb-2
                      p-3
                      bg-white/5
                      rounded-xl
                      border border-white/10
                    "
                  >
                    <p className="text-sm">
                      Student ID:
                    </p>

                    <p className="font-mono text-gray-300">
                      {student.student_id}
                    </p>

                    <p className="text-emerald-400 mt-1">
                      Score: {student.score}%
                    </p>
                  </div>
                ))
              )}

            </div>
          </>
        )}

      </div>
        {showDeleteModal && (
  <div
  className="
    fixed inset-0
    bg-black/60
    backdrop-blur-sm

    flex items-center justify-center
    z-50
  "
  onClick={() => setShowDeleteModal(false)}
>

    <div
  onClick={(e) => e.stopPropagation()}
  className="
    bg-slate-900
    border border-red-500/30
    rounded-2xl
    p-6
    w-full
    max-w-md
  "
>

      <h2 className="text-xl font-bold text-red-400 mb-3">
        Delete Assessment
      </h2>

      <p className="text-gray-300 mb-2">
        Are you sure you want to delete:
      </p>

      <p className="font-semibold text-white mb-4">
        {data.exam.title}
      </p>

      <p className="text-sm text-red-300 mb-6">
        This action cannot be undone.
      </p>

      <div className="flex justify-end gap-3">

        <button
          onClick={() => setShowDeleteModal(false)}
          className="
            px-4 py-2
            rounded-xl
            bg-white/5
            border border-white/10
            hover:bg-white/10
          "
        >
          Cancel
        </button>

        <button
  onClick={handleDelete}
  className="
    px-4 py-2
    rounded-xl

    bg-red-600
    text-white

    hover:bg-red-700

    transition-all
  "
>
  {deleting
  ? "Deleting..."
  : "Delete Assessment"}
</button>

      </div>

    </div>

  </div>
)}
    </div>
  );
}