#!/usr/bin/env bash
# Copy tasks + answers from Supabase → local Postgres (VPS).
# Does NOT switch the live app. Teacher must already exist on the target DB.
#
# Usage on VPS:
#   export SOURCE_DATABASE_URL='postgresql://postgres.[ref]:[PASSWORD]@db.[ref].supabase.co:5432/postgres'
#   export TARGET_DATABASE_URL='postgresql://tasksite:TaskSiteDb2026@127.0.0.1:5432/tasksite'
#   export TEACHER_EMAIL='mvikhareva@icloud.com'
#   bash scripts/migrate-from-supabase.sh
set -euo pipefail

: "${SOURCE_DATABASE_URL:?Set SOURCE_DATABASE_URL (Supabase DB URI)}"
: "${TARGET_DATABASE_URL:?Set TARGET_DATABASE_URL (VPS Postgres URI)}"
: "${TEACHER_EMAIL:?Set TEACHER_EMAIL (same email you use to log in)}"

need() { command -v "$1" >/dev/null || { echo "Missing: $1" >&2; exit 1; }; }
need pg_dump
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
  echo "Create first: DATABASE_URL=... npm run create-teacher -- $TEACHER_EMAIL 'password'" >&2
  exit 1
fi
echo "   teacher id = $NEW_TEACHER_ID"

echo "2) Exporting tasks + answers from Supabase..."
pg_dump "$SOURCE_DATABASE_URL" \
  --data-only \
  --no-owner \
  --no-privileges \
  --table=public.tasks \
  --table=public.task_answers \
  -f "$TMP/data.sql"

echo "3) Clearing old rows on VPS (keeps your teacher user)..."
psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -c \
  "TRUNCATE public.task_answers, public.tasks CASCADE;"

echo "4) Importing (FK checks off temporarily)..."
psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
SET session_replication_role = replica;
\i $TMP/data.sql
SET session_replication_role = origin;
SQL

echo "5) Pointing all tasks at your VPS teacher account..."
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
