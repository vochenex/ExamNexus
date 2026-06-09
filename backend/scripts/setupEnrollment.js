const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const sqlPath = path.join(__dirname, "..", "..", "database", "enroll_student.sql");
const sql = fs.readFileSync(sqlPath, "utf8");

async function main() {
  const dbPassword = process.env.SUPABASE_DB_PASSWORD;
  const url = process.env.SUPABASE_URL;

  if (!dbPassword || !url) {
    console.log(
      "Add SUPABASE_DB_PASSWORD to backend/.env, then run: node scripts/setupEnrollment.js"
    );
    console.log(
      "Or paste database/enroll_student.sql into Supabase Dashboard → SQL Editor → Run."
    );
    return;
  }

  const { Client } = require("pg");
  const projectRef = url.replace("https://", "").replace(".supabase.co", "");

  const client = new Client({
    host: `db.${projectRef}.supabase.co`,
    port: 5432,
    user: "postgres",
    password: dbPassword,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    await client.query(sql);
    console.log("Enrollment SQL applied successfully.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Setup failed:", err.message);
  console.log(
    "Paste database/enroll_student.sql into Supabase Dashboard → SQL Editor → Run."
  );
  process.exit(1);
});
