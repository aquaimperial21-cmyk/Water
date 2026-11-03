#!/usr/bin/env bash
# Run on your laptop (Git Bash) while the Railway Postgres service is online:
#   bash deploy/hostinger/dump-railway.sh
#
# It asks for the Railway DATABASE_PUBLIC_URL (Railway -> Postgres service ->
# Variables) and saves the whole database to deploy/hostinger/backups/.
# Nothing on Railway is changed.
set -euo pipefail
cd "$(dirname "$0")"

PG_BIN=""
if ! command -v pg_dump >/dev/null 2>&1; then
  PG_BIN="/c/Program Files/PostgreSQL/18/bin/"
  [ -x "${PG_BIN}pg_dump.exe" ] || { echo "pg_dump not found. Install PostgreSQL 18 client tools."; exit 1; }
fi

read -rsp "Paste the Railway DATABASE_PUBLIC_URL, then press Enter: " URL
echo
case "$URL" in
  postgres://*|postgresql://*) ;;
  *) echo "That doesn't look like a postgresql:// URL."; exit 1 ;;
esac
# Prisma-style URLs end in ?schema=public, which pg_dump rejects.
URL="${URL%%\?schema=*}"

mkdir -p backups
out="backups/railway-$(date +%Y%m%d-%H%M).dump"

echo "Downloading the Railway database ..."
"${PG_BIN}pg_dump" --format=custom --no-owner --no-acl --dbname="$URL" --file="$out"

tables=$("${PG_BIN}pg_restore" --list "$out" | grep -c "TABLE DATA" || true)
echo
echo "Saved deploy/hostinger/$out  ($(du -h "$out" | cut -f1), $tables tables with data)"
echo "Keep this file safe. It holds customer data, and it is gitignored."
