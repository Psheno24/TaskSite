#!/usr/bin/env bash
# Allow Vercel (and other clients) to reach TaskSite Postgres on this VPS.
# Run as root after tasksite DB/user exist.
set -euo pipefail

DB_NAME="${DB_NAME:-tasksite}"
DB_USER="${DB_USER:-tasksite}"
DB_PASSWORD="${DB_PASSWORD:?Set DB_PASSWORD}"

CONF="$(sudo -u postgres psql -tAc "SHOW config_file;" | tr -d '[:space:]')"
HBA="$(sudo -u postgres psql -tAc "SHOW hba_file;" | tr -d '[:space:]')"
DATA_DIR="$(sudo -u postgres psql -tAc "SHOW data_directory;" | tr -d '[:space:]')"

echo "config: $CONF"
echo "hba: $HBA"

sudo -u postgres psql -v ON_ERROR_STOP=1 -c "ALTER ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}';"

if ! grep -q "^listen_addresses" "$CONF"; then
  echo "listen_addresses = '*'" >> "$CONF"
else
  sed -i "s/^#*listen_addresses.*/listen_addresses = '*'/" "$CONF"
fi

MARKER="# tasksite-vercel"
if ! grep -q "$MARKER" "$HBA" 2>/dev/null; then
  cat >> "$HBA" <<EOF

$MARKER
host    ${DB_NAME}    ${DB_USER}    0.0.0.0/0    scram-sha-256
host    ${DB_NAME}    ${DB_USER}    ::/0         scram-sha-256
EOF
fi

if command -v pg_ctlcluster >/dev/null; then
  pg_ctlcluster 16 main restart 2>/dev/null || pg_ctlcluster 15 main restart 2>/dev/null || true
else
  systemctl restart postgresql
fi

if command -v ufw >/dev/null && ufw status | grep -qi active; then
  ufw allow 5432/tcp comment 'tasksite postgres for vercel' || true
fi

sleep 2
ss -tlnp | grep 5432 || true
echo "Remote DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@85.192.41.117:5432/${DB_NAME}"
