import supabase from "../supabaseClient.js";

export const getExamAnalytics = async (req, res) => {
  const { examId } = req.params;

  try {
    const { data, error } = await supabase
      .from("student_answers")
      .select("question_id, student_id, is_correct")
      .eq("exam_id", examId);

    if (error) throw error;

    // ---------------------------
    // QUESTION DIFFICULTY
    // ---------------------------
    const questionMap = {};

    data.forEach((a) => {
      if (!questionMap[a.question_id]) {
        questionMap[a.question_id] = { total: 0, correct: 0 };
      }

      questionMap[a.question_id].total += 1;
      if (a.is_correct) questionMap[a.question_id].correct += 1;
    });

    const questionDifficulty = Object.keys(questionMap).map((id) => {
      const q = questionMap[id];
      const accuracy = (q.correct / q.total) * 100;

      return {
        question_id: id,
        total_answers: q.total,
        correct: q.correct,
        wrong: q.total - q.correct,
        accuracy_rate: Number(accuracy.toFixed(2)),
      };
    });

    questionDifficulty.sort((a, b) => a.accuracy_rate - b.accuracy_rate);

    // ---------------------------
    // STUDENT PERFORMANCE
    // ---------------------------
    const studentMap = {};

    data.forEach((a) => {
      if (!studentMap[a.student_id]) {
        studentMap[a.student_id] = { total: 0, correct: 0 };
      }

      studentMap[a.student_id].total += 1;
      if (a.is_correct) studentMap[a.student_id].correct += 1;
    });

    const studentPerformance = Object.keys(studentMap).map((id) => {
      const s = studentMap[id];
      const score = (s.correct / s.total) * 100;

      return {
        student_id: id,
        score: Number(score.toFixed(2)),
        correct: s.correct,
        total: s.total,
      };
    });

    studentPerformance.sort((a, b) => b.score - a.score);

    // ---------------------------
    // CLASS AVERAGE
    // ---------------------------
    const totalCorrect = data.filter((a) => a.is_correct).length;

    const classAverage =
      data.length > 0 ? (totalCorrect / data.length) * 100 : 0;

    // ---------------------------
    // RESPONSE
    // ---------------------------
    res.json({
      questionDifficulty,
      studentPerformance,
      classAverage: Number(classAverage.toFixed(2)),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
};