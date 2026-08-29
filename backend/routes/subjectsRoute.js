const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const { createAnonClient, createUserClient } = require("../lib/supabaseClient");
const { getSupabaseAdmin } = require("../lib/supabaseAdmin");

const generateInviteCode = () =>
  crypto.randomBytes(4).toString("hex");

function getAnon() {
  return createAnonClient();
}

const getSupabaseForUser = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return getAnon();

  const accessToken = String(authHeader).replace(/^Bearer\s+/i, "").trim();
  return createUserClient(accessToken);
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

    const { data, error } = await getAnon()
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

    const { data, error } = await getAnon()
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

    const { data, error } = await getAnon()
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
    const { invite_code, student_id, section = null } = req.body;
    const normalizedCode = String(invite_code || "").trim().toLowerCase();
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

    const dbClient = getSupabaseAdmin() || userSupabase;
    let enrollSection = String(section || "").trim().toUpperCase();
    let subject = null;

    const { data: sectionInvite, error: sectionInviteError } = await dbClient
      .from("subject_section_invites")
      .select(
        "section, invite_code, subject_id, subjects ( id, name, invite_code, teacher_school_id, section_count )"
      )
      .eq("invite_code", normalizedCode)
      .maybeSingle();

    if (
      sectionInviteError &&
      !String(sectionInviteError.message || "").includes("subject_section_invites")
    ) {
      throw sectionInviteError;
    }

    if (sectionInvite?.subjects) {
      subject = {
        id: sectionInvite.subjects.id,
        name: sectionInvite.subjects.name,
        invite_code: sectionInvite.invite_code,
        teacher_school_id: sectionInvite.subjects.teacher_school_id,
        section_count: sectionInvite.subjects.section_count,
      };
      enrollSection = String(sectionInvite.section || "A").toUpperCase();
    } else {
      const { data: legacySubject, error: subError } = await dbClient
        .from("subjects")
        .select("id, name, invite_code, teacher_school_id, section_count")
        .eq("invite_code", normalizedCode)
        .maybeSingle();

      if (subError) throw subError;
      subject = legacySubject;
      if (!enrollSection) enrollSection = "A";
    }

    if (!subject) {
      return res.status(404).json({ error: "Invalid invitation code" });
    }

    if (!/^[A-L]$/.test(enrollSection)) {
      return res.status(400).json({ error: "Section must be a letter from A to L" });
    }

    const maxSections = Math.min(12, Math.max(1, Number(subject.section_count) || 3));
    const sectionIndex = enrollSection.charCodeAt(0) - 64;
    if (sectionIndex > maxSections) {
      return res.status(400).json({
        error: `Section ${enrollSection} is not available for this subject (only ${maxSections} section(s)).`,
      });
    }

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
        subject: { ...subject, section: enrollSection, invite_code: normalizedCode },
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
          subject: { ...subject, section: enrollSection, invite_code: normalizedCode },
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
      subject: {
        ...subject,
        section: enrollSection,
        invite_code: normalizedCode,
      },
    });
  } catch (err) {
    console.error("JOIN SUBJECT ERROR:", err);
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

    let { data, error } = await getAnon()
      .from("exams")
      .select("*")
      .eq("subject_id", subjectId)
      .order("created_at", { ascending: false });

    if (error?.message?.toLowerCase().includes("created_at")) {
      ({ data, error } = await getAnon()
        .from("exams")
        .select("*")
        .eq("subject_id", subjectId)
        .order("start_datetime", { ascending: false, nullsFirst: false }));
    }

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

    const { data, error } = await getAnon()
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

    const { error } = await getAnon()
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