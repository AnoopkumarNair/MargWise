#!/bin/bash
# Starts a local copy of Margwise (wrangler pages dev, local D1) on :8788 with invite code "master".
# Works on a COPY of hosting/ under $PLAYTEST_OUT/site, so the repo is never written to
# (except that a missing hosting/public/index.html is built first; that file is gitignored).
# Idempotent. Needs node, npx (wrangler), curl. Set REPO=/path/to/copy to serve a copy instead of this repo.
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# REPO (or SITE_ROOT) can point at another checkout or a throwaway copy, e.g. a preview built with a new story. Default: this repo.
R="$(cd "${REPO:-${SITE_ROOT:-$HERE/../../..}}" && pwd)"
OUT="${PLAYTEST_OUT:-$HERE/out}"
PORT=${PORT:-8788}
if curl -sf http://localhost:$PORT/api/config >/dev/null 2>&1; then echo "already running on $PORT"; exit 0; fi
mkdir -p "$OUT/site"; rm -rf "$OUT/site/hosting"
if [ ! -f "$R/hosting/public/index.html" ]; then
  # build.py also rewrites the tracked manifest.json; restore it.
  (cd "$R" && python3 app/build.py >/dev/null && { git checkout hosting/public/manifest.json 2>/dev/null || true; })
fi
cp -r "$R/hosting" "$OUT/site/hosting"; rm -rf "$OUT/site/hosting/.wrangler" "$OUT/site/hosting/tests"
cd "$OUT/site/hosting" || exit 1
for f in schema.sql $(ls schema[0-9]*.sql | sort -V); do
  npx wrangler d1 execute margwise-test --local --file "$f" >/dev/null 2>"$OUT/d1_$f.err" || { echo "schema $f failed (maybe already applied)"; tail -2 "$OUT/d1_$f.err"; }
done
nohup npx wrangler pages dev public --port $PORT --binding INVITE_CODE=master --binding SIGN_KEY=local-test-sign-key-0123456789abcdef > "$OUT/server.log" 2>&1 &
echo $! > "$OUT/server.pid"
for i in $(seq 1 60); do curl -sf http://localhost:$PORT/api/config && { echo; echo "up on $PORT"; exit 0; }; sleep 1; done
echo "failed to start"; tail -20 "$OUT/server.log"; exit 1
