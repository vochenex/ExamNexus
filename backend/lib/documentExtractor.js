const fs = require("fs");
const path = require("path");
const mammoth = require("mammoth");
const JSZip = require("jszip");
const { repairMissingSpaces, looksMissingSpaces } = require("./textSpacing");

const MAX_EXTRACT_CHARS = 50000;
const MAX_EXTRACT_CHARS_VERCEL = 18000;
const MIN_EXTRACT_CHARS = 40;

function getMaxExtractChars() {
  return process.env.VERCEL || process.env.VERCEL_ENV
    ? MAX_EXTRACT_CHARS_VERCEL
    : MAX_EXTRACT_CHARS;
}

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

function isVercelRuntime() {
  return Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
}

function withTimeout(promise, ms, message) {
  let timer;
  return Promise.race([
    Promise.resolve(promise).finally(() => {
      if (timer) clearTimeout(timer);
    }),
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error(message);
        error.statusCode = 408;
        reject(error);
      }, ms);
    }),
  ]);
}

async function extractPdfText(buffer) {
  const hosted = isVercelRuntime();
  return withTimeout(
    (async () => {
      // Lazy-load so Vercel cold start does not require optional @napi-rs/canvas.
      const { PDFParse } = require("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      try {
        // Hosted: first pages only — full PDF parse can hang the function.
        const result = hosted
          ? await parser.getText({ first: 1, last: 8 })
          : await parser.getText();
        return String(result?.text || "").trim();
      } finally {
        if (typeof parser.destroy === "function") {
          try {
            await parser.destroy();
          } catch {
            // ignore cleanup errors
          }
        }
      }
    })(),
    hosted ? 15000 : 120000,
    "Reading this PDF took too long. Try a shorter text-based PDF, or export it as .docx."
  );
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

function decodeXmlEntities(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code);
      return Number.isFinite(n) ? String.fromCharCode(n) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const n = Number.parseInt(hex, 16);
      return Number.isFinite(n) ? String.fromCharCode(n) : "";
    })
    .replace(/\s+/g, " ")
    .trim();
}

function stripXmlTags(xml) {
  return decodeXmlEntities(
    String(xml || "")
      .replace(/<(?:[A-Za-z0-9._-]+:)?t(?:\s[^>]*)?>/gi, "")
      .replace(/<\/(?:[A-Za-z0-9._-]+:)?t>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  );
}

function extractTextNodesFromXml(xml) {
  const source = String(xml || "");
  const parts = [];
  // Prefer explicit DrawingML / shared text nodes (handles xml:space and prefixes).
  const nodeRe =
    /<(?:[A-Za-z0-9._-]+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:[A-Za-z0-9._-]+:)?t>/gi;
  let match;
  while ((match = nodeRe.exec(source)) !== null) {
    const text = decodeXmlEntities(match[1] || "");
    if (text) parts.push(text);
  }
  if (parts.length) {
    return parts.join(" ").replace(/\s+/g, " ").trim();
  }
  // Fallback for unusual packs: strip all tags from the part.
  return stripXmlTags(source);
}

async function extractPptxText(file) {
  const buffer = file?.buffer || (file?.path ? fs.readFileSync(file.path) : null);
  if (!buffer) {
    throw new Error("Could not read the uploaded PowerPoint file.");
  }

  const zip = await JSZip.loadAsync(buffer);
  const xmlNames = Object.keys(zip.files)
    .filter((name) => {
      const lower = name.toLowerCase();
      return (
        /^ppt\/slides\/slide\d+\.xml$/i.test(name) ||
        /^ppt\/notesSlides\/notesSlide\d+\.xml$/i.test(name) ||
        /^ppt\/charts\/chart\d+\.xml$/i.test(name) ||
        /^ppt\/diagrams\/data\d+\.xml$/i.test(name) ||
        // Some exporters nest slide XML under alternate folders.
        (lower.endsWith(".xml") &&
          lower.includes("ppt/") &&
          (lower.includes("/slides/") || lower.includes("/notesslides/")))
      );
    })
    .sort((a, b) => {
      const numA = Number.parseInt(a.match(/(\d+)/)?.[1] || "0", 10);
      const numB = Number.parseInt(b.match(/(\d+)/)?.[1] || "0", 10);
      if (numA !== numB) return numA - numB;
      return a.localeCompare(b);
    });

  const parts = [];
  for (const name of xmlNames) {
    const entry = zip.files[name];
    if (!entry || entry.dir) continue;
    const xml = await entry.async("string");
    const text = extractTextNodesFromXml(xml);
    if (text) parts.push(text);
  }

  const joined = parts.join("\n\n").trim();

  // #region agent log
  try {
    const fsLog = require("fs");
    const logPath = require("path").join(
      __dirname,
      "..",
      "..",
      "debug-c88187.log"
    );
    fsLog.appendFileSync(
      logPath,
      `${JSON.stringify({
        sessionId: "c88187",
        runId: "pptx-debug",
        hypothesisId: "H4",
        location: "documentExtractor.js:extractPptxText",
        message: "pptx extract result",
        data: {
          name: file?.originalname || "",
          mime: file?.mimetype || "",
          bytes: buffer.length,
          xmlParts: xmlNames.length,
          sampleParts: xmlNames.slice(0, 8),
          textLen: joined.length,
          preview: joined.slice(0, 120),
        },
        timestamp: Date.now(),
      })}\n`
    );
  } catch {
    // ignore debug log failures
  }
  // #endregion

  return joined;
}

function normalizeExtractedText(text) {
  let normalized = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // OCR / PDF extraction sometimes drops spaces between words.
  if (looksMissingSpaces(normalized.replace(/\n/g, " "))) {
    normalized = normalized
      .split("\n")
      .map((line) => (looksMissingSpaces(line) ? repairMissingSpaces(line) : line))
      .join("\n");
  }

  return normalized.slice(0, getMaxExtractChars());
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
  if (ext === ".ppt") {
    throw new Error(
      "Older .ppt files are not supported. Open the file in PowerPoint and Save As .pptx, then upload again."
    );
  }

  const hosted = isVercelRuntime();
  const run = async () => {
    let rawText = "";

    if (file.mimetype === "application/pdf" || ext === ".pdf") {
      const buffer = file.buffer || fs.readFileSync(file.path);
      rawText = await extractPdfText(buffer);
    } else if (
      ext === ".pptx" ||
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
      (file.mimetype === "application/vnd.ms-powerpoint" && ext === ".pptx")
    ) {
      rawText = await extractPptxText(file);
    } else if (
      file.mimetype === "application/vnd.ms-powerpoint" ||
      ext === ".ppt"
    ) {
      throw new Error(
        "Older .ppt files are not supported. Open the file in PowerPoint and Save As .pptx, then upload again."
      );
    } else {
      rawText = await extractDocxText(file);
    }

    const text = normalizeExtractedText(rawText);

    if (text.length < MIN_EXTRACT_CHARS) {
      throw new Error(
        ext === ".pptx"
          ? "This PowerPoint has almost no extractable text (often image-only slides). Add real text on the slides, or export as .pdf/.docx with selectable text."
          : "Could not extract enough readable text from this file. Try a text-based PDF, .docx, or .pptx file."
      );
    }

    return text;
  };

  return withTimeout(
    run(),
    hosted ? 20000 : 180000,
    "Reading this document took too long. Try a shorter text-based file (.docx works best)."
  );
}

function cleanupUploadedFile(file) {
  if (!file?.path) return;
  try {
    fs.unlinkSync(file.path);
  } catch {
    // ignore cleanup errors
  }
}

async function extractMultipleDocumentsText(files) {
  const list = Array.isArray(files) ? files.filter(Boolean) : [];
  if (!list.length) {
    throw new Error("No file uploaded.");
  }

  const parts = [];
  for (const file of list) {
    const text = await extractDocumentText(file);
    const label = file.originalname || "document";
    parts.push(`--- FILE: ${label} ---\n${text}`);
  }

  return normalizeExtractedText(parts.join("\n\n"));
}

/** Extract each upload separately (for per-file classify / role filtering). */
async function extractDocumentsSeparately(files) {
  const list = Array.isArray(files) ? files.filter(Boolean) : [];
  if (!list.length) {
    throw new Error("No file uploaded.");
  }

  const docs = [];
  for (let index = 0; index < list.length; index += 1) {
    const file = list[index];
    const text = await extractDocumentText(file);
    docs.push({
      index,
      name: file.originalname || `document-${index + 1}`,
      text: normalizeExtractedText(text),
      file,
    });
  }
  return docs;
}

/**
 * Like extractDocumentsSeparately, but keeps going when one file fails
 * (scanned PDF, old .doc, empty pptx, etc.). Extracts in parallel for speed.
 */
async function extractDocumentsSeparatelyLenient(files) {
  const list = Array.isArray(files) ? files.filter(Boolean) : [];
  if (!list.length) {
    throw new Error("No file uploaded.");
  }

  const settled = await Promise.all(
    list.map(async (file, index) => {
      const name = file.originalname || `document-${index + 1}`;
      try {
        const text = await extractDocumentText(file);
        return {
          ok: true,
          doc: {
            index,
            name,
            text: normalizeExtractedText(text),
            file,
          },
        };
      } catch (error) {
        return {
          ok: false,
          failure: {
            index,
            name,
            error: error?.message || "Could not read this file.",
          },
        };
      }
    })
  );

  const docs = [];
  const failures = [];
  for (const item of settled) {
    if (item.ok) docs.push(item.doc);
    else failures.push(item.failure);
  }

  return { docs, failures };
}

function mergeDocumentTexts(docs) {
  const list = Array.isArray(docs) ? docs.filter((doc) => doc?.text) : [];
  if (!list.length) return "";
  return normalizeExtractedText(
    list
      .map((doc) => `--- FILE: ${doc.name || "document"} ---\n${doc.text}`)
      .join("\n\n")
  );
}

function cleanupUploadedFiles(files) {
  const list = Array.isArray(files) ? files : files ? [files] : [];
  for (const file of list) {
    cleanupUploadedFile(file);
  }
}

module.exports = {
  MAX_EXTRACT_CHARS,
  MIN_EXTRACT_CHARS,
  isSupportedUpload,
  extractDocumentText,
  extractMultipleDocumentsText,
  extractDocumentsSeparately,
  extractDocumentsSeparatelyLenient,
  mergeDocumentTexts,
  cleanupUploadedFile,
  cleanupUploadedFiles,
};
