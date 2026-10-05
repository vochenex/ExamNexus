import { API_BASE } from "./apiBase.js";
import { getAuthSession } from "./authUser";
import { getCoursesForDepartment, isKnownDepartment, loadAcademicCatalog } from "./academicOptions";
import { YEAR_LEVEL_LABELS } from "./yearLevels";
import { buildCrmcEmail } from "./schoolEmail";
import { getSchoolIdRule } from "./schoolIdRules";
import { downloadBlob } from "./exportCsv";
import { friendlyError } from "./friendlyError";

export const MAX_IMPORT_ROWS = 1000;
/** Every bulk-imported student starts with this password and is reminded to change it. */
export const TEMPORARY_PASSWORD = "crmc.examnexus";
const BATCH_SIZE = 10;
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const REQUIRED_COLUMN_LABELS = [
  "Name (Last, First)",
  "School ID",
  "Department",
  "Course",
  "Year Level",
];

/** Header aliases, compared after lowercasing and stripping non-alphanumerics. */
const HEADER_ALIASES = {
  name: ["name", "namelastfirst", "fullname", "studentname", "lastnamefirstname"],
  lastName: ["lastname", "surname", "familyname"],
  firstName: ["firstname", "givenname"],
  schoolId: ["schoolid", "idnumber", "idno", "studentid", "studentnumber", "studentno", "id"],
  department: ["department", "dept", "college"],
  course: ["course", "program", "programcourse"],
  yearLevel: ["yearlevel", "year", "yearlvl", "level"],
};

function normalizeHeader(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Numbers are read as raw strings (parseNumber) so long ID numbers keep every digit. */
function cellText(value) {
  if (value == null) return "";
  if (value instanceof Date) return "";
  return String(value).trim();
}

function normalizeSchoolId(raw) {
  const text = raw.replace(/\s+/g, "");
  if (/^\d+\.0+$/.test(text)) return text.replace(/\.0+$/, "");
  if (/^\d+(\.\d+)?e\+\d+$/i.test(text)) {
    const n = Number(text);
    return Number.isSafeInteger(n) ? String(n) : text;
  }
  return text;
}

function mapHeaders(headerRow) {
  const indexes = {};
  headerRow.forEach((cell, index) => {
    const key = normalizeHeader(cell);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (indexes[field] == null && aliases.includes(key)) {
        indexes[field] = index;
        break;
      }
    }
  });
  return indexes;
}

function missingColumns(indexes) {
  const missing = [];
  const hasName = indexes.name != null || (indexes.lastName != null && indexes.firstName != null);
  if (!hasName) missing.push("Name (Last, First)");
  if (indexes.schoolId == null) missing.push("School ID");
  if (indexes.department == null) missing.push("Department");
  if (indexes.course == null) missing.push("Course");
  if (indexes.yearLevel == null) missing.push("Year Level");
  return missing;
}

const YEAR_WORDS = { first: 1, second: 2, third: 3, fourth: 4 };
const YEAR_SUFFIX = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th" };

/** Accepts "4th year", "4th", "4", "Fourth Year", "4th_year". */
export function parseYearLevel(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return null;
  const word = text.match(/^(first|second|third|fourth)\b/);
  const digit = text.match(/^([1-4])(st|nd|rd|th)?(?:[\s_-]*(?:year|yr))?$/);
  const n = word ? YEAR_WORDS[word[1]] : digit ? Number(digit[1]) : null;
  return n ? `${YEAR_SUFFIX[n]}_year` : null;
}

function splitFullName(value) {
  const text = String(value || "").trim();
  if (!text) return { lastName: "", firstName: "", nameFormatError: false };
  const comma = text.indexOf(",");
  if (comma === -1) return { lastName: "", firstName: "", nameFormatError: true };
  return {
    lastName: text.slice(0, comma).trim(),
    firstName: text.slice(comma + 1).trim(),
    nameFormatError: false,
  };
}

function eligibilityReasons(row, rawName) {
  const reasons = [];

  if (!row.lastName && !row.firstName) {
    reasons.push(rawName ? 'Name must be written as "Last, First"' : "No name");
  } else if (!row.lastName) {
    reasons.push("No last name");
  } else if (!row.firstName) {
    reasons.push("No first name");
  } else if (!row.email) {
    reasons.push("Name has no letters to build an email");
  }

  const rule = getSchoolIdRule("Student");
  if (!row.schoolId) {
    reasons.push("No ID number");
  } else if (!/^\d+$/.test(row.schoolId)) {
    reasons.push("ID number must contain numbers only");
  } else if (row.schoolId.length < rule.min || row.schoolId.length > rule.max) {
    reasons.push(
      `ID number has ${row.schoolId.length} digit${row.schoolId.length === 1 ? "" : "s"} (needs ${rule.min}–${rule.max})`
    );
  }

  if (!row.department) {
    reasons.push("No department");
  } else if (!isKnownDepartment(row.department)) {
    reasons.push(`Department "${row.department}" does not exist (add it on Departments & courses)`);
  }

  if (!row.course) {
    reasons.push("No course");
  } else if (
    isKnownDepartment(row.department) &&
    !getCoursesForDepartment(row.department).some((c) => c.value === row.course)
  ) {
    reasons.push(
      `Course "${row.course}" does not exist under ${row.department} (add it on Departments & courses)`
    );
  }

  if (!row.yearRaw) reasons.push("No year level");
  else if (!row.yearLevel) reasons.push(`Unknown year level "${row.yearRaw}"`);

  return reasons;
}

/**
 * Reads the first sheet of an .xlsx file.
 * Returns { missing, tooMany, eligible, ineligible }. A non-empty `missing` rejects the whole file.
 */
export async function readStudentWorkbook(file) {
  if (!file || !/\.xlsx$/i.test(file.name || "")) {
    throw new Error("Only Excel (.xlsx) files are accepted.");
  }

  const { readSheet } = await import("read-excel-file/browser");
  let table;
  try {
    table = await readSheet(file, { parseNumber: (value) => value });
  } catch (err) {
    console.warn("xlsx read failed:", err);
    throw new Error("This file could not be read. Make sure it is a valid Excel (.xlsx) file.");
  }

  await loadAcademicCatalog({ force: true });

  const rows = (table || []).filter((cells) => cells.some((cell) => cellText(cell)));
  if (!rows.length) return { missing: REQUIRED_COLUMN_LABELS, tooMany: false, eligible: [], ineligible: [] };

  const indexes = mapHeaders(rows[0]);
  const missing = missingColumns(indexes);
  if (missing.length) return { missing, tooMany: false, eligible: [], ineligible: [] };

  const body = rows.slice(1);
  const tooMany = body.length > MAX_IMPORT_ROWS;
  const cell = (cells, field) => cellText(cells[indexes[field]]);

  const seenIds = new Map();
  const seenEmails = new Map();
  const eligible = [];
  const ineligible = [];

  body.slice(0, MAX_IMPORT_ROWS).forEach((cells, i) => {
    const rawName = indexes.name != null ? cell(cells, "name") : "";
    const names =
      indexes.lastName != null && indexes.firstName != null
        ? { lastName: cell(cells, "lastName"), firstName: cell(cells, "firstName") }
        : splitFullName(rawName);
    const yearRaw = cell(cells, "yearLevel");
    const yearLevel = parseYearLevel(yearRaw);

    const row = {
      line: i + 2,
      lastName: names.lastName,
      firstName: names.firstName,
      schoolId: normalizeSchoolId(cell(cells, "schoolId")),
      department: cell(cells, "department").toUpperCase(),
      course: cell(cells, "course").toUpperCase(),
      yearRaw,
      yearLevel,
      yearLabel: yearLevel ? YEAR_LEVEL_LABELS[yearLevel] : yearRaw,
      email: buildCrmcEmail(names.lastName, names.firstName),
      rawName,
    };
    row.reasons = eligibilityReasons(row, rawName);

    if (row.schoolId) {
      if (seenIds.has(row.schoolId)) row.reasons.push(`Same ID number as row ${seenIds.get(row.schoolId)}`);
      else seenIds.set(row.schoolId, row.line);
    }
    if (row.email) {
      if (seenEmails.has(row.email)) row.reasons.push(`Same email as row ${seenEmails.get(row.email)}`);
      else seenEmails.set(row.email, row.line);
    }

    (row.reasons.length ? ineligible : eligible).push(row);
  });

  return { missing: [], tooMany, eligible, ineligible };
}

async function requireAccessToken() {
  const session = await getAuthSession();
  if (!session?.access_token) {
    throw new Error("Your session expired. Please log in again.");
  }
  return session.access_token;
}

async function postJson(path, accessToken, body, fallback) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || fallback);
  return Array.isArray(payload.results) ? payload.results : [];
}

/**
 * Compares rows against existing accounts.
 * Returns Map(line → { blocking: string[], warnings: { type: "same_name" | "similar", message }[] }).
 */
export async function checkExistingAccounts(rows) {
  const accessToken = await requireAccessToken();
  const students = rows
    .filter((row) => row.schoolId || (row.firstName && row.lastName))
    .map((row) => ({
      row: row.line,
      schoolId: row.schoolId,
      firstName: row.firstName,
      lastName: row.lastName,
    }));
  const results = students.length
    ? await postJson("/admin/students/check", accessToken, { students }, "Could not check existing accounts.")
    : [];
  return new Map(results.map((item) => [item.row, item]));
}

/**
 * Creates accounts in small batches. `onBatch(results, done, total)` fires after each batch
 * so the page can update progress and row statuses live.
 */
export async function createStudentAccounts(rows, onBatch) {
  const accessToken = await requireAccessToken();

  const all = [];
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const batch = rows.slice(start, start + BATCH_SIZE);
    const payload = batch.map((row) => ({
      row: row.line,
      firstName: row.firstName,
      lastName: row.lastName,
      schoolId: row.schoolId,
      department: row.department,
      course: row.course,
      yearLevel: row.yearLevel,
    }));

    let results;
    try {
      results = await postJson(
        "/admin/students/import",
        accessToken,
        { temporaryPassword: TEMPORARY_PASSWORD, students: payload },
        "Could not create accounts. Please try again."
      );
    } catch (err) {
      const message = friendlyError(err, "Could not create this account.");
      results = batch.map((row) => ({ row: row.line, email: row.email, status: "failed", message }));
    }
    all.push(...results);
    onBatch?.(results, Math.min(start + BATCH_SIZE, rows.length), rows.length);
  }
  return all;
}

const HEADER_STYLE = { fontWeight: "bold", backgroundColor: "#D1FAE5" };

async function saveWorkbook(filename, data, columns) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const blob = await writeXlsxFile(data, { columns }).toBlob();
  return downloadBlob(filename, new Blob([blob], { type: XLSX_MIME }));
}

export function downloadStudentTemplate() {
  const header = REQUIRED_COLUMN_LABELS.map((value) => ({ value, ...HEADER_STYLE }));
  // School ID is written as text so Excel never rounds or reformats long ID numbers.
  const sample = [
    { value: "Lepon, Dirk James", type: String },
    { value: "20250000130", type: String },
    { value: "CCS", type: String },
    { value: "BSIT", type: String },
    { value: "4th Year", type: String },
  ];
  return saveWorkbook("student-import-template.xlsx", [header, sample], [
    { width: 28 },
    { width: 18 },
    { width: 14 },
    { width: 12 },
    { width: 12 },
  ]);
}

export function downloadCreatedAccounts(rows) {
  const labels = ["Name", "School ID", "Email", "Temporary Password", "Department", "Course", "Year Level"];
  const header = labels.map((value) => ({ value, ...HEADER_STYLE }));
  const data = rows.map((row) =>
    [
      `${row.lastName}, ${row.firstName}`,
      row.schoolId,
      row.email,
      TEMPORARY_PASSWORD,
      row.department,
      row.course,
      row.yearLabel,
    ].map((value) => ({ value, type: String }))
  );
  const stamp = new Date().toISOString().slice(0, 10);
  return saveWorkbook(`created-student-accounts-${stamp}.xlsx`, [header, ...data], [
    { width: 28 },
    { width: 18 },
    { width: 34 },
    { width: 20 },
    { width: 12 },
    { width: 10 },
    { width: 12 },
  ]);
}
