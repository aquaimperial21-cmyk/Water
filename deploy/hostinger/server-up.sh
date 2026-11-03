#!/usr/bin/env bash
# Runs ON the VPS. deploy.sh uploads the code to /opt/smartro/src and calls
# this. Safe to run again: it creates only what is missing, then rebuilds.
set -euo pipefail

SMARTRO_HOME=/opt/smartro
HERE="$SMARTRO_HOME/src/deploy/hostinger"
ENV_FILE="$SMARTRO_HOME/.env"

log() { printf '\n==> %s\n' "$*"; }
die() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" = 0 ] || die "run as root (SERVER=root@<ip>)"

# 1. Docker ---------------------------------------------------------------
if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  log "Installing Docker (about 1 minute)"
  curl -fsSL https://get.docker.com | sh
fi

# 2. Folders that survive redeploys ----------------------------------------
mkdir -p "$SMARTRO_HOME/secrets" "$SMARTRO_HOME/backups"
chmod 700 "$SMARTRO_HOME/secrets" "$SMARTRO_HOME/backups"

if [ -f "$HERE/secrets/firebase-service-account.json" ]; then
  install -m 600 "$HERE/secrets/firebase-service-account.json" "$SMARTRO_HOME/secrets/firebase-service-account.json"
  rm -f "$HERE/secrets/firebase-service-account.json"
  log "Firebase key installed"
fi

# 3. Settings file (first run only) ---------------------------------------
if [ ! -f "$ENV_FILE" ]; then
  host="${PUBLIC_HOST:-$(hostname -f 2>/dev/null || hostname)}"
  case "$host" in
    *.*) ;;
    *) die "hostname '$host' is not a full domain. Re-run with PUBLIC_HOST=srvXXXXXX.hstgr.cloud" ;;
  esac
  log "Creating $ENV_FILE for https://$host"
  sed -e "s|__PUBLIC_HOST__|$host|g" \
      -e "s|__POSTGRES_PASSWORD__|$(openssl rand -hex 24)|" \
      -e "s|__JWT_ACCESS_SECRET__|$(openssl rand -hex 48)|" \
      -e "s|__JWT_REFRESH_SECRET__|$(openssl rand -hex 48)|" \
      "$HERE/server.env.template" > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
fi

PUBLIC_HOST=$(grep -E '^PUBLIC_HOST=' "$ENV_FILE" | cut -d= -f2-)

# 4. The `smartro` command (docker compose with the right files) -----------
cat > /usr/local/bin/smartro <<EOF
#!/bin/sh
exec docker compose -f "$HERE/docker-compose.yml" --env-file "$ENV_FILE" "\$@"
EOF
chmod 755 /usr/local/bin/smartro

# 5. Nightly database backup, kept 14 days ---------------------------------
# 21:30 UTC (the VPS clock) = 03:00 IST. Ubuntu's cron ignores CRON_TZ.
cat > /etc/cron.d/smartro-backup <<EOF
30 21 * * * root /bin/bash $HERE/backup.sh >> /var/log/smartro-backup.log 2>&1
EOF
chmod 644 /etc/cron.d/smartro-backup

# 6. Checks that would otherwise fail quietly later ------------------------
my_ip=$(curl -fsS -4 --max-time 5 https://api.ipify.org || true)
dns_ip=$(getent ahostsv4 "$PUBLIC_HOST" | awk 'NR==1{print $1}' || true)
# Hostinger lists the VPS's own name as 127.0.1.1 in /etc/hosts, so getent
# answers with that instead of public DNS. That is not a DNS problem; skip it.
case "$dns_ip" in 127.*) dns_ip="" ;; esac
if [ -n "$my_ip" ] && [ -n "$dns_ip" ] && [ "$dns_ip" != "$my_ip" ]; then
  echo "WARNING: $PUBLIC_HOST resolves to '${dns_ip:-nothing}', this server is $my_ip."
  echo "         HTTPS will fail until DNS points here."
fi
if [ ! -s "$SMARTRO_HOME/secrets/firebase-service-account.json" ] \
   && ! grep -qE '^FIREBASE_SERVICE_ACCOUNT_JSON=.+' "$ENV_FILE"; then
  echo "WARNING: no Firebase key yet. The server runs, but customer phone login fails."
fi

# 7. Build and start --------------------------------------------------------
log "Building and starting (first time 5-10 minutes, later 1-3)"
smartro up -d --build --remove-orphans
docker image prune -f >/dev/null

log "Waiting for the API"
for _ in $(seq 1 60); do
  state=$(docker inspect -f '{{.State.Health.Status}}' "$(smartro ps -q api)" 2>/dev/null || echo starting)
  [ "$state" = healthy ] && break
  [ "$state" = unhealthy ] && break
  sleep 5
done
if [ "$state" != healthy ]; then
  smartro ps
  smartro logs --tail 60 api
  die "API did not become healthy (state: $state). Logs above."
fi

log "Checking HTTPS"
ok=""
for _ in $(seq 1 24); do
  if curl -fsS --max-time 10 "https://$PUBLIC_HOST/health" >/dev/null 2>&1; then ok=1; break; fi
  sleep 5
done
if [ -z "$ok" ]; then
  smartro logs --tail 40 caddy
  die "API is up but https://$PUBLIC_HOST does not answer. Caddy logs above."
fi

cat <<EOF

SmartRO is live.
  API:    https://$PUBLIC_HOST/api/v1      (health: https://$PUBLIC_HOST/health)
  Admin:  https://$PUBLIC_HOST/
  Logs:   smartro logs -f api
EOF
