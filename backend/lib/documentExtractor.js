const fs = require("fs");
const path = require("path");
const mammoth = require("mammoth");
const { PDFParse } = require("pdf-parse");

const MAX_EXTRACT_CHARS = 50000;
const MIN_EXTRACT_CHARS = 40;

const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const SUPPORTED_EXTENSIONS = new Set([".pdf", ".docx"]);

function getFileExtension(file) {
  return path.extname(file?.originalname || "").toLowerCase();
}

function isSupportedUpload(file) {
  if (!file) return false;
  const ext = getFileExtension(file);
  return SUPPORTED_MIME_TYPES.has(file.mimetype) || SUPPORTED_EXTENSIONS.has(ext);
}

async function extractPdfText(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return String(result?.text || "").trim();
  } finally {
    if (typeof parser.destroy === "function") {
      await parser.destroy();
    }
  }
}

async function extractDocxText(file) {
  if (file?.buffer) {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return String(result?.value || "").trim();
  }
  if (!file?.path) {
    throw new Error("Could not read the uploaded Word document.");
  }
  const result = await mammoth.extractRawText({ path: file.path });
  return String(result?.value || "").trim();
}

function normalizeExtractedText(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_EXTRACT_CHARS);
}

async function extractDocumentText(file) {
  if (!file) {
    throw new Error("No file uploaded.");
  }

  if (!isSupportedUpload(file)) {
    throw new Error("Unsupported file type. Upload a PDF or Word (.docx) document.");
  }

  const ext = getFileExtension(file);
  let rawText = "";

  if (file.mimetype === "application/pdf" || ext === ".pdf") {
    const buffer = file.buffer || fs.readFileSync(file.path);
    rawText = await extractPdfText(buffer);
  } else {
    rawText = await extractDocxText(file);
  }

  const text = normalizeExtractedText(rawText);

  if (text.length < MIN_EXTRACT_CHARS) {
    throw new Error(
      "Could not extract enough readable text from this file. Try a text-based PDF or .docx file."
    );
  }

  return text;
}

function cleanupUploadedFile(file) {
  if (!file?.path) return;
  try {
    fs.unlinkSync(file.path);
  } catch {
    // ignore cleanup errors
  }
}

module.exports = {
  MAX_EXTRACT_CHARS,
  MIN_EXTRACT_CHARS,
  isSupportedUpload,
  extractDocumentText,
  cleanupUploadedFile,
};
