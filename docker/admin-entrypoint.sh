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

# Same ceiling the API enforces (UPLOAD_MAX_IMAGE_BYTES), so nginx never rejects an upload the API would accept.
UPLOAD_MAX_IMAGE_BYTES="${UPLOAD_MAX_IMAGE_BYTES:?UPLOAD_MAX_IMAGE_BYTES is required}"
case "$UPLOAD_MAX_IMAGE_BYTES" in
  '' | *[!0-9]*) echo "UPLOAD_MAX_IMAGE_BYTES must be a positive integer" >&2; exit 1 ;;
esac
printf 'client_max_body_size %s;
' "$UPLOAD_MAX_IMAGE_BYTES" > "$OUTPUT_DIR/upload-limit.conf"

# Excel import uploads: same ceiling as the API (IMPORT_MAX_FILE_BYTES).
IMPORT_MAX_FILE_BYTES="${IMPORT_MAX_FILE_BYTES:?IMPORT_MAX_FILE_BYTES is required}"
case "$IMPORT_MAX_FILE_BYTES" in
  '' | *[!0-9]*) echo "IMPORT_MAX_FILE_BYTES must be a positive integer" >&2; exit 1 ;;
esac
printf 'client_max_body_size %s;
' "$IMPORT_MAX_FILE_BYTES" > "$OUTPUT_DIR/import-limit.conf"

if [ "$#" -gt 0 ]; then
  exec "$@"
fi
