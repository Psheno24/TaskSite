#!/usr/bin/env bash
# Copy tasks + answers from Supabase → local Postgres (VPS).
# Uses psql \COPY (no pg_dump version matching).
#
# Usage:
#   TEACHER_EMAIL='...' \
#   TARGET_DATABASE_URL='postgresql://tasksite:...@127.0.0.1:5432/tasksite' \
#   SOURCE_DATABASE_URL='postgresql://postgres:...@db.xxx.supabase.co:5432/postgres?sslmode=require' \
#   bash scripts/migrate-from-supabase.sh
set -euo pipefail

: "${SOURCE_DATABASE_URL:?Set SOURCE_DATABASE_URL (Supabase DB URI)}"
: "${TARGET_DATABASE_URL:?Set TARGET_DATABASE_URL (VPS Postgres URI)}"
: "${TEACHER_EMAIL:?Set TEACHER_EMAIL}"

need() { command -v "$1" >/dev/null || { echo "Missing: $1" >&2; exit 1; }; }
need psql

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

EMAIL_ESC="${TEACHER_EMAIL//\'/\'\'}"

echo "1) Reading new teacher id on VPS..."
NEW_TEACHER_ID="$(psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -tAc \
  "SELECT id FROM users WHERE lower(email) = lower('${EMAIL_ESC}') LIMIT 1;")"
NEW_TEACHER_ID="$(echo "$NEW_TEACHER_ID" | tr -d '[:space:]')"
if [[ -z "$NEW_TEACHER_ID" ]]; then
  echo "Teacher not found on VPS: $TEACHER_EMAIL" >&2
  exit 1
fi
echo "   teacher id = $NEW_TEACHER_ID"

echo "2) Exporting from Supabase via COPY..."
psql "$SOURCE_DATABASE_URL" -v ON_ERROR_STOP=1 -c \
  "\\copy public.tasks TO '${TMP}/tasks.csv' WITH (FORMAT csv, HEADER true)"
psql "$SOURCE_DATABASE_URL" -v ON_ERROR_STOP=1 -c \
  "\\copy public.task_answers TO '${TMP}/answers.csv' WITH (FORMAT csv, HEADER true)"

echo "   tasks file: $(wc -l < "${TMP}/tasks.csv") lines"
echo "   answers file: $(wc -l < "${TMP}/answers.csv") lines"

echo "3) Clearing old rows on VPS (keeps teacher)..."
psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -c \
  "TRUNCATE public.task_answers, public.tasks CASCADE;"

echo "4) Importing CSV (FK checks off)..."
psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
SET session_replication_role = replica;
\\copy public.tasks FROM '${TMP}/tasks.csv' WITH (FORMAT csv, HEADER true)
\\copy public.task_answers FROM '${TMP}/answers.csv' WITH (FORMAT csv, HEADER true)
SET session_replication_role = origin;
SQL

echo "5) Pointing all tasks at your VPS teacher..."
psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -c \
  "UPDATE public.tasks SET teacher_id = '${NEW_TEACHER_ID}';"

echo "6) Counts:"
psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
SELECT 'tasks' AS what, count(*)::text AS n FROM public.tasks
UNION ALL
SELECT 'answers', count(*)::text FROM public.task_answers
UNION ALL
SELECT 'teachers', count(*)::text FROM public.users;
SQL

echo
echo "Done. Site still uses Supabase until you switch Vercel."
