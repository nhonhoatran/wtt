#!/bin/sh
# Restart scenarios against standalone server (needs upstream on 4100). Kills only PIDs it started.
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT" || exit 1
H='x-revalidate-secret: dev-secret'
J='content-type: application/json'
set_data() { curl -s -X POST -d "{\"score\":\"$2\"}" "http://127.0.0.1:4100/match/$1" >/dev/null; }
get() { curl -s "http://127.0.0.1:4101/match/$1" | sed 's/<!-- -->//g' | grep -o 'score=[^ ]* version=[0-9]*' | head -1; }
rev() { curl -s -o /dev/null -w "revalidate[$2] http=%{http_code}\n" -X POST -H "$H" -H "$J" -d "{\"tags\":[\"match-$1\"],\"mode\":\"$2\"}" http://127.0.0.1:4101/api/revalidate; }
stop() { kill "$(cat .pid-next)" 2>/dev/null; sleep 1.5; }
start() { [ "$WIPE" = 1 ] && rm -rf "$ROOT/.next/standalone/.next/cache"; sh run-standalone.sh; for i in 1 2 3 4 5 6 7 8 9 10; do curl -s -o /dev/null http://127.0.0.1:4101/api/revalidate && return; sleep 0.5; done; }
S=$$

echo "== A: warm v1, upstream->v2, revalidate expire0, RESTART before any GET"
set_data a$S 1-0; get a$S >/dev/null; set_data a$S 2-0; rev a$S expire0; stop; start
echo "first GET after restart: $(get a$S)   (want score=2-0)"

echo "== B: warm v1, upstream->v2 while server DOWN (revalidate lost), restart"
set_data b$S 1-0; get b$S >/dev/null; stop; set_data b$S 2-0; start
echo "first GET after restart: $(get b$S)   (2-0 = no stale, 1-0 = stale disk cache served)"
rev b$S expire0; echo "after revalidate: $(get b$S)"

echo "== C: warm v1, restart, upstream unchanged (is disk cache reused?)"
set_data c$S 1-0; get c$S >/dev/null
H1=$(curl -s http://127.0.0.1:4100/hits); stop; start; get c$S >/dev/null
H2=$(curl -s http://127.0.0.1:4100/hits); echo "upstream hits before=$H1 after-restart-GET=$H2 (equal = served from disk cache)"

echo "== D: warm v1, upstream->v2, stop, delete .next/cache/fetch-cache, start"
set_data d$S 1-0; get d$S >/dev/null; stop; set_data d$S 2-0
rm -rf "$ROOT/.next/standalone/.next/cache"; start
echo "first GET: $(get d$S)   (want 2-0)"
ls "$ROOT/.next/standalone/.next/cache" 2>&1 | head
