#!/usr/bin/env bash
# Bootstrap TaskSite Postgres on an Ubuntu VPS.
# Does NOT switch the app off Supabase — only prepares the database.
#
# Usage (on the VPS as root or with sudo):
#   curl -fsSL ... | bash   # or copy this file
#   sudo bash scripts/vps-bootstrap.sh
#
# Optional env:
#   DB_NAME=tasksite DB_USER=tasksite DB_PASSWORD='...' TEACHER_EMAIL=... TEACHER_PASSWORD=...
set -euo pipefail

DB_NAME="${DB_NAME:-tasksite}"
DB_USER="${DB_USER:-tasksite}"
DB_PASSWORD="${DB_PASSWORD:-}"
TEACHER_EMAIL="${TEACHER_EMAIL:-}"
TEACHER_PASSWORD="${TEACHER_PASSWORD:-}"
SCHEMA_FILE="$(cd "$(dirname "$0")/.." && pwd)/postgres/schema.sql"

if [[ ! -f "$SCHEMA_FILE" ]]; then
  echo "schema not found: $SCHEMA_FILE" >&2
  exit 1
fi

if [[ -z "$DB_PASSWORD" ]]; then
  DB_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
  echo "Generated DB_PASSWORD (save it): $DB_PASSWORD"
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq postgresql postgresql-contrib

# Start cluster if needed
if command -v pg_ctlcluster >/dev/null; then
  pg_ctlcluster 16 main start 2>/dev/null || pg_ctlcluster 15 main start 2>/dev/null || true
fi

sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';
  ELSE
    ALTER ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}';
  END IF;
END
\$\$;

SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec

GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
SQL

# Allow password auth from localhost
HBA="$(sudo -u postgres psql -tAc "SHOW hba_file")"
if [[ -n "$HBA" ]] && ! grep -q "127.0.0.1/32.*scram-sha-256" "$HBA" 2>/dev/null; then
  echo "host ${DB_NAME} ${DB_USER} 127.0.0.1/32 scram-sha-256" >> "$HBA"
  echo "host ${DB_NAME} ${DB_USER} ::1/128 scram-sha-256" >> "$HBA"
  if command -v pg_ctlcluster >/dev/null; then
    pg_ctlcluster 16 main reload 2>/dev/null || pg_ctlcluster 15 main reload 2>/dev/null || true
  else
    sudo -u postgres psql -c "SELECT pg_reload_conf();" >/dev/null
  fi
fi

PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$SCHEMA_FILE"

AUTH_SECRET="$(openssl rand -base64 48 | tr -d '\n')"

echo
echo "======== Postgres ready (app still on Supabase until you switch) ========"
echo "DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}"
echo "AUTH_SECRET=${AUTH_SECRET}"
echo
echo "Save these for Vercel when you cut over:"
echo "  DATA_PROVIDER=postgres"
echo "  DATABASE_URL=..."
echo "  AUTH_SECRET=..."
echo
if [[ -n "$TEACHER_EMAIL" && -n "$TEACHER_PASSWORD" ]]; then
  if command -v npm >/dev/null && [[ -f "$(dirname "$0")/create-teacher.ts" ]]; then
    DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}" \
      npx --yes tsx "$(dirname "$0")/create-teacher.ts" "$TEACHER_EMAIL" "$TEACHER_PASSWORD"
  else
    echo "Create teacher later from the app repo:"
    echo "  DATABASE_URL=... npm run create-teacher -- ${TEACHER_EMAIL} '***'"
  fi
fi
