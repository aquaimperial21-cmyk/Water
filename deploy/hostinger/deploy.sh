#!/usr/bin/env bash
# Run on your laptop (Git Bash), from anywhere:
#   SERVER=root@<VPS-IP> bash deploy/hostinger/deploy.sh
#
# Uploads the backend + admin exactly as they are on disk (uncommitted
# changes included), then builds and starts them on the VPS. Run it again
# whenever you want the server to have your latest code.
set -euo pipefail

: "${SERVER:?Set SERVER first, e.g.  SERVER=root@123.45.67.89 bash deploy/hostinger/deploy.sh}"
cd "$(dirname "$0")/../.."

echo "Uploading code to $SERVER (it may ask for the root password) ..."

tar -czf - \
  --exclude=node_modules --exclude=dist --exclude=.next --exclude='.next.bak-*' \
  --exclude=coverage --exclude='*.tsbuildinfo' --exclude='*.log' \
  --exclude=.env --exclude='.env.local' --exclude='.env.*.local' \
  --exclude=Backend/uploads \
  --exclude=Backend/firebase-service-account.json \
  --exclude=deploy/hostinger/backups \
  Backend Admin deploy/hostinger \
| ssh "$SERVER" "set -e
    rm -rf /opt/smartro/src.new && mkdir -p /opt/smartro/src.new
    tar -xzf - -C /opt/smartro/src.new
    rm -rf /opt/smartro/src && mv /opt/smartro/src.new /opt/smartro/src
    find /opt/smartro/src/deploy -name '*.sh' -exec sed -i 's/\r\$//' {} +
    PUBLIC_HOST='${PUBLIC_HOST:-}' bash /opt/smartro/src/deploy/hostinger/server-up.sh"
