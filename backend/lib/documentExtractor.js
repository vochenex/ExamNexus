const fs = require("fs");
const path = require("path");
const mammoth = require("mammoth");
const JSZip = require("jszip");

const MAX_EXTRACT_CHARS = 50000;
const MIN_EXTRACT_CHARS = 40;

const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
]);

const SUPPORTED_EXTENSIONS = new Set([".pdf", ".docx", ".pptx"]);

function getFileExtension(file) {
  return path.extname(file?.originalname || "").toLowerCase();
}

function isSupportedUpload(file) {
  if (!file) return false;
  const ext = getFileExtension(file);
  return SUPPORTED_MIME_TYPES.has(file.mimetype) || SUPPORTED_EXTENSIONS.has(ext);
}

async function extractPdfText(buffer) {
  // Lazy-load so Vercel cold start does not require optional @napi-rs/canvas.
  const { PDFParse } = require("pdf-parse");
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

function stripXmlTags(xml) {
  return String(xml || "")
    .replace(/<a:t[^>]*>/gi, "")
    .replace(/<\/a:t>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function extractPptxText(file) {
  const buffer = file?.buffer || (file?.path ? fs.readFileSync(file.path) : null);
  if (!buffer) {
    throw new Error("Could not read the uploaded PowerPoint file.");
  }

  const zip = await JSZip.loadAsync(buffer);
  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const numA = Number.parseInt(a.match(/slide(\d+)/i)?.[1] || "0", 10);
      const numB = Number.parseInt(b.match(/slide(\d+)/i)?.[1] || "0", 10);
      return numA - numB;
    });

  const parts = [];
  for (const name of slideNames) {
    const xml = await zip.files[name].async("string");
    const text = stripXmlTags(xml);
    if (text) {
      parts.push(text);
    }
  }

  return parts.join("\n\n").trim();
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
    throw new Error(
      "Unsupported file type. Upload a PDF, Word (.docx), or PowerPoint (.pptx) document."
    );
  }

  const ext = getFileExtension(file);
  let rawText = "";

  if (file.mimetype === "application/pdf" || ext === ".pdf") {
    const buffer = file.buffer || fs.readFileSync(file.path);
    rawText = await extractPdfText(buffer);
  } else if (
    ext === ".pptx" ||
    file.mimetype ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    rawText = await extractPptxText(file);
  } else {
    rawText = await extractDocxText(file);
  }

  const text = normalizeExtractedText(rawText);

  if (text.length < MIN_EXTRACT_CHARS) {
    throw new Error(
      "Could not extract enough readable text from this file. Try a text-based PDF, .docx, or .pptx file."
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
