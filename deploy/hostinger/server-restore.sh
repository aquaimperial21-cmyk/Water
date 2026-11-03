#!/usr/bin/env bash
# Runs ON the VPS (restore-db.sh calls it):
#   bash server-restore.sh /path/to/file.dump
# Swaps the database for the dump, then lets the API apply any newer
# prisma migrations the dump doesn't have yet.
set -euo pipefail

DUMP="${1:?usage: server-restore.sh <file.dump>}"
S=${SMARTRO_CMD:-/usr/local/bin/smartro}
BACKUPS=${SMARTRO_HOME:-/opt/smartro}/backups
psql_q() { $S exec -T db psql -U smartro -d smartro -At -c "$1"; }

ts=$(date +%Y%m%d-%H%M%S)
safety="$BACKUPS/before-restore-$ts.dump"

echo "==> Saving the current database to $safety"
$S exec -T db pg_dump -U smartro --format=custom smartro > "$safety"

echo "==> Stopping the API"
$S stop api

echo "==> Recreating an empty database"
$S exec -T db psql -v ON_ERROR_STOP=1 -U smartro -d postgres \
  -c "DROP DATABASE IF EXISTS smartro WITH (FORCE);" \
  -c "CREATE DATABASE smartro;"

echo "==> Restoring $DUMP"
set +e
$S exec -T db pg_restore -U smartro -d smartro --no-owner --no-acl < "$DUMP"
rc=$?
set -e
[ $rc -eq 0 ] || echo "NOTE: pg_restore reported problems (exit $rc). Check the counts below."

echo "==> What came across"
echo "  users:         $(psql_q 'SELECT count(*) FROM "User"')"
echo "  subscriptions: $(psql_q 'SELECT count(*) FROM "Subscription"')"
echo "  devices:       $(psql_q 'SELECT count(*) FROM "Device"')"
echo "  payments:      $(psql_q 'SELECT count(*) FROM "Payment"')"
echo "  migrations:    $(psql_q 'SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL') applied"

echo "==> Starting the API (it applies newer migrations first)"
$S up -d api
for _ in $(seq 1 40); do
  state=$(docker inspect -f '{{.State.Health.Status}}' "$($S ps -q api)" 2>/dev/null || echo starting)
  [ "$state" = healthy ] && break
  sleep 5
done
$S logs --tail 25 api
if [ "$state" != healthy ]; then
  echo
  echo "API is not healthy yet (state: $state). Old database kept at $safety"
  exit 1
fi

rm -f "$DUMP"
echo
echo "Restore done. Previous database kept at $safety"
