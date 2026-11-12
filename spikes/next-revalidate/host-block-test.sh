#!/bin/sh
# usage: host-block-test.sh ; needs standalone server started with CHECK_HOST=1 and/or PROXY_BLOCK=1
B='{"tags":["match-x"],"mode":"expire0"}'
code() { curl -s -o /dev/null -w "%{http_code}" -X POST -H "$3" -H 'content-type: application/json' ${2:+-H "Host: $2"} -d "$B" http://127.0.0.1:4101/api/revalidate; }
echo "internal host + secret : $(code x 127.0.0.1:4101 'x-revalidate-secret: dev-secret')"
echo "public host + secret   : $(code x wtt.example.com 'x-revalidate-secret: dev-secret')"
echo "public host no secret  : $(code x wtt.example.com 'x-foo: 1')"
echo "internal host bad secret: $(code x 127.0.0.1:4101 'x-revalidate-secret: nope')"
echo "X-Forwarded-Host spoof (internal host header absent): $(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'x-revalidate-secret: dev-secret' -H 'x-forwarded-host: 127.0.0.1:4101' -H 'Host: wtt.example.com' -d "$B" http://127.0.0.1:4101/api/revalidate)"
