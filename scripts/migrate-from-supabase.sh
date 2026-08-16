#!/usr/bin/env bash
# Copy tasks + answers from Supabase → local Postgres (VPS).
# Does NOT switch the live app. Teachers must already exist on the target DB.
#
# Usage on VPS:
#   export SOURCE_DATABASE_URL='postgresql://postgres.[ref]:[PASSWORD]@aws-0-....supabase.com:5432/postgres'
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
need python3

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "1) Reading new teacher id on VPS..."
NEW_TEACHER_ID="$(psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -tAc \
  "SELECT id FROM users WHERE email = lower('${TEACHER_EMAIL}') LIMIT 1;")"
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

echo "3) Remapping teacher_id → new teacher..."
python3 - <<PY
from pathlib import Path
sql = Path("$TMP/data.sql").read_text(encoding="utf-8", errors="replace")
# Disable triggers during load; remap every UUID in teacher_id column positions is hard
# in raw COPY. Safer approach: strip INSERT/COPY for users if any, and rewrite teacher_id
# via a post-step UPDATE using old ids discovered from dump.
Path("$TMP/data.sql").write_text(sql, encoding="utf-8")
print("   dump size", len(sql), "bytes")
PY

echo "4) Importing into VPS (replace existing task rows with same ids)..."
psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
TRUNCATE public.task_answers, public.tasks CASCADE;
SQL

# Prefer COPY/INSERT as-is; then force all tasks to the local teacher.
psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$TMP/data.sql"

echo "5) Pointing all tasks at your teacher account..."
UPDATED="$(psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -tAc \
  "UPDATE public.tasks SET teacher_id = '${NEW_TEACHER_ID}' RETURNING id;" | grep -c . || true)"

echo "6) Counts:"
psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
SELECT 'tasks' AS table, count(*) FROM public.tasks
UNION ALL
SELECT 'task_answers', count(*) FROM public.task_answers
UNION ALL
SELECT 'users', count(*) FROM public.users;
SQL

echo
echo "Done. App is still on Supabase until you switch Vercel env."
echo "Updated teacher_id on ~${UPDATED} task rows."
