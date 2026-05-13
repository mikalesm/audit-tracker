#!/bin/sh
# Container entrypoint: run migrations against Postgres before serving traffic.
# - In Azure (WEBSITE_SITE_NAME set), refuse to start if PGHOST is missing —
#   that would silently fall back to pglite and lose data on restart.
# - For local Docker smoke tests (DATABASE_URL=pglite or unset, not in App
#   Service), skip the startup migration; the app will lazily migrate against
#   pglite on first request.
set -e

if [ -n "$PGHOST" ] && [ -n "$PGUSER" ] && [ -n "$PGDATABASE" ]; then
  echo "[entrypoint] migrating ${PGUSER}@${PGHOST}/${PGDATABASE}"
  node scripts/migrate-startup.mjs
elif [ "${DATABASE_URL#postgres}" != "$DATABASE_URL" ]; then
  echo "[entrypoint] migrating via DATABASE_URL"
  node scripts/migrate-startup.mjs
elif [ -n "$WEBSITE_SITE_NAME" ]; then
  echo "[entrypoint] FATAL: running in Azure App Service ($WEBSITE_SITE_NAME) but no PGHOST/PGUSER/PGDATABASE or DATABASE_URL is set."
  echo "[entrypoint] Refusing to start with embedded pglite (data would not survive restart)."
  exit 1
else
  echo "[entrypoint] no Postgres config detected; skipping startup migration (pglite/local mode)"
fi

exec node server.js
