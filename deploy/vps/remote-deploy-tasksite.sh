#!/bin/bash
set -euo pipefail

APP_DIR=/opt/tasksite
ENV_FILE=/root/tasksite.env
DOMAIN=tasks.mysitehub.ru
BIND_IP=79.137.197.220
PORT=3000

echo "==> Update env APP_URL"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE" >&2
  exit 1
fi
sed -i "s|^NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=https://${DOMAIN}|" "$ENV_FILE"
grep -q "^HOSTNAME=" "$ENV_FILE" || echo "HOSTNAME=${BIND_IP}" >> "$ENV_FILE"
grep -q "^PORT=" "$ENV_FILE" || echo "PORT=${PORT}" >> "$ENV_FILE"
chmod 600 "$ENV_FILE"

echo "==> Sync code"
cd "$APP_DIR"
git fetch origin
git reset --hard origin/main
install -m 600 "$ENV_FILE" "$APP_DIR/.env"

echo "==> Install and build"
# NEXT_PUBLIC_* must exist at build time; do not `source` secrets (special chars).
export NEXT_PUBLIC_APP_URL="https://${DOMAIN}"
export DATA_PROVIDER=postgres
npm ci
NODE_OPTIONS="--max-old-space-size=2048" npm run build

echo "==> systemd unit"
cat > /etc/systemd/system/tasksite.service <<UNIT
[Unit]
Description=TaskSite Next.js
After=network.target postgresql.service

[Service]
Type=simple
WorkingDirectory=${APP_DIR}
EnvironmentFile=${ENV_FILE}
ExecStart=/usr/bin/npm start -- -H ${BIND_IP} -p ${PORT}
Restart=on-failure
RestartSec=5
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable tasksite
systemctl restart tasksite

echo "==> Patch Caddy for ${DOMAIN}"
cat > /opt/rusgame/deploy/caddy-entrypoint.sh <<'CADDY'
#!/bin/sh
# Генерирует Caddyfile из SITE_DOMAIN — надёжнее, чем {$SITE_DOMAIN} в статическом файле.
set -eu

if [ -z "${SITE_DOMAIN:-}" ]; then
	echo "Ошибка: SITE_DOMAIN не задан (добавьте в .env)" >&2
	exit 1
fi

cat > /tmp/Caddyfile <<EOF
${SITE_DOMAIN} {
	encode gzip
	reverse_proxy app:3001
}

www.${SITE_DOMAIN} {
	redir https://${SITE_DOMAIN}{uri} permanent
}

recipes.mysitehub.ru {
	encode gzip
	reverse_proxy 79.137.197.220:8080
}

tasks.mysitehub.ru {
	encode gzip
	reverse_proxy 79.137.197.220:3000
}
EOF

exec caddy run --config /tmp/Caddyfile --adapter caddyfile
CADDY
chmod +x /opt/rusgame/deploy/caddy-entrypoint.sh

echo "==> Recreate Caddy only"
cd /opt/rusgame
docker compose up -d --no-deps --force-recreate caddy

echo "==> Wait for app"
for i in $(seq 1 30); do
  if curl -sf --max-time 2 "http://${BIND_IP}:${PORT}/login" >/dev/null; then
    echo "APP_OK"
    break
  fi
  sleep 2
done

systemctl is-active tasksite
curl -sI --max-time 5 "http://${BIND_IP}:${PORT}/login" | head -15
echo "DONE"
