#!/usr/bin/env bash
# Helper for exporting/importing TaskSite public schema data.
# Requires: pg_dump, psql, network access to both databases.
#
# Usage:
#   export SOURCE_DATABASE_URL='postgresql://...'
#   export TARGET_DATABASE_URL='postgresql://...'
#   ./migrate-data.sh export   # → ./tasksite-public-data.sql
#   ./migrate-data.sh import   # from ./tasksite-public-data.sql
#
# Prefer recreating Auth users on the target (Studio → Add user),
# then fix teacher_id FKs if UUIDs changed.

set -euo pipefail

DUMP_FILE="${DUMP_FILE:-./tasksite-public-data.sql}"

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing command: $1" >&2
    exit 1
  }
}

case "${1:-}" in
  export)
    need_cmd pg_dump
    : "${SOURCE_DATABASE_URL:?Set SOURCE_DATABASE_URL}"
    echo "Exporting public data → ${DUMP_FILE}"
    pg_dump "$SOURCE_DATABASE_URL" \
      --schema=public \
      --data-only \
      --no-owner \
      --no-privileges \
      --disable-triggers \
      -f "$DUMP_FILE"
    echo "Done. Recreate teachers via Auth on the target, then import."
    ;;
  import)
    need_cmd psql
    : "${TARGET_DATABASE_URL:?Set TARGET_DATABASE_URL}"
    [[ -f "$DUMP_FILE" ]] || {
      echo "Dump not found: $DUMP_FILE (run export first)" >&2
      exit 1
    }
    echo "Importing ${DUMP_FILE} → target"
    psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DUMP_FILE"
    echo "Done. If teacher UUIDs differ, UPDATE public.tasks.teacher_id."
    ;;
  *)
    echo "Usage: $0 export|import" >&2
    exit 1
    ;;
esac
