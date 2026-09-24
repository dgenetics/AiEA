#!/usr/bin/env bash
# Tear down agent-started instances. Never deletes evidence/.
# Usage: cleanup.sh [run-id]
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib.sh"

stop_pidfile() {
  local pidfile="$1"
  [[ -f "$pidfile" ]] || return 0
  local pid
  pid=$(cat "$pidfile" || true)
  local rundir
  rundir="$(dirname "$pidfile")"
  if [[ -n "${pid:-}" ]]; then
    # Kill process group started via setsid (negative PGID), then the pid.
    kill -- "-$pid" 2>/dev/null || true
    kill "$pid" 2>/dev/null || true
    sleep 0.5
    kill -9 -- "-$pid" 2>/dev/null || true
    kill -9 "$pid" 2>/dev/null || true
  fi
  # Fallback: anything still bound to the recorded URL port
  local urlf="$rundir/server.url"
  if [[ -f "$urlf" ]]; then
    local port
    port=$(sed -n 's/.*:\([0-9][0-9]*\)$/\1/p' "$urlf")
    if [[ -n "${port:-}" ]]; then
      local extras
      extras=$(ss -tlnp 2>/dev/null | sed -n "s/.*:${port} .*pid=\\([0-9][0-9]*\\).*/\\1/p" | sort -u)
      if [[ -z "${extras:-}" ]]; then
        extras=$(fuser "${port}/tcp" 2>/dev/null || true)
      fi
      if [[ -n "${extras:-}" ]]; then
        # shellcheck disable=SC2086
        kill $extras 2>/dev/null || true
        sleep 0.3
        # shellcheck disable=SC2086
        kill -9 $extras 2>/dev/null || true
        echo "stopped listeners on :$port ($extras)"
      fi
    fi
  fi
  echo "stopped pid/pgid ${pid:-none} ($pidfile)"
  rm -f "$pidfile"
}

RUN_ID="${1:-}"
if [[ -z "$RUN_ID" && -f "$EVIDENCE_ROOT/.last-run-id" ]]; then
  RUN_ID=$(cat "$EVIDENCE_ROOT/.last-run-id")
fi

if [[ -n "$RUN_ID" ]]; then
  stop_pidfile "$EVIDENCE_ROOT/$RUN_ID/server.pid"
else
  shopt -s nullglob
  for f in "$EVIDENCE_ROOT"/*/server.pid; do
    stop_pidfile "$f"
  done
fi
echo "cleanup done (evidence retained under $EVIDENCE_ROOT)"
