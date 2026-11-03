#!/usr/bin/env bash
# Runs ON the VPS every night (cron entry made by server-up.sh).
# Copy one to your laptop now and then; a backup on the same server
# does not survive losing the server:
#   ssh root@<VPS-IP> cat /opt/smartro/backups/daily-YYYYMMDD.dump > smartro.dump
set -euo pipefail

dir=/opt/smartro/backups
file="$dir/daily-$(date +%Y%m%d).dump"

/usr/local/bin/smartro exec -T db pg_dump -U smartro --format=custom smartro > "$file.part"
mv "$file.part" "$file"
find "$dir" -name 'daily-*.dump' -mtime +14 -delete

echo "$(date -Is) backup ok: $file ($(du -h "$file" | cut -f1))"
