#!/usr/bin/env bash
# Instance health: is this AiEA worth driving?
# Checks process/port, email/password auth, Today data plane — not merely compile.
# Usage: doctor.sh [base-url]
# Auth:
#   Live / shared DB: AIEA_SMOKE_EMAIL + AIEA_SMOKE_PASSWORD (preferred).
#     Legacy AIEA_EMAIL/AIEA_PASSWORD demoted — migrate to SMOKE names.
#     Verify does NOT create the smoke user (Hong creates the real User row).
#   Local / CI: disposable register into the run’s SQLite when no login creds.
# Env: VERIFY_BASE_URL / SMOKE_BASE_URL / AIEA_BASE_URL
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
code=$(curl -s -D /tmp/aiea-doctor-root.hdr -o /tmp/aiea-doctor-root.html -w '%{http_code}' --max-time 10 "$BASE/" || echo "000")
echo "GET / -> $code"
[[ "$code" == "308" ]] || { echo "FAIL: root must 308 to /tasks (got $code)"; exit 1; }
if ! grep -qiE '^location: .*/tasks' /tmp/aiea-doctor-root.hdr; then
  echo "FAIL: GET / Location is not /tasks"
  exit 1
fi

# 2) Auth — wrong password rejected
bad=$(curl -s -o /tmp/aiea-doctor-bad.json -w '%{http_code}' --max-time 10 \
  -X POST "$BASE/api/auth/login" \
  -H 'content-type: application/json' \
  -d '{"email":"doctor-wrong@example.com","password":"__doctor_wrong__"}' || echo "000")
echo "POST /api/auth/login wrong creds -> $bad"
[[ "$bad" == "401" || "$bad" == "400" ]] || { echo "FAIL: expected 401/400 for wrong login"; exit 1; }

# 3) Auth — local disposable register OR live smoke/legacy login
# Smoke secrets are live-only: never login with AIEA_SMOKE_* against local SQLite.
AUTH_MODE=""
CRED_SOURCE="empty"
EMAIL=""
PASSWORD=""
jar=$(mktemp)

if is_local_base "$BASE"; then
  if has_smoke_creds; then
    echo "note: AIEA_SMOKE_* present but ignored on local base (smoke is live-only; using disposable register)"
  fi
  # Local may still have disposable AIEA_EMAIL from a prior doctor in-process; prefer register when unset.
  if [[ -n "${AIEA_EMAIL:-}" && -n "${AIEA_PASSWORD:-}" ]]; then
    EMAIL="$AIEA_EMAIL"
    PASSWORD="$AIEA_PASSWORD"
    CRED_SOURCE="local-env"
    ok=$(curl -s -c "$jar" -o /tmp/aiea-doctor-ok.json -w '%{http_code}' --max-time 15 \
      -X POST "$BASE/api/auth/login" \
      -H 'content-type: application/json' \
      -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" || echo "000")
    echo "POST /api/auth/login (local-env) -> $ok"
    if [[ "$ok" != "200" ]]; then
      echo "FAIL: local login failed: $(cat /tmp/aiea-doctor-ok.json)"
      rm -f "$jar"
      exit 1
    fi
    AUTH_MODE="login-local-env"
  else
    EMAIL="verify+$(date -u +%Y%m%d%H%M%S)@aiea.test"
    PASSWORD="AiEaVerify1!"
    ok=$(curl -s -c "$jar" -o /tmp/aiea-doctor-ok.json -w '%{http_code}' --max-time 15 \
      -X POST "$BASE/api/auth/register" \
      -H 'content-type: application/json' \
      -d "{\"name\":\"Verify Bot\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" || echo "000")
    echo "POST /api/auth/register (disposable) -> $ok email=$EMAIL"
    if [[ "$ok" != "200" ]]; then
      echo "FAIL: register failed: $(cat /tmp/aiea-doctor-ok.json)"
      echo "HINT: local register failed; for live targets set AIEA_SMOKE_EMAIL + AIEA_SMOKE_PASSWORD (smoke user only)."
      rm -f "$jar"
      exit 1
    fi
    AUTH_MODE="register"
    CRED_SOURCE="register"
    export AIEA_EMAIL="$EMAIL"
    export AIEA_PASSWORD="$PASSWORD"
  fi
else
  CREDS_LINE="$(resolve_login_creds)"
  EMAIL="${CREDS_LINE%%|*}"
  REST="${CREDS_LINE#*|}"
  PASSWORD="${REST%%|*}"
  CRED_SOURCE="${REST##*|}"
  if [[ -z "$EMAIL" || -z "$PASSWORD" ]]; then
    echo "FAIL: live/shared base requires AIEA_SMOKE_EMAIL + AIEA_SMOKE_PASSWORD (both)."
    echo "HINT: Hong creates the smoke User row; verify does not register on live. Never use Will's personal login / 1Password."
    rm -f "$jar"
    exit 1
  fi
  ok=$(curl -s -c "$jar" -o /tmp/aiea-doctor-ok.json -w '%{http_code}' --max-time 15 \
    -X POST "$BASE/api/auth/login" \
    -H 'content-type: application/json' \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" || echo "000")
  echo "POST /api/auth/login (source=$CRED_SOURCE) -> $ok"
  if [[ "$ok" != "200" ]]; then
    echo "FAIL: login failed (source=$CRED_SOURCE): $(cat /tmp/aiea-doctor-ok.json)"
    echo "HINT: smoke user must already exist (Hong creates it). Set AIEA_SMOKE_EMAIL + AIEA_SMOKE_PASSWORD — never personal login / 1Password."
    rm -f "$jar"
    exit 1
  fi
  AUTH_MODE="login-$CRED_SOURCE"
fi

if ! grep -q aiea_session "$jar"; then
  echo "FAIL: no aiea_session cookie after auth"
  rm -f "$jar"
  exit 1
fi
# Netscape jar: domain, flag, path, secure, expiry, name, value
cookie_path=$(awk -F '\t' '$6 == "aiea_session" { print $3; exit }' "$jar")
echo "aiea_session path: ${cookie_path:-missing}"
if [[ "$cookie_path" != "/" ]]; then
  echo "FAIL: aiea_session must be Path=/ so every tab receives it (got '${cookie_path:-missing}')"
  rm -f "$jar"
  exit 1
fi
echo "auth_mode: $AUTH_MODE"

# Suite verifier. Local gate only: live smoke targets the deployed host, which
# does not have this route until the revision is released.
if is_local_base "$BASE"; then
  anon=$(curl -s -o /tmp/aiea-doctor-session-anon.json -w '%{http_code}' --max-time 10 \
    "$BASE/api/session" || echo "000")
  echo "GET /api/session (no cookie) -> $anon"
  if [[ "$anon" != "401" ]]; then
    echo "FAIL: /api/session without a cookie must be 401 JSON"
    rm -f "$jar"
    exit 1
  fi
  python3 - <<'PY'
import json
data = json.load(open("/tmp/aiea-doctor-session-anon.json"))
assert isinstance(data, dict) and data.get("error"), data
print("session_anon: 401 json")
PY
  secret=$(curl -s -o /tmp/aiea-doctor-session-secret.json -w '%{http_code}' --max-time 10 \
    -H 'Authorization: Bearer not-a-session' \
    "$BASE/api/session" || echo "000")
  echo "GET /api/session (integration-style bearer, no cookie) -> $secret"
  if [[ "$secret" != "401" ]]; then
    echo "FAIL: /api/session must ignore BF_INTEGRATION_SECRET and require aiea_session"
    rm -f "$jar"
    exit 1
  fi
else
  echo "note: GET /api/session checks run on the local gate (live host may not be this revision yet)"
fi

if [[ -n "$CRED_FILE" ]]; then
  python3 - <<PY
import json
json.dump({
  "email": "$EMAIL",
  "password": "$PASSWORD",
  "auth_mode": "$AUTH_MODE",
  "cred_source": "$CRED_SOURCE",
}, open("$CRED_FILE", "w"))
print("wrote credentials: $CRED_FILE")
PY
fi

# 4) Tasks board must not 500 (a pre-board live deploy still serves /today)
home_path=/tasks
home=$(curl -s -b "$jar" -o /tmp/aiea-doctor-home.html -w '%{http_code}' --max-time 20 \
  "$BASE/tasks" || echo "000")
if [[ "$home" == "404" ]]; then
  home_path=/today
  home=$(curl -s -b "$jar" -o /tmp/aiea-doctor-home.html -w '%{http_code}' --max-time 20 \
    "$BASE/today" || echo "000")
fi
echo "GET $home_path -> $home"
[[ "$home" == "200" ]] || { echo "FAIL: $home_path must be 200 (got $home)"; rm -f "$jar"; exit 1; }
if ! grep -qiE 'Capture|Tasks' /tmp/aiea-doctor-home.html; then
  echo "WARN: $home_path HTML missing expected Tasks chrome"
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

# 6) Standalone capture page redirects onto the Tasks board
cap=$(curl -s -b "$jar" -o /dev/null -w '%{http_code}' --max-time 15 \
  "$BASE/capture" || echo "000")
echo "GET /capture -> $cap"
[[ "$cap" == "308" ]] || { echo "FAIL: /capture must 308 to /tasks (got $cap)"; rm -f "$jar"; exit 1; }

# 7) Local: GET /api/session returns this user, then logout deletes that one row.
if is_local_base "$BASE"; then
  session=$(curl -s -b "$jar" -D /tmp/aiea-doctor-session.hdr -o /tmp/aiea-doctor-session.json -w '%{http_code}' --max-time 10 \
    "$BASE/api/session" || echo "000")
  echo "GET /api/session -> $session"
  if [[ "$session" != "200" ]]; then
    echo "FAIL: /api/session with aiea_session: $(cat /tmp/aiea-doctor-session.json)"
    rm -f "$jar"
    exit 1
  fi
  if ! grep -qi 'cache-control:.*no-store' /tmp/aiea-doctor-session.hdr; then
    echo "FAIL: /api/session must send Cache-Control: no-store"
    rm -f "$jar"
    exit 1
  fi
  python3 - <<PY
import json
data = json.load(open("/tmp/aiea-doctor-session.json"))
user = data.get("user") or {}
assert user.get("id"), data
assert user.get("email") == "$EMAIL", user
assert "name" in user, user
assert "passwordHash" not in user and "password" not in data, data
assert isinstance(data.get("expiresAt"), str) and "T" in data["expiresAt"], data
print("session_user:", user["id"], user["email"])
PY
  token=$(awk -F '\t' '$6 == "aiea_session" { print $7; exit }' "$jar")
  logout=$(curl -s -b "$jar" -c "$jar" -o /tmp/aiea-doctor-logout.json -w '%{http_code}' --max-time 10 \
    -X POST "$BASE/api/auth/logout" || echo "000")
  echo "POST /api/auth/logout -> $logout"
  if [[ "$logout" != "200" ]]; then
    echo "FAIL: logout: $(cat /tmp/aiea-doctor-logout.json)"
    rm -f "$jar"
    exit 1
  fi
  gone=$(curl -s -o /tmp/aiea-doctor-session-gone.json -w '%{http_code}' --max-time 10 \
    -H "Cookie: aiea_session=$token" \
    "$BASE/api/session" || echo "000")
  echo "GET /api/session (after logout, old cookie) -> $gone"
  if [[ "$gone" != "401" ]]; then
    echo "FAIL: sign-out must delete the session row (got $gone)"
    rm -f "$jar"
    exit 1
  fi
fi

rm -f "$jar"
echo "doctor ok (instance healthy)"
# Do not echo password. Smoke email is fine for evidence transcripts.
if [[ "$CRED_SOURCE" == "smoke" ]]; then
  echo "AIEA_SMOKE_EMAIL=$EMAIL"
elif [[ "$AUTH_MODE" == "register" ]]; then
  echo "disposable_email=$EMAIL"
else
  echo "login_email=$EMAIL"
fi
