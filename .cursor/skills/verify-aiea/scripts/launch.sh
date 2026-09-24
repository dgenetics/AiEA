#!/usr/bin/env bash
# Start an agent-owned AiEA instance on a non-colliding port.
# Usage: launch.sh [port] [run-id]
# Writes server.pid + server.url under evidence/<run-id>/.
# Default port 3200 (avoid human :3000 and bf-maintenance :3100).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib.sh"
load_env
clear_turso_for_local

PORT="${1:-3200}"
RUN_ID="${2:-$(new_run_id)}"
OUT="$(ensure_run_dir "$RUN_ID")"
BASE="http://127.0.0.1:${PORT}"

if curl -s -o /dev/null --max-time 1 "$BASE/" 2>/dev/null; then
  echo "port $PORT already answering — refusing to hijack" >&2
  exit 3
fi

cd "$REPO_ROOT"
if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "copied .env.example → .env (set AUTH_SECRET; optional AIEA_SMOKE_EMAIL/AIEA_SMOKE_PASSWORD for live)" >&2
fi
if [[ ! -d node_modules ]]; then
  npm ci
fi
npx prisma generate >/dev/null
need_build=0
if [[ "${VERIFY_REBUILD:-}" == "1" || ! -d .next || ! -f .next/BUILD_ID ]]; then
  need_build=1
elif [[ -n "$(find src prisma package.json package-lock.json next.config.ts -newer .next/BUILD_ID 2>/dev/null | head -1)" ]]; then
  need_build=1
fi
if [[ "$need_build" == "1" ]]; then
  echo "building next (VERIFY_REBUILD or sources newer than .next)" >&2
  npm run build
fi

VERIFY_DB="$OUT/verify.db"
if [[ ! -f "$VERIFY_DB" ]]; then
  DATABASE_URL="file:$VERIFY_DB" npx prisma db push
fi

# setsid so cleanup can kill the whole group (npm → next)
set +e
setsid env \
  DATABASE_URL="file:$VERIFY_DB" \
  TURSO_DATABASE_URL= \
  TURSO_AUTH_TOKEN= \
  AUTH_SECRET="${AUTH_SECRET:-verify-aiea-local-secret}" \
  AIEA_TIMEZONE="${AIEA_TIMEZONE:-America/New_York}" \
  BF_MAINTENANCE_URL="${BF_MAINTENANCE_URL:-}" \
  BF_INTEGRATION_SECRET="${BF_INTEGRATION_SECRET:-}" \
  XAI_API_KEY="${XAI_API_KEY:-}" \
  PORT="$PORT" \
  npm run start -- -p "$PORT" -H 127.0.0.1 \
  >"$OUT/server.txt" 2>&1 &
SPID=$!
set -e
echo "$SPID" >"$OUT/server.pid"
echo "$BASE" >"$OUT/server.url"
echo "$RUN_ID" >"$OUT/../.last-run-id"

ready=0
for _ in $(seq 1 90); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "$BASE/" || true)
  if [[ "$code" == "200" ]]; then
    ready=1
    break
  fi
  sleep 1
done
if [[ "$ready" != "1" ]]; then
  echo "server did not become ready on $BASE" >&2
  tail -n 60 "$OUT/server.txt" >&2 || true
  exit 1
fi

echo "launched $BASE pid=$(cat "$OUT/server.pid") run=$RUN_ID"
echo "$RUN_ID"
