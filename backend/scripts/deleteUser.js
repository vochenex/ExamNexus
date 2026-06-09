require("dotenv").config();
const { getSupabaseAdmin } = require("../lib/supabaseAdmin");

const userId = process.argv[2];

async function deleteFromTable(admin, table, column) {
  const { error, count } = await admin.from(table).delete({ count: "exact" }).eq(column, userId);
  if (error && error.code !== "42P01") {
    throw new Error(`${table}: ${error.message}`);
  }
  if (!error && count) {
    console.log(`  ${table}: removed ${count} row(s)`);
  }
}

async function main() {
  if (!userId) {
    console.error("Usage: node scripts/deleteUser.js <user-uuid>");
    process.exit(1);
  }

  const admin = getSupabaseAdmin();

  if (!admin) {
    console.error("Set SUPABASE_SERVICE_ROLE_KEY in backend/.env, then run again.");
    console.error("Or run the matching SQL file in Supabase SQL Editor.");
    process.exit(1);
  }

  const { data: profile, error: profileError } = await admin
    .from("users")
    .select("id, email, first_name, last_name, role")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) throw profileError;

  if (!profile) {
    const { data: authUser, error: authError } = await admin.auth.admin.getUserById(userId);
    if (authError) throw authError;
    if (!authUser?.user) {
      console.log("User not found in public.users or auth.users.");
      return;
    }
    console.log("Found auth-only user:", authUser.user.email);
  } else {
    console.log(
      "Deleting:",
      [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.email,
      `(${profile.role})`
    );
  }

  console.log("Removing related rows...");
  await deleteFromTable(admin, "subject_students", "student_id");
  await deleteFromTable(admin, "exam_results", "student_id");
  await deleteFromTable(admin, "student_answers", "student_id");
  await deleteFromTable(admin, "exam_integrity_events", "student_id");
  await deleteFromTable(admin, "notifications", "user_id");
  await deleteFromTable(admin, "announcement_reactions", "user_id");
  await deleteFromTable(admin, "announcement_comments", "user_id");

  const { error: usersError } = await admin.from("users").delete().eq("id", userId);
  if (usersError) throw usersError;
  console.log("  public.users: removed");

  const { error: authDeleteError } = await admin.auth.admin.deleteUser(userId);
  if (authDeleteError) throw authDeleteError;
  console.log("  auth.users: removed");

  console.log("Done.");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
