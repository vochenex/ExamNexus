/**
 * Case-sensitive import check (catches Windows→Linux deploy failures).
 * Run: node scripts/check-import-casing.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "src");

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function listDirExact(dir) {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

function resolveWithCase(fromFile, spec) {
  if (!spec.startsWith(".")) return { ok: true, skipped: true };

  const absNoExt = path.resolve(path.dirname(fromFile), spec);
  const dir = path.dirname(absNoExt);
  const wanted = path.basename(absNoExt);
  const entries = listDirExact(dir);
  if (!entries.length && !fs.existsSync(dir)) {
    return { ok: false, reason: "missing-dir", wanted };
  }

  const exts = ["", ".js", ".jsx", ".ts", ".tsx", ".css", ".json"];
  const wantedNames = exts.map((ext) =>
    wanted.endsWith(ext) && ext ? wanted : wanted + ext
  );
  // Also if wanted already has extension
  if (!wantedNames.includes(wanted)) wantedNames.unshift(wanted);

  for (const name of wantedNames) {
    const exact = entries.find((e) => e === name);
    if (exact) {
      const full = path.join(dir, exact);
      if (fs.statSync(full).isFile()) return { ok: true, resolved: full };
      if (fs.statSync(full).isDirectory()) {
        for (const idx of ["index.js", "index.jsx"]) {
          if (listDirExact(full).includes(idx)) {
            return { ok: true, resolved: path.join(full, idx) };
          }
        }
      }
    }
  }

  // Case-insensitive hit?
  for (const name of wantedNames) {
    const ci = entries.find((e) => e.toLowerCase() === name.toLowerCase());
    if (ci) {
      return {
        ok: false,
        reason: "case-mismatch",
        wanted: name,
        actual: ci,
        dir: path.relative(path.join(__dirname, ".."), dir),
      };
    }
  }

  return { ok: false, reason: "missing", wanted };
}

const importRe =
  /(?:from\s+|import\s+|export\s+[\s\w]*from\s+)["']([^"']+)["']/g;

const files = walk(root).filter((f) => /\.(jsx?|tsx?|css)$/.test(f));
const issues = [];

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  let match;
  while ((match = importRe.exec(text))) {
    const spec = match[1];
    const result = resolveWithCase(file, spec);
    if (result.skipped || result.ok) continue;
    issues.push({
      file: path.relative(path.join(__dirname, ".."), file).replace(/\\/g, "/"),
      import: spec,
      ...result,
    });
  }
}

if (issues.length) {
  console.error("Import casing / missing path issues:\n");
  for (const issue of issues) {
    console.error(
      `- ${issue.file}\n  import "${issue.import}"\n  → ${issue.reason}` +
        (issue.actual ? ` (disk has "${issue.actual}")` : "")
    );
  }
  process.exit(1);
}

console.log("OK: no case-sensitive import mismatches in src/");
