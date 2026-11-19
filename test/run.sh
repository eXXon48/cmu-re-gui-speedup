#!/bin/sh
# Package checks: JSON parses, main.js is ES5 for Presto, unit tests pass.
# usage: sh test/run.sh   (needs node + python3)
set -eu
cd "$(dirname "$0")/.."
python3 -m json.tool pkg/manifest.json >/dev/null
python3 -m json.tool pkg/payload/ui/hmi.json >/dev/null
if grep -nE '(^|[^A-Za-z0-9_$.])(let|const|class)[[:space:]]|=>|`' pkg/payload/ui/main.js; then
  echo "FAIL: main.js must be ES5 (Presto)" >&2; exit 1
fi
node test/main.test.js
echo ok
