const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/* ================= GET EXAMS ================= */
exports.getExams = async (req, res) => {
  const { data, error } = await supabase
    .from("exams")
    .select("*");

  if (error) {
    return res.status(500).json({
      error: error.message,
    });
  }

  res.json(data);
};

/* ================= GENERATE QUESTIONS ================= */
exports.generateQuestions = async (req, res) => {
  try {
    const {
      text,
      title,
      description,
      created_by,
      exam_type,
      duration_value,
      duration_unit,
      subject_id,

      // NEW
      start_datetime,
      end_datetime,
    } = req.body;

    if (!text) {
      return res.status(400).json({
        error: "No text provided",
      });
    }

    // TEMP MOCK
    const questions = [
      {
        question: "What is the main idea of the text?",
        option_a: "A",
        option_b: "B",
        option_c: "C",
        option_d: "D",
        correct_answer: "A",
      },
    ];

    console.log("START:", start_datetime);
    console.log("END:", end_datetime);

    // CREATE EXAM
    const { data: exam, error } = await supabase
      .from("exams")
      .insert([
        {
          title,
          description,
          created_by,
          exam_type,
          duration_value,
          duration_unit,
          subject_id,

          // NEW
          start_datetime,
          end_datetime,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    // INSERT QUESTIONS
    const formatted = questions.map((q) => ({
      exam_id: exam.id,
      question: q.question,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_answer: q.correct_answer,
    }));

    const { error: questionError } = await supabase
      .from("questions")
      .insert(formatted);

    if (questionError) throw questionError;

    res.json({
      success: true,
      exam,
      questions,
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
};