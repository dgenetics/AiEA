#!/usr/bin/env bash
# Shared helpers for verify-aiea scripts.
set -euo pipefail

_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "$_LIB_DIR/.." && pwd)"
REPO_ROOT="$(cd "$_LIB_DIR/../../../.." && pwd)"
EVIDENCE_ROOT="$SKILL_DIR/evidence"

# Load .env without clobbering vars already set in the environment.
load_env() {
  local envfile="$REPO_ROOT/.env"
  [[ -f "$envfile" ]] || return 0
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      local key="${BASH_REMATCH[1]}"
      local val="${BASH_REMATCH[2]}"
      if [[ "$val" =~ ^\"(.*)\"$ ]]; then val="${BASH_REMATCH[1]}"; fi
      if [[ "$val" =~ ^\'(.*)\'$ ]]; then val="${BASH_REMATCH[1]}"; fi
      if [[ -z "${!key+x}" ]]; then
        export "$key=$val"
      fi
    fi
  done < "$envfile"
}

# Live production / preview base. Prefer AIEA_BASE_URL, then VERIFY_BASE_URL / SMOKE_BASE_URL.
default_live_base_url() {
  echo "${AIEA_BASE_URL:-${VERIFY_BASE_URL:-${SMOKE_BASE_URL:-https://aiea-cyan.vercel.app}}}"
}

default_base_url() {
  echo "${VERIFY_BASE_URL:-${SMOKE_BASE_URL:-${AIEA_BASE_URL:-http://127.0.0.1:3200}}}"
}

is_local_base() {
  local base="${1:-}"
  [[ "$base" =~ ^https?://(127\.0\.0\.1|localhost)(:|/|$) ]]
}

# Dedicated smoke login (both required). Never Will's personal / 1Password creds.
has_smoke_creds() {
  [[ -n "${AIEA_SMOKE_EMAIL:-}" && -n "${AIEA_SMOKE_PASSWORD:-}" ]]
}

# Prefer AIEA_SMOKE_*; demote legacy AIEA_EMAIL/AIEA_PASSWORD with a one-line warning.
# Prints: email|password|source  (source = smoke|legacy|empty)
# Does not invent credentials. Does not create the smoke user.
resolve_login_creds() {
  if has_smoke_creds; then
    printf '%s|%s|smoke\n' "$AIEA_SMOKE_EMAIL" "$AIEA_SMOKE_PASSWORD"
    return 0
  fi
  if [[ -n "${AIEA_EMAIL:-}" && -n "${AIEA_PASSWORD:-}" ]]; then
    echo "WARN: AIEA_EMAIL/AIEA_PASSWORD are demoted — migrate to AIEA_SMOKE_EMAIL/AIEA_SMOKE_PASSWORD (smoke user only; never personal login)" >&2
    printf '%s|%s|legacy\n' "$AIEA_EMAIL" "$AIEA_PASSWORD"
    return 0
  fi
  printf '||empty\n'
}

new_run_id() {
  local sha
  sha="$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo nogit)"
  echo "$(date -u +%Y%m%dT%H%M%SZ)-${sha}"
}

ensure_run_dir() {
  local run_id="$1"
  mkdir -p "$EVIDENCE_ROOT/$run_id"
  echo "$EVIDENCE_ROOT/$run_id"
}

# Local verify must never hit production Turso.
clear_turso_for_local() {
  unset TURSO_DATABASE_URL TURSO_AUTH_TOKEN || true
  export TURSO_DATABASE_URL=""
  export TURSO_AUTH_TOKEN=""
}
