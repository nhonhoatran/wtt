#!/bin/sh
# Prints the target + pending migrations, refuses unless MIGRATE_CONFIRM_TARGET matches, then deploys.
set -eu

node scripts/print-db-target.mjs --confirm

echo "Migration status before deploy:"
# `migrate status` exits non-zero when migrations are pending; that is expected here.
node_modules/.bin/prisma migrate status || true

node_modules/.bin/prisma migrate deploy
