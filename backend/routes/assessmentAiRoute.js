const express = require("express");
const multer = require("multer");
const { requireFaculty } = require("../middleware/requireFaculty");
const {
  extractDocumentText,
  extractMultipleDocumentsText,
  cleanupUploadedFile,
  cleanupUploadedFiles,
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
  classifyDocumentContent,
} = require("../lib/assessmentAiGenerator");

const router = express.Router();

// Memory storage works on Vercel (no persistent disk). Local runs also fine.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const uploadDocuments = upload.fields([
  { name: "files", maxCount: 12 },
  { name: "file", maxCount: 1 },
]);

function getUploadedFiles(req) {
  const fromFiles = Array.isArray(req.files?.files) ? req.files.files : [];
  const fromFile = Array.isArray(req.files?.file) ? req.files.file : [];
  const single = req.file ? [req.file] : [];
  return [...fromFiles, ...fromFile, ...single].filter(Boolean);
}

function parseFormatsField(formats) {
  if (!formats) return undefined;
  if (Array.isArray(formats)) return formats;
  if (typeof formats === "string") {
    try {
      return JSON.parse(formats);
    } catch {
      return String(formats)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  return undefined;
}

function handleMulterUpload(req, res, next) {
  uploadDocuments(req, res, (err) => {
    if (err?.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File is too large. Maximum size is 10 MB." });
    }
    if (err) {
      return res.status(400).json({ error: err.message || "File upload failed." });
    }
    next();
  });
}

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
      groq: status.groq,
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
    groq: status.groq,
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
    groq: status.groq,
    error: status.error || null,
  });
});

router.post(
  "/extract-document",
  requireFaculty,
  handleMulterUpload,
  async (req, res) => {
    const files = getUploadedFiles(req);

    try {
      if (!files.length) {
        return res.status(400).json({
          error: "Upload a PDF, Word (.docx), or PowerPoint (.pptx) file.",
        });
      }

      for (const file of files) {
        if (!isSupportedUpload(file)) {
          return res.status(400).json({
            error: "Unsupported file type. Use PDF, Word (.docx), or PowerPoint (.pptx).",
          });
        }
      }

      const text = await extractMultipleDocumentsText(files);
      res.json({ text, extractedChars: text.length, fileCount: files.length });
    } catch (err) {
      handleRouteError(res, err);
    } finally {
      cleanupUploadedFiles(files);
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
      lockQuestionCount: Boolean(req.body?.lockQuestionCount),
    });

    if (!resolved.questionCount) {
      return res.status(400).json({
        error:
          "Enter how many questions to generate (1–150), or include a count in your prompt.",
      });
    }

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
  "/classify-document",
  requireFaculty,
  handleMulterUpload,
  async (req, res) => {
    const files = getUploadedFiles(req);

    try {
      if (!files.length) {
        return res.status(400).json({
          error: "Upload a PDF, Word (.docx), or PowerPoint (.pptx) file.",
        });
      }

      for (const file of files) {
        if (!isSupportedUpload(file)) {
          return res.status(400).json({
            error: "Unsupported file type. Use PDF, Word (.docx), or PowerPoint (.pptx).",
          });
        }
      }

      const sourceText = await extractMultipleDocumentsText(files);
      const classification = await classifyDocumentContent(sourceText);

      res.json({
        success: true,
        extractedChars: sourceText.length,
        fileCount: files.length,
        ...classification,
      });
    } catch (err) {
      handleRouteError(res, err);
    } finally {
      cleanupUploadedFiles(files);
    }
  }
);

router.post(
  "/analyze-document",
  requireFaculty,
  handleMulterUpload,
  async (req, res) => {
    const files = getUploadedFiles(req);

    try {
      if (!files.length) {
        return res.status(400).json({
          error: "Upload a PDF, Word (.docx), or PowerPoint (.pptx) file.",
        });
      }

      for (const file of files) {
        if (!isSupportedUpload(file)) {
          return res.status(400).json({
            error: "Unsupported file type. Use PDF, Word (.docx), or PowerPoint (.pptx).",
          });
        }
      }

      const sourceText = await extractMultipleDocumentsText(files);
      const {
        questionCount,
        difficulty,
        formats,
        isQuestionnaire,
      } = req.body || {};

      const questionnaire =
        isQuestionnaire === true ||
        isQuestionnaire === "true" ||
        isQuestionnaire === "1" ||
        isQuestionnaire == null;

      const result = await requestDocumentQuestions({
        sourceText,
        questionCount,
        difficulty,
        formats: parseFormatsField(formats),
        isQuestionnaire: questionnaire,
      });

      res.json({
        success: true,
        extractedChars: sourceText.length,
        fileCount: files.length,
        isQuestionnaire: questionnaire,
        ...result,
      });
    } catch (err) {
      handleRouteError(res, err);
    } finally {
      cleanupUploadedFiles(files);
    }
  }
);

router.post(
  "/generate-from-document",
  requireFaculty,
  handleMulterUpload,
  async (req, res) => {
    const files = getUploadedFiles(req);

    try {
      if (!files.length) {
        return res.status(400).json({
          error: "Upload a PDF, Word (.docx), or PowerPoint (.pptx) file.",
        });
      }

      for (const file of files) {
        if (!isSupportedUpload(file)) {
          return res.status(400).json({
            error: "Unsupported file type. Use PDF, Word (.docx), or PowerPoint (.pptx).",
          });
        }
      }

      const sourceText = await extractMultipleDocumentsText(files);
      const {
        questionCount,
        difficulty,
        formats,
        isQuestionnaire,
      } = req.body || {};

      const questionnaire =
        isQuestionnaire === true ||
        isQuestionnaire === "true" ||
        isQuestionnaire === "1" ||
        isQuestionnaire == null;

      const result = await requestDocumentQuestions({
        sourceText,
        questionCount,
        difficulty,
        formats: parseFormatsField(formats),
        isQuestionnaire: questionnaire,
      });

      res.json({
        success: true,
        extractedChars: sourceText.length,
        fileCount: files.length,
        isQuestionnaire: questionnaire,
        ...result,
      });
    } catch (err) {
      handleRouteError(res, err);
    } finally {
      cleanupUploadedFiles(files);
    }
  }
);

module.exports = router;
