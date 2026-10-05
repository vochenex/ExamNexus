const express = require("express");
const { requireAdmin } = require("../middleware/requireAdmin");
const { getSupabaseAdmin } = require("../lib/supabaseAdmin");
const { publicErrorMessage } = require("../lib/publicError");

const router = express.Router();

/** Keep each request well under the 60s serverless limit; the client sends batches. */
const MAX_STUDENTS_PER_REQUEST = 25;
const CONCURRENCY = 4;

const EMAIL_DOMAIN = "crmc.en.com";
const YEAR_LEVELS = new Set(["1st_year", "2nd_year", "3rd_year", "4th_year"]);
const DEFAULT_AVATAR_PATH = "/default-avatar.svg";
/** Admin catalog codes (uppercased): letters/digits, optionally with spaces, dots, &, / or -. */
const CATALOG_CODE = /^[A-Z0-9][A-Z0-9 .&/-]{0,23}$/;

/**
 * Active departments → Set of course codes, from the admin "Departments & courses" page.
 * Returns null when the catalog can't be read so imports still work on projects without it.
 */
async function loadCatalog(admin) {
  const { data, error } = await admin
    .from("school_catalog")
    .select("item_type, code, parent_code, is_active")
    .in("item_type", ["department", "course"]);
  if (error || !Array.isArray(data)) return null;

  const coursesByDepartment = new Map();
  for (const item of data) {
    if (item.is_active === false || item.item_type !== "department") continue;
    coursesByDepartment.set(String(item.code || "").trim().toUpperCase(), new Set());
  }
  if (!coursesByDepartment.size) return null;

  for (const item of data) {
    if (item.is_active === false || item.item_type !== "course") continue;
    const parent = String(item.parent_code || "").trim().toUpperCase();
    coursesByDepartment.get(parent)?.add(String(item.code || "").trim().toUpperCase());
  }
  return coursesByDepartment;
}

function catalogError(catalog, student) {
  if (!catalog) return "";
  const courses = catalog.get(student.department);
  if (!courses) return `Department "${student.department}" does not exist.`;
  if (!courses.has(student.course)) {
    return `Course "${student.course}" does not exist under ${student.department}.`;
  }
  return "";
}

/** Mirrors buildCrmcEmail in frontend/utils/schoolEmail.js. */
function sanitizeNamePart(value) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function buildSchoolEmail(lastName, firstName) {
  const last = sanitizeNamePart(lastName);
  const first = sanitizeNamePart(firstName);
  if (!last || !first) return "";
  return `${last}.${first}@${EMAIL_DOMAIN}`;
}

function normalizeStudent(raw) {
  const firstName = String(raw?.firstName || "").trim();
  const lastName = String(raw?.lastName || "").trim();
  const schoolId = String(raw?.schoolId || "").trim();
  const department = String(raw?.department || "").trim().toUpperCase();
  const course = String(raw?.course || "").trim().toUpperCase();
  const yearLevel = String(raw?.yearLevel || "").trim();
  const email = buildSchoolEmail(lastName, firstName);

  let error = "";
  if (!firstName || !lastName || !email) error = "First and last name are required.";
  else if (!/^\d{9,13}$/.test(schoolId)) error = "School ID must be 9 to 13 numbers.";
  else if (!CATALOG_CODE.test(department)) error = "Department is missing or invalid.";
  else if (!CATALOG_CODE.test(course)) error = "Course is missing or invalid.";
  else if (!YEAR_LEVELS.has(yearLevel)) error = "Year level is missing or invalid.";

  return {
    row: raw?.row ?? null,
    firstName,
    lastName,
    schoolId,
    department,
    course,
    yearLevel,
    email,
    error,
  };
}

async function findExisting(admin, students) {
  const schoolIds = [...new Set(students.map((s) => s.schoolId))];
  const emails = [...new Set(students.map((s) => s.email))];
  const takenIds = new Set();
  const takenEmails = new Set();

  if (schoolIds.length) {
    const { data, error } = await admin.from("users").select("school_id").in("school_id", schoolIds);
    if (error) throw error;
    for (const row of data || []) takenIds.add(String(row.school_id));
  }
  if (emails.length) {
    const { data, error } = await admin.from("users").select("email").in("email", emails);
    if (error) throw error;
    for (const row of data || []) takenEmails.add(String(row.email).toLowerCase());
  }
  return { takenIds, takenEmails };
}

function createUserErrorMessage(error) {
  const message = String(error?.message || "");
  if (/already (been )?registered|already exists/i.test(message)) {
    return "This email is already registered.";
  }
  if (/database error/i.test(message)) {
    return "This School ID or email is already registered.";
  }
  return publicErrorMessage(error, "Could not create this account.");
}

async function createStudent(admin, student, temporaryPassword) {
  const metadata = {
    first_name: student.firstName,
    last_name: student.lastName,
    school_id: student.schoolId,
    role: "Student",
    department: student.department,
    course: student.course,
    year_level: student.yearLevel,
    avatar_url: DEFAULT_AVATAR_PATH,
  };

  // temp_password lives only in auth metadata; the app reminds the student to change it.
  const { data, error } = await admin.auth.admin.createUser({
    email: student.email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { ...metadata, temp_password: true },
  });
  if (error || !data?.user?.id) {
    return { status: "failed", message: createUserErrorMessage(error) };
  }

  const userId = data.user.id;
  // The auth trigger normally creates the profile as "pending"; admin imports are approved.
  const { error: profileError } = await admin.from("users").upsert(
    {
      id: userId,
      email: student.email,
      ...metadata,
      account_status: "approved",
    },
    { onConflict: "id" }
  );

  if (profileError) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    return { status: "failed", message: publicErrorMessage(profileError, "Could not save this student's profile.") };
  }

  return { status: "created", message: "" };
}

async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
}

const MAX_STUDENTS_PER_CHECK = 1000;

async function fetchAllUsers(admin) {
  const pageSize = 1000;
  const all = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from("users")
      .select("id, first_name, last_name, school_id, email, role, account_status")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return all;
}

function levenshtein(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = temp;
    }
  }
  return prev[b.length];
}

function nameTokens(value) {
  return String(value || "")
    .split(/\s+/)
    .map(sanitizeNamePart)
    .filter((token) => token.length >= 3);
}

/** "Dirk James" vs "Dirk", "Jon" vs "John", or a shared given name. */
function similarFirstNames(rawA, rawB) {
  const a = sanitizeNamePart(rawA);
  const b = sanitizeNamePart(rawB);
  if (!a || !b) return false;
  if ((a.startsWith(b) || b.startsWith(a)) && Math.min(a.length, b.length) >= 3) return true;
  if (Math.max(a.length, b.length) >= 4 && levenshtein(a, b) <= 2) return true;
  const tokensB = new Set(nameTokens(rawB));
  return nameTokens(rawA).some((token) => tokensB.has(token));
}

function describeAccount(user) {
  const name = [user.last_name, user.first_name].filter(Boolean).join(", ") || "Unnamed account";
  const details = [user.email, user.school_id ? `ID ${user.school_id}` : ""].filter(Boolean);
  const role = String(user.role || "").toLowerCase();
  if (role && role !== "student") details.push(user.role);
  const status = String(user.account_status || "").toLowerCase();
  if (status === "pending") details.push("pending approval");
  if (status === "deleted") details.push("deleted, on 7-day hold");
  return `${name} (${details.join(" · ")})`;
}

router.post("/students/check", requireAdmin, async (req, res) => {
  try {
    const input = Array.isArray(req.body?.students) ? req.body.students : null;
    if (!input || !input.length) return res.json({ results: [] });
    if (input.length > MAX_STUDENTS_PER_CHECK) {
      return res.status(400).json({ error: `Check at most ${MAX_STUDENTS_PER_CHECK} students at a time.` });
    }

    const users = await fetchAllUsers(getSupabaseAdmin());
    const bySchoolId = new Map();
    const byEmail = new Map();
    const byLastName = new Map();
    for (const user of users) {
      if (user.school_id) bySchoolId.set(String(user.school_id).trim(), user);
      if (user.email) byEmail.set(String(user.email).trim().toLowerCase(), user);
      const last = sanitizeNamePart(user.last_name);
      if (last) {
        if (!byLastName.has(last)) byLastName.set(last, []);
        byLastName.get(last).push(user);
      }
    }

    const results = input.map((raw) => {
      const schoolId = String(raw?.schoolId || "").trim();
      const firstName = String(raw?.firstName || "").trim();
      const lastName = String(raw?.lastName || "").trim();
      const email = buildSchoolEmail(lastName, firstName);
      const blocking = [];
      const warnings = [];
      const flagged = new Set();

      const idOwner = schoolId ? bySchoolId.get(schoolId) : null;
      if (idOwner) {
        blocking.push(`ID number is already used by ${describeAccount(idOwner)}`);
        flagged.add(idOwner.id);
      }
      const emailOwner = email ? byEmail.get(email) : null;
      if (emailOwner && !flagged.has(emailOwner.id)) {
        blocking.push(`An account with this name already exists: ${describeAccount(emailOwner)}`);
        flagged.add(emailOwner.id);
      }

      const first = sanitizeNamePart(firstName);
      const last = sanitizeNamePart(lastName);
      if (first && last) {
        const sameLast = byLastName.get(last) || [];
        const swapped = (byLastName.get(first) || []).filter(
          (user) => sanitizeNamePart(user.first_name) === last
        );
        for (const user of [...sameLast, ...swapped]) {
          if (flagged.has(user.id) || warnings.length >= 3) continue;
          const userFirst = sanitizeNamePart(user.first_name);
          if (userFirst === first) {
            warnings.push({ type: "same_name", message: `An account with this name already exists: ${describeAccount(user)}` });
            flagged.add(user.id);
          } else if (swapped.includes(user) || similarFirstNames(firstName, user.first_name)) {
            warnings.push({ type: "similar", message: `Similar account: ${describeAccount(user)}` });
            flagged.add(user.id);
          }
        }
      }

      return { row: raw?.row ?? null, blocking, warnings };
    });

    res.json({ results });
  } catch (err) {
    console.error("student check error:", err);
    res.status(err.statusCode || 500).json({ error: publicErrorMessage(err, "Could not check existing accounts.") });
  }
});

router.post("/students/import", requireAdmin, async (req, res) => {
  try {
    const input = Array.isArray(req.body?.students) ? req.body.students : null;
    if (!input || !input.length) {
      return res.status(400).json({ error: "No students to import." });
    }
    if (input.length > MAX_STUDENTS_PER_REQUEST) {
      return res.status(400).json({ error: `Send at most ${MAX_STUDENTS_PER_REQUEST} students per request.` });
    }
    const temporaryPassword = String(req.body?.temporaryPassword || "");
    if (temporaryPassword.length < 8 || temporaryPassword.length > 72) {
      return res.status(400).json({ error: "Temporary password must be 8 to 72 characters." });
    }

    const admin = getSupabaseAdmin();
    const students = input.map(normalizeStudent);
    const catalog = await loadCatalog(admin);
    for (const student of students) {
      if (!student.error) student.error = catalogError(catalog, student);
    }
    const valid = students.filter((s) => !s.error);
    const { takenIds, takenEmails } = await findExisting(admin, valid);

    const seenIds = new Set();
    const seenEmails = new Set();
    for (const student of valid) {
      if (takenIds.has(student.schoolId) || seenIds.has(student.schoolId)) {
        student.error = "This School ID is already registered.";
      } else if (takenEmails.has(student.email) || seenEmails.has(student.email)) {
        student.error = `The email ${student.email} is already registered.`;
      }
      seenIds.add(student.schoolId);
      seenEmails.add(student.email);
    }

    const results = await runWithConcurrency(students, CONCURRENCY, async (student) => {
      const base = { row: student.row, email: student.email, schoolId: student.schoolId };
      if (student.error) return { ...base, status: "skipped", message: student.error };
      try {
        return { ...base, ...(await createStudent(admin, student, temporaryPassword)) };
      } catch (err) {
        console.error("student import error:", err);
        return { ...base, status: "failed", message: publicErrorMessage(err, "Could not create this account.") };
      }
    });

    res.json({ results });
  } catch (err) {
    console.error("student import error:", err);
    res.status(err.statusCode || 500).json({ error: publicErrorMessage(err, "Could not import students. Please try again.") });
  }
});

module.exports = router;
