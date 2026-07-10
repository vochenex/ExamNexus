const express = require("express");
const multer = require("multer");
const { requireFaculty } = require("../middleware/requireFaculty");
const {
  extractDocumentText,
  cleanupUploadedFile,
  isSupportedUpload,
} = require("../lib/documentExtractor");
const {
  requestAiQuestionsBatched,
  requestDocumentQuestions,
  requestSingleAiQuestion,
  getDocumentPlan,
  parseFormats,
  clampQuestionCount,
  resolvePromptGenerationSettings,
  getAiServiceStatus,
} = require("../lib/assessmentAiGenerator");

const router = express.Router();

// Memory storage works on Vercel (no persistent disk). Local runs also fine.
const upload = multer({
  storage: multer.memoryStorage(),
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
      promptProvider: status.promptProvider,
      documentProvider: status.documentProvider,
      promptModel: status.promptModel,
      documentModel: status.documentModel,
      gemini: status.gemini,
      error: status.error,
    });
  }

  res.json({
    ok: true,
    configured: true,
    promptProvider: status.promptProvider,
    documentProvider: status.documentProvider,
    promptModel: status.promptModel,
    documentModel: status.documentModel,
    gemini: status.gemini,
  });
});

router.get("/public-config", async (req, res) => {
  const status = await getAiServiceStatus();
  res.json({
    configured: status.configured,
    provider: status.provider,
    model: status.model,
    promptProvider: status.promptProvider,
    documentProvider: status.documentProvider,
    promptModel: status.promptModel,
    documentModel: status.documentModel,
    gemini: status.gemini,
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
      mode: topicPrompt ? "prompt" : "document",
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

    const resolved = resolvePromptGenerationSettings({
      prompt: topicPrompt,
      questionCount,
      difficulty,
      formats,
    });

    const result = await requestAiQuestionsBatched({
      topicPrompt,
      additionalInstructions,
      formats: resolved.formats,
      questionCount: resolved.questionCount,
      difficulty: resolved.difficulty,
    });

    res.json({
      success: true,
      ...result,
      resolvedSettings: resolved,
    });
  } catch (err) {
    handleRouteError(res, err);
  }
});

router.post("/document-plan", requireFaculty, async (req, res) => {
  try {
    const { sourceText } = req.body || {};
    const plan = getDocumentPlan(sourceText);
    res.json({ success: true, ...plan });
  } catch (err) {
    handleRouteError(res, err);
  }
});

router.post(
  "/analyze-document",
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

      const result = await requestDocumentQuestions({ sourceText });

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

      const result = await requestDocumentQuestions({ sourceText });

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
