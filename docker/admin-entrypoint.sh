#!/bin/sh
# Writes /config.json for the admin SPA from an explicit allowlist of non-secret keys.
# Never add a key here that holds a secret: this file is publicly downloadable.
set -eu

OUTPUT_DIR="${ADMIN_CONFIG_OUTPUT_DIR:-/tmp/admin-config}"
ALLOWED_KEYS="API_BASE_PATH ADMIN_PUBLIC_URL PUBLIC_SITE_URL"

json_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

body=""
for key in $ALLOWED_KEYS; do
  value=$(printenv "$key" || true)
  [ -n "$body" ] && body="$body,"
  body="$body\"$key\":\"$(json_escape "$value")\""
done

mkdir -p "$OUTPUT_DIR"
printf '{%s}\n' "$body" > "$OUTPUT_DIR/config.json"

if [ "$#" -gt 0 ]; then
  exec "$@"
fi
