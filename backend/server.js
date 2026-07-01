require("dotenv").config({
  path: require("path").join(__dirname, ".env"),
  override: true,
});
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err?.message || err);
});

process.on("unhandledRejection", (reason) => {
  const code = reason?.cause?.code || reason?.code;
  if (
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "SUPABASE_FETCH_TIMEOUT" ||
    String(reason?.message || "").includes("fetch failed")
  ) {
    console.warn(
      "⚠️  Supabase network timeout (backend still running). Check your internet connection."
    );
    return;
  }
  console.error("UNHANDLED REJECTION:", reason?.message || reason);
});
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { createAnonClient } = require("./lib/supabaseClient");

// Routes
const subjectsRoute = require("./routes/subjectsRoute");
const analyticsRoute = require("./routes/analyticsRoute");
const passwordResetRoute = require("./routes/passwordResetRoute");
const assessmentAiRoute = require("./routes/assessmentAiRoute");
const { getSupabaseAdmin } = require("./lib/supabaseAdmin");
const { getAiServiceStatus } = require("./lib/aiProvider");

// ================= INIT APP =================
const app = express();

// ================= MIDDLEWARE =================
app.use(cors({ origin: "*" }));
app.use(express.json());
fs.mkdirSync(path.join(__dirname, "uploads"), { recursive: true });
const upload = multer({ dest: "uploads/" });

// ================= SUPABASE =================
const supabase = createAnonClient();

// ================= HEALTH CHECK =================
app.get("/", (req, res) => {
  res.send("🚀 ExamNexus Backend Running");
});

app.get("/health", async (req, res) => {
  const hasServiceRole = Boolean(getSupabaseAdmin());
  const aiStatus = await getAiServiceStatus();
  res.json({
    ok: true,
    passwordReset: hasServiceRole,
    enrollment: hasServiceRole,
    assessmentAi: aiStatus.configured,
    promptProvider: aiStatus.promptProvider,
    documentProvider: aiStatus.documentProvider,
    promptModel: aiStatus.promptModel,
    documentModel: aiStatus.documentModel,
    message: hasServiceRole
      ? "Service role key loaded"
      : "Add SUPABASE_SERVICE_ROLE_KEY to backend/.env (Supabase → Project Settings → API → service_role)",
  });
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
app.use("/assessment-ai", assessmentAiRoute);
app.use((err, req, res, next) => {
  console.error("GLOBAL EXPRESS ERROR:", err);

  res.status(500).json({
    error: err.message || "Internal Server Error",
  });
});
// ================= START SERVER =================
const PREFERRED_PORT = Number(process.env.PORT) || 5000;
const MAX_PORT_TRIES = 10;

function syncFrontendApiUrl(port) {
  if (port === 5000) return;

  const apiUrl = `http://localhost:${port}`;
  const envPath = path.join(__dirname, "..", ".env");
  let content = "";

  try {
    content = fs.readFileSync(envPath, "utf8");
  } catch {
    content = "";
  }

  const line = `VITE_API_BASE_URL=${apiUrl}`;
  if (/^VITE_API_BASE_URL=/m.test(content)) {
    content = content.replace(/^VITE_API_BASE_URL=.*$/m, line);
  } else {
    content = `${content.trimEnd()}${content ? "\n" : ""}${line}\n`;
  }

  fs.writeFileSync(envPath, content);
  console.log(`   Updated root .env → ${line}`);
  console.log("   Vite will restart automatically to use the new backend URL.");
}

function listenOnAvailablePort(port, attempt = 0) {
  const server = app.listen(port);

  server.on("listening", async () => {
    const actualPort = server.address().port;

    if (actualPort !== PREFERRED_PORT) {
      console.warn(
        `⚠️  Port ${PREFERRED_PORT} was busy — using http://localhost:${actualPort} instead.`
      );
      syncFrontendApiUrl(actualPort);
    }

    console.log(`🚀 Backend running on http://localhost:${actualPort}`);
    console.log("   Keep this terminal open while using the app.");

    if (getSupabaseAdmin()) {
      console.log("✅ Service role key loaded (password reset + enrollment enabled)");
    } else {
      console.log(
        "⚠️  SUPABASE_SERVICE_ROLE_KEY is missing or empty in backend/.env"
      );
      console.log(
        "    → Supabase Dashboard → Project Settings → API → copy service_role key"
      );
      console.log(
        "    → Admin password resets and invite enrollment will not work until set"
      );
    }

    try {
      const aiStatus = await getAiServiceStatus();
      if (aiStatus.configured) {
        console.log(`✅ Assessment AI ready (Gemini: ${aiStatus.model})`);
      } else {
        console.log(`⚠️  Assessment AI unavailable — ${aiStatus.error}`);
      }
    } catch (err) {
      console.log(`⚠️  Assessment AI status check failed — ${err.message}`);
    }

    if (!String(process.env.SUPABASE_JWT_SECRET || "").trim()) {
      console.log(
        "⚠️  SUPABASE_JWT_SECRET is not set — faculty auth may fail when Supabase is slow."
      );
      console.log(
        "    → Supabase Dashboard → Project Settings → API → JWT Secret → add to backend/.env"
      );
    }
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE" && attempt + 1 < MAX_PORT_TRIES) {
      console.warn(`Port ${port} is in use, trying ${port + 1}...`);
      listenOnAvailablePort(port + 1, attempt + 1);
      return;
    }

    if (err.code === "EADDRINUSE") {
      console.error(
        `\n❌ No free port found between ${PREFERRED_PORT} and ${port}.`
      );
      console.error("   To free port 5000 in PowerShell, run this exact command:");
      console.error(
        "   Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"
      );
      process.exit(1);
      return;
    }

    console.error("Server failed to start:", err);
    process.exit(1);
  });

  return server;
}

listenOnAvailablePort(PREFERRED_PORT);