#!/bin/sh
# usage: run-standalone.sh [ENV=VAL ...]; standalone server on 4101, PID in .pid-next
ROOT="$(cd "$(dirname "$0")" && pwd)"
[ -d "$ROOT/.next/standalone/.next/static" ] || cp -r "$ROOT/.next/static" "$ROOT/.next/standalone/.next/static"
cd "$ROOT/.next/standalone" || exit 1
env PORT=4101 HOSTNAME=127.0.0.1 NODE_ENV=production "$@" node server.js > "$ROOT/next.log" 2>&1 &
echo $! > "$ROOT/.pid-next"
