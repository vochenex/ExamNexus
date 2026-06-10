require("dotenv").config();
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:");
  console.error(err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("UNHANDLED REJECTION:");
  console.error(reason);
});
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");

// Routes
const subjectsRoute = require("./routes/subjectsRoute");
const analyticsRoute = require("./routes/analyticsRoute");
const passwordResetRoute = require("./routes/passwordResetRoute");
const { getSupabaseAdmin } = require("./lib/supabaseAdmin");

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
      return res.status(400).json({
        error: "Title is required",
      });

    if (!Array.isArray(questions) || questions.length === 0)
      return res.status(400).json({
        error: "No questions provided",
      });

    // CREATE EXAM
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

    // FORMAT QUESTIONS
    // FORMAT QUESTIONS
const formattedQuestions = questions
  .filter((q) => q.question?.trim() !== "")
  .map((q) => ({
    exam_id: exam.id,

    question: q.question,

    option_a: q.option_a || "",
    option_b: q.option_b || "",
    option_c: q.option_c || "",
    option_d: q.option_d || "",

    correct_answer: q.correct_answer || "",
  }));

if (formattedQuestions.length === 0) {
  return res.status(400).json({
    error: "All questions are empty",
  });
}

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

    res.status(500).json({
      error: err.message,
    });
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

console.log("EXAM QUERY RESULT:", exam);
console.log("EXAM QUERY ERROR:", examError);
    if (examError) {
  console.error(examError);
  throw examError;
}

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
// ================= UPDATE EXAM =================
app.put("/exam/:examId", async (req, res) => {
  try {
    const { examId } = req.params;
    const { exam, questions } = req.body;

    // UPDATE EXAM
    const { error: examError } = await supabase
      .from("exams")
      .update({
        title: exam.title,
        description: exam.description,
        exam_type: exam.exam_type,
        start_datetime: exam.start_datetime,
        end_datetime: exam.end_datetime,
      })
      .eq("id", examId);

    if (examError) throw examError;

    // GET EXISTING QUESTIONS
    const { data: existingQuestions, error: existingError } =
      await supabase
        .from("questions")
        .select("id")
        .eq("exam_id", examId);

    if (existingError) throw existingError;

    // IDS FROM FRONTEND
    const incomingIds = questions
      .filter((q) => q.id)
      .map((q) => q.id);

    // FIND DELETED QUESTIONS
    const deletedIds = existingQuestions
      .filter((q) => !incomingIds.includes(q.id))
      .map((q) => q.id);

    // DELETE REMOVED QUESTIONS
    if (deletedIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("questions")
        .delete()
        .in("id", deletedIds);

      if (deleteError) throw deleteError;
    }

    // UPDATE OR INSERT QUESTIONS
    for (const q of questions) {

      if (q.id) {

        // UPDATE EXISTING QUESTION
        const { error: qError } = await supabase
          .from("questions")
          .update({
            question: q.question,

            option_a: q.option_a || "",
            option_b: q.option_b || "",
            option_c: q.option_c || "",
            option_d: q.option_d || "",

            correct_answer: q.correct_answer || "",
          })
          .eq("id", q.id);

        if (qError) throw qError;

      } else {

        // INSERT NEW QUESTION
        const { error: qError } = await supabase
          .from("questions")
          .insert([
            {
              exam_id: examId,

              question: q.question,

              option_a: q.option_a || "",
              option_b: q.option_b || "",
              option_c: q.option_c || "",
              option_d: q.option_d || "",

              correct_answer: q.correct_answer || "",
            },
          ]);

        if (qError) throw qError;
      }
    }

    res.json({
      success: true,
      message: "Assessment updated successfully",
    });

  } catch (err) {
    console.error("UPDATE EXAM ERROR:", err);

    res.status(500).json({
      error: err.message,
    });
  }
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
    console.error(err);
    res.status(500).json({
      error: err.message,
    });
  }
});

app.use("/subjects", subjectsRoute);
app.use("/analytics", analyticsRoute);
app.use("/password-reset", passwordResetRoute);
app.use((err, req, res, next) => {
  console.error("GLOBAL EXPRESS ERROR:", err);

  res.status(500).json({
    error: err.message || "Internal Server Error",
  });
});
// ================= START SERVER =================
app.listen(5000, () => {
  console.log("🚀 Backend running on http://localhost:5000");
  if (getSupabaseAdmin()) {
    console.log("✅ Student enrollment: service role key loaded");
  } else {
    console.log(
      "⚠️  Student enrollment: add SUPABASE_SERVICE_ROLE_KEY to backend/.env"
    );
  }
});