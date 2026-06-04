const express = require("express");
const router = express.Router();
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

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
router.post("/join", async (req, res) => {
  try {
    const { invite_code, student_id } = req.body;

    const { data: subject, error: subError } = await supabase
      .from("subjects")
      .select("*")
      .eq("invite_code", invite_code)
      .single();

    if (subError || !subject) {
      return res.status(404).json({ error: "Invalid invite code" });
    }

    const { error } = await supabase
      .from("subject_students")
      .insert([
        {
          subject_id: subject.id,
          student_id,
        },
      ]);

    if (error) throw error;

    res.json({
      success: true,
      subject,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
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