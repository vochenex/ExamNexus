require("dotenv").config();
const { getSupabaseAdmin } = require("../lib/supabaseAdmin");

async function main() {
  const admin = getSupabaseAdmin();

  if (!admin) {
    console.error(
      "Set SUPABASE_SERVICE_ROLE_KEY in backend/.env, then run this script again."
    );
    console.error(
      "Or run database/cleanup_duplicate_enrollments.sql in Supabase SQL Editor."
    );
    process.exit(1);
  }

  const { data: rows, error } = await admin
    .from("subject_students")
    .select("*");

  if (error) throw error;

  const seen = new Map();
  const toDelete = [];

  for (const row of rows || []) {
    const key = `${row.student_id}:${row.subject_id}`;
    if (seen.has(key)) {
      toDelete.push(row);
    } else {
      seen.set(key, row);
    }
  }

  if (toDelete.length === 0) {
    console.log("No duplicate enrollments found.");
    return;
  }

  for (const row of toDelete) {
    let query = admin
      .from("subject_students")
      .delete()
      .eq("student_id", row.student_id)
      .eq("subject_id", row.subject_id);

    if (row.id) {
      query = query.eq("id", row.id);
    }

    const { error: deleteError } = await query;
    if (deleteError) throw deleteError;

    console.log(
      "Deleted duplicate enrollment:",
      row.student_id,
      row.subject_id,
      row.id || "(no id column)"
    );
  }

  console.log(`Removed ${toDelete.length} duplicate enrollment(s).`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
