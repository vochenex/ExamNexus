/**
 * Express app factory — used by local `server.js` and Vercel `api/index.js`.
 */
const path = require("path");
const fs = require("fs");

// Load backend/.env for local runs only. On Vercel, env vars come from the dashboard
// and must not be overridden by a missing/empty file.
if (!process.env.VERCEL) {
  require("dotenv").config({
    path: path.join(__dirname, ".env"),
    override: true,
  });
}

const express = require("express");
const cors = require("cors");
const { createAnonClient } = require("./lib/supabaseClient");

const subjectsRoute = require("./routes/subjectsRoute");
const analyticsRoute = require("./routes/analyticsRoute");
const passwordResetRoute = require("./routes/passwordResetRoute");
const assessmentAiRoute = require("./routes/assessmentAiRoute");
const pushRoute = require("./routes/pushRoute");
const { getSupabaseAdmin } = require("./lib/supabaseAdmin");
const { getAiServiceStatus } = require("./lib/aiProvider");
const { isPushConfigured, getPushApiMode } = require("./lib/pushSender");

function ensureUploadsDir() {
  try {
    fs.mkdirSync(path.join(__dirname, "uploads"), { recursive: true });
  } catch {
    // Serverless filesystems may be read-only outside /tmp — memory uploads cover that.
  }
}

function getSupabase() {
  return createAnonClient();
}

function createApp() {
  ensureUploadsDir();

  const app = express();

  app.use(cors({ origin: "*" }));
  app.use(express.json({ limit: "2mb" }));

  // Vercel Services may forward /api/... to this Express app with the prefix intact.
  app.use((req, _res, next) => {
    const url = req.url || "/";
    if (url === "/api") {
      req.url = "/";
    } else if (url.startsWith("/api?")) {
      req.url = `/${url.slice(4)}`;
    } else if (url.startsWith("/api/")) {
      req.url = url.slice(4) || "/";
    }
    next();
  });

  app.get("/", (req, res) => {
    res.send("🚀 ExamNexus Backend Running");
  });

  app.get("/health", async (req, res) => {
    try {
      const hasServiceRole = Boolean(getSupabaseAdmin());
      let aiStatus = {
        configured: false,
        error: "AI status unavailable",
      };
      try {
        aiStatus = await getAiServiceStatus();
      } catch (err) {
        aiStatus = { configured: false, error: err.message };
      }

      const hasSupabase = Boolean(
        process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
      );
      const hasAnon = Boolean(
        process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
      );

      res.json({
        ok: hasSupabase && hasAnon,
        passwordReset: hasServiceRole,
        enrollment: hasServiceRole,
        assessmentAi: aiStatus.configured,
        pushNotifications: isPushConfigured(),
        pushApi: getPushApiMode(),
        promptProvider: aiStatus.promptProvider,
        documentProvider: aiStatus.documentProvider,
        promptModel: aiStatus.promptModel,
        documentModel: aiStatus.documentModel,
        supabaseConfigured: hasSupabase && hasAnon,
        message: !hasSupabase || !hasAnon
          ? "Add SUPABASE_URL and SUPABASE_ANON_KEY in Vercel Environment Variables"
          : hasServiceRole
            ? "Service role key loaded"
            : "Add SUPABASE_SERVICE_ROLE_KEY (Supabase → Project Settings → API → service_role)",
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get("/exams", async (req, res) => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.from("exams").select("*");
      if (error) throw error;
      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/manual-exam", async (req, res) => {
    try {
      const supabase = getSupabase();
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

      if (!title?.trim()) {
        return res.status(400).json({ error: "Title is required" });
      }

      if (!Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ error: "No questions provided" });
      }

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
        return res.status(400).json({ error: "All questions are empty" });
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
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/exam/:examId", async (req, res) => {
    try {
      const supabase = getSupabase();
      const { examId } = req.params;

      const { data: exam, error: examError } = await supabase
        .from("exams")
        .select("*")
        .eq("id", examId)
        .single();

      if (examError) throw examError;

      const now = new Date();
      let status = "active";
      if (exam.start_datetime && now < new Date(exam.start_datetime)) {
        status = "scheduled";
      }
      if (exam.end_datetime && now > new Date(exam.end_datetime)) {
        status = "closed";
      }

      let timeRemaining = null;
      if (status === "active" && exam.end_datetime) {
        const diff = new Date(exam.end_datetime) - now;
        if (diff > 0) {
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          const hours = Math.floor(
            (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
          );
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
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("subjects")
        .insert([
          {
            name: "TEST SUBJECT",
            teacher_school_id: "202302440",
          },
        ])
        .select();

      res.json({ data, error });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/exam/:examId", async (req, res) => {
    try {
      const supabase = getSupabase();
      const { examId } = req.params;
      const { exam, questions } = req.body;

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

      const { data: existingQuestions, error: existingError } = await supabase
        .from("questions")
        .select("id")
        .eq("exam_id", examId);

      if (existingError) throw existingError;

      const incomingIds = questions.filter((q) => q.id).map((q) => q.id);
      const deletedIds = existingQuestions
        .filter((q) => !incomingIds.includes(q.id))
        .map((q) => q.id);

      if (deletedIds.length > 0) {
        const { error: deleteError } = await supabase
          .from("questions")
          .delete()
          .in("id", deletedIds);
        if (deleteError) throw deleteError;
      }

      for (const q of questions) {
        if (q.id) {
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
          const { error: qError } = await supabase.from("questions").insert([
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
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/exam/:examId", async (req, res) => {
    try {
      const supabase = getSupabase();
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
      res.status(500).json({ error: err.message });
    }
  });

  app.use("/subjects", subjectsRoute);
  app.use("/analytics", analyticsRoute);
  app.use("/password-reset", passwordResetRoute);
  app.use("/assessment-ai", assessmentAiRoute);
  app.use("/push", pushRoute);

  app.use((err, req, res, next) => {
    console.error("GLOBAL EXPRESS ERROR:", err);
    res.status(500).json({
      error: err.message || "Internal Server Error",
    });
  });

  return app;
}

module.exports = { createApp };
