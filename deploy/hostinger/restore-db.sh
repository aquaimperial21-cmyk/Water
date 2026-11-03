#!/usr/bin/env bash
# Run on your laptop (Git Bash) after deploy.sh has run once:
#   SERVER=root@<VPS-IP> bash deploy/hostinger/restore-db.sh deploy/hostinger/backups/railway-XXXX.dump
#
# REPLACES the database on the VPS with the dump. The VPS saves its current
# database to /opt/smartro/backups/before-restore-*.dump first.
set -euo pipefail

: "${SERVER:?Set SERVER first, e.g.  SERVER=root@123.45.67.89}"
DUMP="${1:?Give the dump file, e.g. deploy/hostinger/backups/railway-20261104-1030.dump}"
[ -f "$DUMP" ] || { echo "No such file: $DUMP"; exit 1; }

echo "This replaces the database on $SERVER with $DUMP ($(du -h "$DUMP" | cut -f1))."
read -rp "Type yes to continue: " answer
[ "$answer" = yes ] || { echo "Stopped. Nothing changed."; exit 1; }

ssh "$SERVER" "cat > /opt/smartro/backups/restore-upload.dump && bash /opt/smartro/src/deploy/hostinger/server-restore.sh /opt/smartro/backups/restore-upload.dump" < "$DUMP"
