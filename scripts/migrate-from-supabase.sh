#!/usr/bin/env bash
# Copy tasks + answers from Supabase → local Postgres (VPS).
# Uses psql \COPY (no pg_dump, no superuser needed).
set -euo pipefail

: "${SOURCE_DATABASE_URL:?Set SOURCE_DATABASE_URL (Supabase DB URI)}"
: "${TARGET_DATABASE_URL:?Set TARGET_DATABASE_URL (VPS Postgres URI)}"
: "${TEACHER_EMAIL:?Set TEACHER_EMAIL}"

need() { command -v "$1" >/dev/null || { echo "Missing: $1" >&2; exit 1; }; }
need psql
need python3

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

echo "3) Remapping teacher_id in CSV..."
python3 - <<PY
import csv
from pathlib import Path
src = Path("${TMP}/tasks.csv")
dst = Path("${TMP}/tasks_mapped.csv")
new_id = "${NEW_TEACHER_ID}"
with src.open(newline="", encoding="utf-8") as f_in, dst.open(
    "w", newline="", encoding="utf-8"
) as f_out:
    reader = csv.DictReader(f_in)
    if not reader.fieldnames or "teacher_id" not in reader.fieldnames:
        raise SystemExit(f"Unexpected tasks CSV columns: {reader.fieldnames}")
    writer = csv.DictWriter(f_out, fieldnames=reader.fieldnames)
    writer.writeheader()
    n = 0
    for row in reader:
        row["teacher_id"] = new_id
        writer.writerow(row)
        n += 1
print(f"   remapped {n} tasks")
PY

echo "4) Clearing old rows on VPS (keeps teacher)..."
psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -c \
  "TRUNCATE public.task_answers, public.tasks CASCADE;"

echo "5) Importing CSV..."
psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -c \
  "\\copy public.tasks FROM '${TMP}/tasks_mapped.csv' WITH (FORMAT csv, HEADER true)"
psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -c \
  "\\copy public.task_answers FROM '${TMP}/answers.csv' WITH (FORMAT csv, HEADER true)"

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
