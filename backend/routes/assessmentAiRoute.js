const express = require("express");
const multer = require("multer");
const { requireFaculty } = require("../middleware/requireFaculty");
const {
  extractDocumentText,
  cleanupUploadedFile,
  isSupportedUpload,
} = require("../lib/documentExtractor");
const {
  requestAiQuestions,
  requestSingleAiQuestion,
  parseFormats,
  clampQuestionCount,
  getAiServiceStatus,
} = require("../lib/assessmentAiGenerator");

const router = express.Router();

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 },
});

function handleRouteError(res, err) {
  const status = err.statusCode || 500;
  const message = err.message || "AI assessment generation failed";

  if (status >= 500) {
    console.error("assessment-ai error:", err);
  }

  res.status(status).json({ error: message });
}

router.get("/status", requireFaculty, async (req, res) => {
  const status = await getAiServiceStatus();

  if (!status.configured) {
    return res.status(503).json({
      ok: false,
      configured: false,
      provider: status.provider,
      model: status.model,
      installedModels: status.installedModels || [],
      error: status.error,
    });
  }

  res.json({
    ok: true,
    configured: true,
    provider: status.provider,
    model: status.model,
    installedModels: status.installedModels || [],
  });
});

router.get("/public-config", async (req, res) => {
  const status = await getAiServiceStatus();
  res.json({
    provider: status.provider,
    model: status.model,
    configured: status.configured,
    error: status.error || null,
  });
});

router.post(
  "/extract-document",
  requireFaculty,
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err?.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "File is too large. Maximum size is 10 MB." });
      }
      if (err) {
        return res.status(400).json({ error: err.message || "File upload failed." });
      }
      next();
    });
  },
  async (req, res) => {
    const file = req.file;

    try {
      if (!file) {
        return res.status(400).json({ error: "Upload a PDF or Word (.docx) file." });
      }

      if (!isSupportedUpload(file)) {
        return res.status(400).json({
          error: "Unsupported file type. Use PDF or Word (.docx) only.",
        });
      }

      const text = await extractDocumentText(file);
      res.json({ text, extractedChars: text.length });
    } catch (err) {
      handleRouteError(res, err);
    } finally {
      cleanupUploadedFile(file);
    }
  }
);

router.post("/generate-one", requireFaculty, async (req, res) => {
  try {
    const {
      prompt,
      topic,
      sourceText,
      format,
      formats,
      difficulty,
      stepIndex,
      totalSteps,
      additionalInstructions,
    } = req.body || {};

    const topicPrompt = String(prompt || topic || "").trim();
    const resolvedSource = String(sourceText || "").trim();

    if (!topicPrompt && !resolvedSource) {
      return res.status(400).json({ error: "Provide a prompt or source text." });
    }

    const allowedFormats = parseFormats(formats || (format ? [format] : null));
    const formatForStep =
      format && allowedFormats.includes(format)
        ? format
        : allowedFormats[Number(stepIndex) % allowedFormats.length];

    const result = await requestSingleAiQuestion({
      topicPrompt,
      sourceText: resolvedSource,
      additionalInstructions,
      format: formatForStep,
      difficulty: String(difficulty || "medium"),
      stepIndex: Number(stepIndex) || 0,
      totalSteps: clampQuestionCount(totalSteps || 1),
    });

    res.json({
      success: true,
      question: result.question,
      suggestedTitle: result.suggestedTitle,
      suggestedDescription: result.suggestedDescription,
      meta: {
        provider: result.provider,
        model: result.model,
        stepIndex: Number(stepIndex) || 0,
      },
    });
  } catch (err) {
    handleRouteError(res, err);
  }
});

router.post("/generate-from-prompt", requireFaculty, async (req, res) => {
  try {
    const {
      prompt,
      topic,
      formats,
      questionCount,
      difficulty,
      additionalInstructions,
    } = req.body || {};

    const topicPrompt = String(prompt || topic || "").trim();
    if (!topicPrompt) {
      return res.status(400).json({ error: "Describe what you want the AI to generate." });
    }

    const result = await requestAiQuestions({
      topicPrompt,
      additionalInstructions,
      formats: parseFormats(formats),
      questionCount: clampQuestionCount(questionCount),
      difficulty: String(difficulty || "medium"),
      mode: "prompt",
    });

    res.json({ success: true, ...result });
  } catch (err) {
    handleRouteError(res, err);
  }
});

router.post(
  "/generate-from-document",
  requireFaculty,
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err?.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "File is too large. Maximum size is 10 MB." });
      }
      if (err) {
        return res.status(400).json({ error: err.message || "File upload failed." });
      }
      next();
    });
  },
  async (req, res) => {
    const file = req.file;

    try {
      if (!file) {
        return res.status(400).json({ error: "Upload a PDF or Word (.docx) file." });
      }

      if (!isSupportedUpload(file)) {
        return res.status(400).json({
          error: "Unsupported file type. Use PDF or Word (.docx) only.",
        });
      }

      const sourceText = await extractDocumentText(file);
      const {
        formats,
        questionCount,
        difficulty,
        additionalInstructions,
      } = req.body || {};

      const result = await requestAiQuestions({
        sourceText,
        additionalInstructions,
        formats: parseFormats(formats),
        questionCount: clampQuestionCount(questionCount),
        difficulty: String(difficulty || "medium"),
        mode: "document",
      });

      res.json({
        success: true,
        extractedChars: sourceText.length,
        ...result,
      });
    } catch (err) {
      handleRouteError(res, err);
    } finally {
      cleanupUploadedFile(file);
    }
  }
);

module.exports = router;
