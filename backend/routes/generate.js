const express = require("express");
const router = express.Router();
const { OpenAI } = require("openai");
const { createAnonClient } = require("../lib/supabaseClient");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createAnonClient();

router.post("/generate-questions", async (req, res) => {
  try {
     const {
  text,
  title,
  description,
  created_by,
  start_datetime,
  end_datetime
} = req.body;

    if (!text) {
      return res.status(400).json({ error: "No text provided" });
    }

    // ================= AI GENERATION =================
    const prompt = `
Convert this text into 5 multiple-choice questions.

Return ONLY valid JSON:

[
  {
    "question": "",
    "option_a": "",
    "option_b": "",
    "option_c": "",
    "option_d": "",
    "correct_answer": "A"
  }
]

TEXT:
${text}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    let aiText = response.choices[0].message.content;
    aiText = aiText.replace(/```json/g, "").replace(/```/g, "");

    const questions = JSON.parse(aiText);

    console.log("START:", start_datetime);
    console.log("END:", end_datetime);

    // ================= SAVE EXAM =================
    const { data: exam, error: examError } = await supabase
      .from("exams")
      .insert([
  {
    title: title || "AI Generated Exam",
    description: description || "Generated from uploaded document",
    created_by: created_by || "faculty",
    start_datetime,
    end_datetime,
  },
])
      .select()
      .single();

    if (examError) throw examError;

    // ================= SAVE QUESTIONS =================
    const formatted = questions.map((q) => ({
      exam_id: exam.id,
      question: q.question,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_answer: q.correct_answer,
    }));

    const { error: qError } = await supabase
      .from("questions")
      .insert(formatted);

    if (qError) throw qError;

    // ================= RESPONSE =================
    res.json({
      success: true,
      exam,
      questions,
    });

  } catch (err) {
    res.status(500).json({
      error: "AI generation failed",
      details: err.message,
    });
  }
});

module.exports = router;