function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("en-PH", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(value);
  }
}

function percentOf(score, total) {
  const s = Number(score);
  const t = Number(total);
  if (!Number.isFinite(s) || !Number.isFinite(t) || t <= 0) return null;
  return Math.round((s / t) * 1000) / 10;
}

function isPassing(row, passMark = 50) {
  const pct =
    row.percentage != null
      ? Number(row.percentage)
      : percentOf(row.score, row.total);
  if (pct == null || Number.isNaN(pct)) return false;
  return pct >= passMark;
}

function buildPassFailChart(passed, failed) {
  const total = passed + failed;
  if (total <= 0) {
    return `<p class="muted">No submissions yet — chart unavailable.</p>`;
  }

  const passPct = Math.round((passed / total) * 100);
  const failPct = 100 - passPct;
  const passAngle = (passed / total) * 360;
  const gradient = `conic-gradient(#10b981 0deg ${passAngle}deg, #ef4444 ${passAngle}deg 360deg)`;

  return `
    <div class="chart-wrap">
      <div class="donut" style="background:${gradient}" aria-hidden="true">
        <div class="donut-hole">
          <strong>${total}</strong>
          <span>total</span>
        </div>
      </div>
      <ul class="legend">
        <li><span class="swatch pass"></span> Passed: <strong>${passed}</strong> (${passPct}%)</li>
        <li><span class="swatch fail"></span> Failed: <strong>${failed}</strong> (${failPct}%)</li>
      </ul>
    </div>
  `;
}

const QUESTION_TYPE_LABELS = {
  multiple_choice: "Multiple Choice",
  true_false: "True / False",
  identification: "Identification",
  enumeration: "Enumeration",
  essay: "Essay",
};

function normalizeQuestionType(question) {
  return String(question?.question_type || question?.type || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function formatQuestionTypeLabel(type) {
  const key = String(type || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (!key) return "—";
  return QUESTION_TYPE_LABELS[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Open-ended formats have no single definite answer in the export. */
function hasNoDefiniteAnswer(type) {
  return type === "enumeration" || type === "essay";
}

function questionAnswerText(question) {
  const type = normalizeQuestionType(question);
  if (hasNoDefiniteAnswer(type)) return " - ";

  if (Array.isArray(question.correct_answers) && question.correct_answers.length) {
    return question.correct_answers.join(", ");
  }
  if (question.correct_answer != null && question.correct_answer !== "") {
    try {
      const parsed = JSON.parse(question.correct_answer);
      if (Array.isArray(parsed)) return parsed.join(", ");
      if (parsed && typeof parsed === "object") return JSON.stringify(parsed);
      return String(parsed);
    } catch {
      return String(question.correct_answer);
    }
  }
  const options = Array.isArray(question.options)
    ? question.options
    : [question.option_a, question.option_b, question.option_c, question.option_d].filter(
        Boolean
      );
  if (options.length) {
    return options.join(" | ");
  }
  return " - ";
}

/** Prefer the actual question formats over the stored exam_type slug. */
function formatAssessmentType(report, questions) {
  const types = [
    ...new Set(
      questions
        .map((q) => normalizeQuestionType(q))
        .filter(Boolean)
    ),
  ];

  if (types.length > 1) {
    return `Mixed — ${types.map(formatQuestionTypeLabel).join(", ")}`;
  }
  if (types.length === 1) {
    return formatQuestionTypeLabel(types[0]);
  }

  const raw = report.type || report.exam_type || "";
  return formatQuestionTypeLabel(raw) || "—";
}

/**
 * Build a printable HTML assessment report.
 * @param {object} report
 */
export function buildAssessmentReportHtml(report) {
  const passMark = Number(report.pass_mark) || 50;
  const students = Array.isArray(report.students) ? report.students : [];
  const questions = Array.isArray(report.questions) ? report.questions : [];

  const passed = students.filter((row) => isPassing(row, passMark)).length;
  const failed = students.length - passed;

  const studentRows = students.length
    ? students
        .map((row, index) => {
          const pct =
            row.percentage != null
              ? Number(row.percentage)
              : percentOf(row.score, row.total);
          const pass = isPassing(row, passMark);
          return `
            <tr>
              <td>${index + 1}</td>
              <td>${escapeHtml(row.student_name || "—")}</td>
              <td>${escapeHtml(row.school_id || "—")}</td>
              <td>${escapeHtml(row.student_email || "—")}</td>
              <td>${escapeHtml(row.score ?? "—")} / ${escapeHtml(row.total ?? "—")}</td>
              <td>${pct == null || Number.isNaN(pct) ? "—" : `${pct}%`}</td>
              <td class="${pass ? "pass" : "fail"}">${pass ? "Passed" : "Failed"}</td>
              <td>${escapeHtml(formatDate(row.submitted_at))}</td>
            </tr>`;
        })
        .join("")
    : `<tr><td colspan="8" class="muted">No student submissions yet.</td></tr>`;

  const questionRows = questions.length
    ? questions
        .map((q, index) => {
          const typeKey = normalizeQuestionType(q);
          return `
            <tr>
              <td>${index + 1}</td>
              <td>${escapeHtml(formatQuestionTypeLabel(typeKey))}</td>
              <td>${escapeHtml(q.question_text || q.question || q.prompt || q.text || "—")}</td>
              <td>${escapeHtml(questionAnswerText(q))}</td>
              <td>${escapeHtml(q.points ?? q.score ?? "—")}</td>
            </tr>`;
        })
        .join("")
    : `<tr><td colspan="5" class="muted">No questions were available for this export.</td></tr>`;

  const title = report.title || "Assessment Report";
  const faculty =
    report.faculty_name ||
    report.faculty_school_id ||
    "Unassigned";
  const assessmentType = formatAssessmentType(report, questions);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} — ExamNexus Export</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: "Segoe UI", system-ui, sans-serif; margin: 0; padding: 24px; color: #0f172a; background: #f8fafc; }
    h1 { margin: 0 0 4px; font-size: 1.6rem; color: #0f766e; }
    h2 { margin: 28px 0 10px; font-size: 1.15rem; color: #134e4a; border-bottom: 2px solid #99f6e4; padding-bottom: 6px; }
    .meta { color: #475569; font-size: 0.92rem; line-height: 1.5; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px 18px; margin-top: 14px; }
    .desc { white-space: pre-wrap; line-height: 1.55; }
    table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; vertical-align: top; }
    th { background: #f0fdfa; color: #0f766e; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; }
    .pass { color: #047857; font-weight: 700; }
    .fail { color: #b91c1c; font-weight: 700; }
    .muted { color: #64748b; }
    .chart-wrap { display: flex; gap: 20px; align-items: center; flex-wrap: wrap; }
    .donut { width: 140px; height: 140px; border-radius: 50%; display: grid; place-items: center; }
    .donut-hole { width: 78px; height: 78px; border-radius: 50%; background: #fff; display: grid; place-items: center; text-align: center; line-height: 1.1; }
    .donut-hole strong { font-size: 1.25rem; }
    .donut-hole span { font-size: 0.7rem; color: #64748b; text-transform: uppercase; }
    .legend { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
    .swatch { display: inline-block; width: 12px; height: 12px; border-radius: 3px; margin-right: 6px; vertical-align: middle; }
    .swatch.pass { background: #10b981; }
    .swatch.fail { background: #ef4444; }
    .footer { margin-top: 28px; font-size: 0.78rem; color: #94a3b8; }
    @media print {
      body { background: #fff; padding: 0; }
      .card { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="meta">ExamNexus assessment export · Generated ${escapeHtml(formatDate(new Date().toISOString()))}</p>

  <div class="card">
    <h2 style="margin-top:0">Assessment details</h2>
    <p class="meta">
      <strong>Subject:</strong> ${escapeHtml(report.subject || "—")}<br/>
      <strong>Assigned faculty:</strong> ${escapeHtml(faculty)}<br/>
      <strong>Type:</strong> ${escapeHtml(assessmentType)}<br/>
      <strong>Category:</strong> ${escapeHtml(report.category || report.assessment_category || "—")}<br/>
      <strong>Schedule:</strong> ${escapeHtml(formatDate(report.start || report.start_datetime))}
        → ${escapeHtml(formatDate(report.end || report.end_datetime))}<br/>
      <strong>Passing mark:</strong> ${escapeHtml(passMark)}%
    </p>
    <h2>Description</h2>
    <p class="desc">${escapeHtml(report.description || "No description provided.")}</p>
  </div>

  <div class="card">
    <h2 style="margin-top:0">Pass / fail overview</h2>
    ${buildPassFailChart(passed, failed)}
  </div>

  <div class="card">
    <h2 style="margin-top:0">Students &amp; scores</h2>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Student</th>
          <th>School ID</th>
          <th>Email</th>
          <th>Score</th>
          <th>%</th>
          <th>Result</th>
          <th>Submitted</th>
        </tr>
      </thead>
      <tbody>${studentRows}</tbody>
    </table>
  </div>

  <div class="card">
    <h2 style="margin-top:0">Questions</h2>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Type</th>
          <th>Question</th>
          <th>Answer / options</th>
          <th>Points</th>
        </tr>
      </thead>
      <tbody>${questionRows}</tbody>
    </table>
  </div>

  <p class="footer">Open this file in a browser and use Print → Save as PDF if you need a PDF copy.</p>
</body>
</html>`;
}

export function slugifyFilename(value) {
  return String(value || "assessment")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "assessment";
}
