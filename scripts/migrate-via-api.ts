/**
 * Compare / migrate tasks from Supabase cloud to VPS Postgres via teacher login.
 * Uses public keys embedded in the Vercel build (no service role needed).
 */
import { createClient } from "@supabase/supabase-js";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { taskAnswers, tasks } from "../src/lib/db/schema";

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? "https://hhipwvzrumjjawrvwhhc.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "sb_publishable_EJrEXTE9RhTKMA0xnPQEgA_Z5yDeD2Y";
const TEACHER_EMAIL = process.env.TEACHER_EMAIL ?? "";
const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD ?? "";
const TARGET_DATABASE_URL = process.env.TARGET_DATABASE_URL ?? "";

async function main() {
  if (!TEACHER_EMAIL || !TEACHER_PASSWORD || !TARGET_DATABASE_URL) {
    console.error(
      "Set TEACHER_EMAIL, TEACHER_PASSWORD, TARGET_DATABASE_URL"
    );
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: TEACHER_EMAIL,
    password: TEACHER_PASSWORD,
  });
  if (signInError) {
    console.error("Supabase login failed:", signInError.message);
    process.exit(1);
  }

  const { data: remoteTasks, error: tasksError } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: true });
  if (tasksError) {
    console.error("Fetch tasks failed:", tasksError.message);
    process.exit(1);
  }

  const { data: remoteAnswers, error: answersError } = await supabase
    .from("task_answers")
    .select("*");
  if (answersError) {
    console.error("Fetch answers failed:", answersError.message);
    process.exit(1);
  }

  const sql = postgres(TARGET_DATABASE_URL, { max: 1 });
  const db = drizzle(sql);

  const localTasks = await db.select().from(tasks);
  const localAnswers = await db.select().from(taskAnswers);

  console.log(
    `Supabase: ${remoteTasks?.length ?? 0} tasks, ${remoteAnswers?.length ?? 0} answers`
  );
  console.log(
    `VPS:      ${localTasks.length} tasks, ${localAnswers.length} answers`
  );

  if (
    remoteTasks &&
    remoteAnswers &&
    remoteTasks.length === localTasks.length &&
    remoteAnswers.length === localAnswers.length
  ) {
    console.log("Counts match — migration skip.");
    await sql.end();
    return;
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id")
    .eq("email", TEACHER_EMAIL)
    .single();

  const teacherRows = await db
    .select({ id: tasks.teacherId })
    .from(tasks)
    .limit(1);
  const newTeacherId =
    teacherRows[0]?.id ??
    (
      await db
        .select({ id: tasks.teacherId })
        .from(tasks)
        .limit(1)
    )[0]?.id;

  const teacherIdRow = await sql<{ id: string }[]>`
    SELECT id FROM users WHERE lower(email) = lower(${TEACHER_EMAIL}) LIMIT 1
  `;
  const teacherId = teacherIdRow[0]?.id;
  if (!teacherId) {
    console.error("Teacher not found on VPS");
    process.exit(1);
  }

  console.log("Re-importing from Supabase...");
  await sql`TRUNCATE public.task_answers, public.tasks CASCADE`;

  for (const row of remoteTasks ?? []) {
    await db.insert(tasks).values({
      id: row.id,
      slug: row.slug,
      title: row.title,
      studentName: row.student_name,
      htmlContent: row.html_content,
      status: row.status,
      teacherId,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  for (const row of remoteAnswers ?? []) {
    await db.insert(taskAnswers).values({
      id: row.id,
      taskId: row.task_id,
      answers: row.answers ?? {},
      updatedAt: new Date(row.updated_at),
    });
  }

  console.log("Import done.");
  if (profile?.id && profile.id !== teacherId) {
    console.log(
      `Note: Supabase teacher id was ${profile.id}, VPS uses ${teacherId}`
    );
  }

  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
