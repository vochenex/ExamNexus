const express = require("express");
const router = express.Router();
const { createAnonClient } = require("../lib/supabaseClient");

const supabase = createAnonClient();

router.get("/:examId", async (req, res) => {
  try {
    const { examId } = req.params;

    const { data, error } = await supabase
      .from("student_answers")
      .select("question_id, student_id, is_correct")
      .eq("exam_id", examId);

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.json({
        questionDifficulty: [],
        studentPerformance: [],
        classAverage: 0,
      });
    }

    // QUESTION ANALYTICS
    const qMap = {};

    data.forEach((a) => {
      if (!qMap[a.question_id]) {
        qMap[a.question_id] = { total: 0, correct: 0 };
      }
      qMap[a.question_id].total++;
      if (a.is_correct) qMap[a.question_id].correct++;
    });

    const questionDifficulty = Object.keys(qMap).map((id) => {
      const q = qMap[id];
      const accuracy = (q.correct / q.total) * 100;

      return {
        question_id: id,
        accuracy_rate: Number(accuracy.toFixed(2)),
        wrong: q.total - q.correct,
        total: q.total,
      };
    });

    // STUDENT ANALYTICS
    const sMap = {};

    data.forEach((a) => {
      if (!sMap[a.student_id]) {
        sMap[a.student_id] = { total: 0, correct: 0 };
      }

      sMap[a.student_id].total++;
      if (a.is_correct) sMap[a.student_id].correct++;
    });

    const studentPerformance = Object.keys(sMap).map((id) => {
      const s = sMap[id];
      const score = (s.correct / s.total) * 100;

      return {
        student_id: id,
        score: Number(score.toFixed(2)),
      };
    });

    const totalCorrect = data.filter((a) => a.is_correct).length;
    const classAverage =
      data.length > 0 ? (totalCorrect / data.length) * 100 : 0;

    res.json({
      questionDifficulty,
      studentPerformance,
      classAverage: Number(classAverage.toFixed(2)),
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;