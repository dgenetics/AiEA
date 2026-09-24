#!/usr/bin/env bash
# Instance health: is this AiEA worth driving?
# Checks process/port, email/password auth, Today data plane — not merely compile.
# Usage: doctor.sh [base-url]
# Env: AIEA_EMAIL + AIEA_PASSWORD (optional on fresh local — auto-registers verify user)
#      VERIFY_BASE_URL / SMOKE_BASE_URL
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib.sh"
load_env

BASE="${1:-$(default_base_url)}"
PKG_VERSION=$(node -p "require('$REPO_ROOT/package.json').version" 2>/dev/null || echo unknown)
SHA=$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)
RUN_ID="${VERIFY_RUN_ID:-}"
CRED_FILE=""
if [[ -n "$RUN_ID" ]]; then
  CRED_FILE="$(ensure_run_dir "$RUN_ID")/verify-user.json"
fi

echo "== doctor aiea =="
echo "base: $BASE"
echo "repo_sha: $SHA"
echo "package_version: $PKG_VERSION"

# 1) Port / process answering
code=$(curl -s -o /tmp/aiea-doctor-root.html -w '%{http_code}' --max-time 10 "$BASE/" || echo "000")
echo "GET / -> $code"
[[ "$code" == "200" ]] || { echo "FAIL: root not 200"; exit 1; }
if ! grep -qiE 'AiEA|executive|Sign in|Get started' /tmp/aiea-doctor-root.html; then
  echo "WARN: root HTML did not mention AiEA/Sign in (SPA shell may still be ok)"
fi

# 2) Auth — wrong password rejected
bad=$(curl -s -o /tmp/aiea-doctor-bad.json -w '%{http_code}' --max-time 10 \
  -X POST "$BASE/api/auth/login" \
  -H 'content-type: application/json' \
  -d '{"email":"doctor-wrong@example.com","password":"__doctor_wrong__"}' || echo "000")
echo "POST /api/auth/login wrong creds -> $bad"
[[ "$bad" == "401" || "$bad" == "400" ]] || { echo "FAIL: expected 401/400 for wrong login"; exit 1; }

# 3) Auth — register or login
EMAIL="${AIEA_EMAIL:-}"
PASSWORD="${AIEA_PASSWORD:-}"
AUTH_MODE=""
jar=$(mktemp)

if [[ -n "$EMAIL" && -n "$PASSWORD" ]]; then
  ok=$(curl -s -c "$jar" -o /tmp/aiea-doctor-ok.json -w '%{http_code}' --max-time 15 \
    -X POST "$BASE/api/auth/login" \
    -H 'content-type: application/json' \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" || echo "000")
  echo "POST /api/auth/login (AIEA_EMAIL) -> $ok"
  if [[ "$ok" != "200" ]]; then
    echo "FAIL: login with AIEA_EMAIL failed: $(cat /tmp/aiea-doctor-ok.json)"
    rm -f "$jar"
    exit 1
  fi
  AUTH_MODE="login"
else
  # Fresh local / CI: create a disposable verify account (do not invent live creds).
  EMAIL="verify+$(date -u +%Y%m%d%H%M%S)@aiea.test"
  PASSWORD="AiEaVerify1!"
  ok=$(curl -s -c "$jar" -o /tmp/aiea-doctor-ok.json -w '%{http_code}' --max-time 15 \
    -X POST "$BASE/api/auth/register" \
    -H 'content-type: application/json' \
    -d "{\"name\":\"Verify Bot\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" || echo "000")
  echo "POST /api/auth/register (disposable) -> $ok email=$EMAIL"
  if [[ "$ok" != "200" ]]; then
    echo "FAIL: register failed: $(cat /tmp/aiea-doctor-ok.json)"
    echo "HINT: set AIEA_EMAIL + AIEA_PASSWORD for live targets that disallow open register."
    rm -f "$jar"
    exit 1
  fi
  AUTH_MODE="register"
  # Export for subsequent drive in same gate process
  export AIEA_EMAIL="$EMAIL"
  export AIEA_PASSWORD="$PASSWORD"
fi

if ! grep -q aiea_session "$jar"; then
  echo "FAIL: no aiea_session cookie after auth"
  rm -f "$jar"
  exit 1
fi
echo "auth_mode: $AUTH_MODE"

if [[ -n "$CRED_FILE" ]]; then
  python3 - <<PY
import json
json.dump({"email": "$EMAIL", "password": "$PASSWORD", "auth_mode": "$AUTH_MODE"}, open("$CRED_FILE", "w"))
print("wrote credentials: $CRED_FILE")
PY
fi

# 4) Today must not 500
today=$(curl -s -b "$jar" -o /tmp/aiea-doctor-today.html -w '%{http_code}' --max-time 20 \
  "$BASE/today" || echo "000")
echo "GET /today -> $today"
[[ "$today" == "200" ]] || { echo "FAIL: /today must be 200 (got $today)"; rm -f "$jar"; exit 1; }
if ! grep -qiE 'Today|Capture|Tasks|Good (morning|afternoon|evening)' /tmp/aiea-doctor-today.html; then
  echo "WARN: /today HTML missing expected Today chrome"
fi

# 5) Authenticated API — tasks
tasks=$(curl -s -b "$jar" -o /tmp/aiea-doctor-tasks.json -w '%{http_code}' --max-time 15 \
  "$BASE/api/tasks" || echo "000")
echo "GET /api/tasks -> $tasks"
[[ "$tasks" == "200" ]] || { echo "FAIL: /api/tasks"; rm -f "$jar"; exit 1; }
python3 - <<'PY'
import json
data = json.load(open("/tmp/aiea-doctor-tasks.json"))
assert isinstance(data, list) or isinstance(data, dict), type(data)
if isinstance(data, list):
    print(f"tasks_count: {len(data)}")
else:
    print(f"tasks_keys: {sorted(data.keys())[:12]}")
PY

# 6) Capture page reachable
cap=$(curl -s -b "$jar" -o /tmp/aiea-doctor-capture.html -w '%{http_code}' --max-time 15 \
  "$BASE/capture" || echo "000")
echo "GET /capture -> $cap"
[[ "$cap" == "200" ]] || { echo "FAIL: /capture"; rm -f "$jar"; exit 1; }

rm -f "$jar"
echo "doctor ok (instance healthy)"
echo "AIEA_EMAIL=$EMAIL"
