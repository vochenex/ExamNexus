const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const { createClient } = require("@supabase/supabase-js");
const { getSupabaseAdmin } = require("../lib/supabaseAdmin");

const generateInviteCode = () =>
  crypto.randomBytes(4).toString("hex");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const getSupabaseForUser = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return supabase;

  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      global: {
        headers: { Authorization: authHeader },
      },
    }
  );
};

//
// CREATE SUBJECT
//
router.post("/create", async (req, res) => {
  try {
    const { name, teacher_school_id } = req.body;
    console.log("Incoming subject data:");
console.log({
  name,
  teacher_school_id,
});

    const { data, error } = await supabase
      .from("subjects")
      .insert([
        {
          name,
          teacher_school_id,
          invite_code: generateInviteCode(),
        },
      ])
      .select()
      .single();

    if (error) {
  console.error("SUPABASE ERROR:");
  console.error(error);
  throw error;
}

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//
// GET TEACHER SUBJECTS (MY COURSES)
//
router.get("/teacher/:teacherId", async (req, res) => {
  try {
    const { teacherId } = req.params;

    const { data, error } = await supabase
      .from("subjects")
      .select("*")
      .eq("teacher_school_id", teacherId);

    if (error) throw error;

    res.json(data);
  } catch (err) {
  console.error("CREATE SUBJECT ERROR:");
  console.error(err);

  res.status(500).json({
    error: err.message,
  });
}
});

//
// GET SINGLE SUBJECT
//
router.get("/:subjectId", async (req, res) => {
  try {
    const { subjectId } = req.params;

    const { data, error } = await supabase
      .from("subjects")
      .select("*")
      .eq("id", subjectId)
      .single();

    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//
// JOIN SUBJECT (STUDENT USES INVITE CODE)
//
const joinSubject = async (req, res) => {
  try {
    const { invite_code, student_id, section = "A" } = req.body;
    const normalizedCode = String(invite_code || "").trim().toLowerCase();
    const enrollSection = String(section || "A").trim().toUpperCase();

    if (!["A", "B", "C"].includes(enrollSection)) {
      return res.status(400).json({ error: "Section must be A, B, or C" });
    }
    const authHeader = req.headers.authorization;

    if (!normalizedCode) {
      return res.status(400).json({ error: "Invitation code is required" });
    }

    if (!student_id) {
      return res.status(400).json({ error: "Student ID is required" });
    }

    if (!authHeader) {
      return res.status(401).json({
        error: "Your login session expired. Please log out and log in again.",
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const userSupabase = getSupabaseForUser(req);
    const {
      data: { user: authUser },
      error: authError,
    } = await userSupabase.auth.getUser(token);

    if (authError || !authUser) {
      return res.status(401).json({
        error: "Your login session expired. Please log out and log in again.",
      });
    }

    if (authUser.id !== student_id) {
      return res.status(403).json({ error: "Invalid student session." });
    }

    const { data: subject, error: subError } = await supabase
      .from("subjects")
      .select("id, name, invite_code, teacher_school_id")
      .eq("invite_code", normalizedCode)
      .maybeSingle();

    if (subError) throw subError;

    if (!subject) {
      return res.status(404).json({ error: "Invalid invitation code" });
    }

    const dbClient = getSupabaseAdmin() || userSupabase;

    const { data: existingEnrollment, error: existingError } = await dbClient
      .from("subject_students")
      .select("subject_id")
      .eq("student_id", student_id)
      .eq("subject_id", subject.id)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existingEnrollment) {
      return res.status(409).json({
        error: `You are already enrolled in ${subject.name}.`,
        subject,
      });
    }

    const { data: enrolled, error } = await dbClient
      .from("subject_students")
      .insert([
        {
          subject_id: subject.id,
          student_id,
          section: enrollSection,
        },
      ])
      .select()
      .single();

    if (error) {
      if (error.code === "42501") {
        return res.status(500).json({
          error:
            "Enrollment is not configured yet. Add SUPABASE_SERVICE_ROLE_KEY to backend/.env and restart the backend.",
        });
      }
      if (error.code === "23505") {
        return res.status(409).json({
          error: `You are already enrolled in ${subject.name}.`,
          subject,
        });
      }
      throw error;
    }

    if (!enrolled) {
      return res.status(500).json({
        error: "Enrollment failed. Please try again.",
      });
    }

    res.json({
      success: true,
      message: `Successfully enrolled in ${subject.name}.`,
      subject,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

router.post("/join", joinSubject);
router.post("/enroll", joinSubject);
//
// GET SUBJECT ASSESSMENTS
//
router.get("/:subjectId/assessments", async (req, res) => {
  try {
    const { subjectId } = req.params;

    const { data, error } = await supabase
      .from("exams")
      .select("*")
      .eq("subject_id", subjectId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//
// GET STUDENTS IN SUBJECT
//
router.get("/:subjectId/students", async (req, res) => {
  try {
    const { subjectId } = req.params;

    const { data, error } = await supabase
      .from("subject_students")
      .select("student_id")
      .eq("subject_id", subjectId);

    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
//
// DELETE SUBJECT
//
router.delete("/:subjectId", async (req, res) => {
  try {
    const { subjectId } = req.params;

    const { error } = await supabase
      .from("subjects")
      .delete()
      .eq("id", subjectId);

    if (error) throw error;

    res.json({
      success: true,
      message: "Subject deleted successfully",
    });
  } catch (err) {
    console.error("DELETE SUBJECT ERROR:");
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
});
module.exports = router;