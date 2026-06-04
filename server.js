require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");

// Routes
const subjectsRoute = require("./routes/subjectsRoute");
const analyticsRoute = require("./routes/analyticsRoute");

// ================= INIT APP =================
const app = express();

// ================= MIDDLEWARE =================
app.use(cors({ origin: "*" }));
app.use(express.json());
const upload = multer({ dest: "uploads/" });

// ================= SUPABASE =================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ================= HEALTH CHECK =================
app.get("/", (req, res) => {
  res.send("🚀 ExamNexus Backend Running");
});

// ================= GET ALL EXAMS =================
app.get("/exams", async (req, res) => {
  try {
    const { data, error } = await supabase.from("exams").select("*");
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ================= MANUAL EXAM =================
app.post("/manual-exam", async (req, res) => {
  try {
    const {
      subject_id,
      title,
      description,
      exam_type,
      start_datetime,
      end_datetime,
      created_by = null,
      questions = [],
    } = req.body;

    if (!title?.trim())
      return res.status(400).json({ error: "Title is required" });

    if (!Array.isArray(questions) || questions.length === 0)
      return res.status(400).json({ error: "No questions provided" });

    const { data: exam, error: examError } = await supabase
      .from("exams")
      .insert([
        {
          subject_id,
          title,
          description,
          exam_type,
          start_datetime,
          end_datetime,
          created_by,
        },
      ])
      .select()
      .single();
    if (examError) throw examError;

    const formattedQuestions = questions
      .filter((q) => q?.question?.trim())
      .map((q) => ({
        exam_id: exam.id,
        question: q.question,
        option_a: q.option_a || "",
        option_b: q.option_b || "",
        option_c: q.option_c || "",
        option_d: q.option_d || "",
        correct_answer: q.correct_answer || q.answer || null,
      }));

    if (formattedQuestions.length === 0)
      return res.status(400).json({ error: "All questions are empty" });

    const { error: qError } = await supabase
      .from("questions")
      .insert(formattedQuestions);
    if (qError) throw qError;

    res.json({
      success: true,
      message: "Exam created successfully",
      exam,
      questions: formattedQuestions,
    });
  } catch (err) {
    console.error("❌ manual-exam error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= GET SINGLE EXAM =================
app.get("/exam/:examId", async (req, res) => {
  try {
    const { examId } = req.params;

    const { data: exam, error: examError } = await supabase
      .from("exams")
      .select("*")
      .eq("id", examId)
      .single();
    if (examError) throw examError;

    const now = new Date();
    let status = "active";
    if (exam.start_datetime && now < new Date(exam.start_datetime))
      status = "scheduled";
    if (exam.end_datetime && now > new Date(exam.end_datetime)) status = "closed";

    let timeRemaining = null;
    if (status === "active" && exam.end_datetime) {
      const diff = new Date(exam.end_datetime) - now;
      if (diff > 0) {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        timeRemaining = `${days}d ${hours}h`;
      }
    }

    const { data: questions, error: qError } = await supabase
      .from("questions")
      .select("*")
      .eq("exam_id", examId);
    if (qError) throw qError;

    res.json({
      exam: {
        ...exam,
        status,
        timeRemaining,
      },
      questions,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
app.get("/test-insert", async (req, res) => {
  const { data, error } = await supabase
    .from("subjects")
    .insert([
      {
        name: "TEST SUBJECT",
        teacher_school_id: "202302440",
      },
    ])
    .select();

  res.json({
    data,
    error,
  });
});
// ================= DELETE EXAM =================
app.delete("/exam/:examId", async (req, res) => {
  try {
    const { examId } = req.params;

    const { error: questionError } = await supabase
      .from("questions")
      .delete()
      .eq("exam_id", examId);
    if (questionError) throw questionError;

    const { error: examError } = await supabase
      .from("exams")
      .delete()
      .eq("id", examId);
    if (examError) throw examError;

    res.json({
      success: true,
      message: "Assessment deleted successfully",
    });
  } catch (err) {
    console.error("❌ delete exam error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= ROUTES =================
app.use("/subjects", subjectsRoute);
app.use("/analytics", analyticsRoute);

// ================= START SERVER =================
app.listen(5000, () => {
  console.log("🚀 Backend running on http://localhost:5000");
});