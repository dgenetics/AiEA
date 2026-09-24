#!/usr/bin/env bash
# Full verification gate: optional launch → doctor → drive one or more features → evidence.
# Does not delete evidence. Cleanup of local server is caller's job (or --cleanup / --local).
#
# Usage:
#   VERIFY_BASE_URL=https://aiea-cyan.vercel.app gate.sh --feature capture-accept
#   gate.sh --local --feature capture-accept
#   gate.sh --local --feature capture-accept,today-load,board-lanes,bf-sync
#
# Env: AIEA_EMAIL / AIEA_PASSWORD (optional locally — doctor registers),
#      VERIFY_BASE_URL / SMOKE_BASE_URL,
#      BF_MAINTENANCE_URL / BF_INTEGRATION_SECRET (bf-sync; skip if missing),
#      VERIFY_FEATURE or VERIFY_FEATURES.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib.sh"
load_env

LOCAL=0
CLEANUP=0
PORT=3200
FEATURES_RAW=()
if [[ -n "${VERIFY_FEATURES:-}" ]]; then
  FEATURES_RAW+=("$VERIFY_FEATURES")
elif [[ -n "${VERIFY_FEATURE:-}" ]]; then
  FEATURES_RAW+=("$VERIFY_FEATURE")
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --local) LOCAL=1; CLEANUP=1; shift ;;
    --cleanup) CLEANUP=1; shift ;;
    --feature)
      if [[ -z "${2:-}" ]]; then
        echo "--feature requires a value" >&2
        exit 2
      fi
      FEATURES_RAW+=("$2")
      shift 2
      ;;
    --port) PORT="$2"; shift 2 ;;
    --base-url) VERIFY_BASE_URL="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

FEATURES=()
declare -A SEEN=()
if [[ ${#FEATURES_RAW[@]} -eq 0 ]]; then
  FEATURES=("capture-accept")
else
  for raw in "${FEATURES_RAW[@]}"; do
    IFS=',' read -ra PARTS <<< "$raw"
    for part in "${PARTS[@]}"; do
      feat="$(echo "$part" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
      [[ -z "$feat" ]] && continue
      if [[ -n "${SEEN[$feat]:-}" ]]; then
        continue
      fi
      SEEN[$feat]=1
      FEATURES+=("$feat")
    done
  done
fi
if [[ ${#FEATURES[@]} -eq 0 ]]; then
  echo "no features selected" >&2
  exit 2
fi

FEATURES_CSV=$(IFS=,; echo "${FEATURES[*]}")

RUN_ID="$(new_run_id)"
OUT="$(ensure_run_dir "$RUN_ID")"
export VERIFY_RUN_ID="$RUN_ID"
SHA=$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || echo unknown)

{
  echo "# verify-aiea $RUN_ID"
  echo "- sha: \`$SHA\`"
  echo "- started: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "- features: \`$FEATURES_CSV\`"
} > "$OUT/SUMMARY.md"

BASE="${VERIFY_BASE_URL:-${SMOKE_BASE_URL:-}}"
if [[ "$LOCAL" == "1" ]]; then
  set +e
  LAUNCH_OUT=$("$SCRIPT_DIR/launch.sh" "$PORT" "$RUN_ID" 2>"$OUT/launch.txt")
  LC=$?
  set -e
  echo "- launch exit: $LC" >> "$OUT/SUMMARY.md"
  if [[ $LC -ne 0 ]]; then
    echo "- result: **FAIL** launch" >> "$OUT/SUMMARY.md"
    cat "$OUT/launch.txt" >&2 || true
    exit $LC
  fi
  BASE="http://127.0.0.1:${PORT}"
fi
BASE="${BASE:-http://127.0.0.1:3200}"
echo "- base: $BASE" >> "$OUT/SUMMARY.md"

if [[ ! -d "$SCRIPT_DIR/node_modules/playwright-core" ]]; then
  (cd "$SCRIPT_DIR" && npm install --silent)
fi

set +e
VERIFY_BASE_URL="$BASE" VERIFY_RUN_ID="$RUN_ID" "$SCRIPT_DIR/doctor.sh" "$BASE" >"$OUT/doctor.txt" 2>&1
DOC=$?
set -e
echo "- doctor exit: $DOC" >> "$OUT/SUMMARY.md"
if [[ $DOC -ne 0 ]]; then
  echo "- result: **FAIL** doctor" >> "$OUT/SUMMARY.md"
  echo "doctor failed; see $OUT/doctor.txt" >&2
  [[ "$CLEANUP" == "1" ]] && "$SCRIPT_DIR/cleanup.sh" "$RUN_ID" || true
  exit $DOC
fi

# Pick up disposable creds doctor may have written
if [[ -f "$OUT/verify-user.json" ]]; then
  eval "$(python3 - <<PY
import json
d=json.load(open("$OUT/verify-user.json"))
print(f'export AIEA_EMAIL={d["email"]!r}')
print(f'export AIEA_PASSWORD={d["password"]!r}')
PY
)"
fi

FAILED=0
: > "$OUT/drive.txt"
for FEATURE in "${FEATURES[@]}"; do
  echo "=== drive $FEATURE ===" >> "$OUT/drive.txt"
  set +e
  AIEA_EMAIL="${AIEA_EMAIL:-}" AIEA_PASSWORD="${AIEA_PASSWORD:-}" \
    node "$SCRIPT_DIR/drive.mjs" --feature "$FEATURE" --base-url "$BASE" --run-id "$RUN_ID" \
    >>"$OUT/drive.txt" 2>&1
  DRV=$?
  set -e
  echo "- drive ($FEATURE) exit: $DRV" >> "$OUT/SUMMARY.md"
  if [[ $DRV -ne 0 ]]; then
    FAILED=$DRV
    echo "- result: **FAIL** drive ($FEATURE)" >> "$OUT/SUMMARY.md"
    echo "drive failed on feature=$FEATURE; see $OUT/drive.txt" >&2
    break
  fi
  if [[ -f "$OUT/drive-$FEATURE.json" ]]; then
    echo "- drive ($FEATURE) steps:" >> "$OUT/SUMMARY.md"
    python3 - <<PY >> "$OUT/SUMMARY.md"
import json
d=json.load(open("$OUT/drive-$FEATURE.json"))
status=d.get("status","pass")
if status == "skipped":
    print(f"  - SKIPPED: {d.get('skipReason','')}")
for s in d.get("steps", []):
    print(f"  - {s}")
PY
  fi
done

if [[ "$FAILED" -ne 0 ]]; then
  [[ "$CLEANUP" == "1" ]] && "$SCRIPT_DIR/cleanup.sh" "$RUN_ID" || true
  exit "$FAILED"
fi

echo "- result: **PASS**" >> "$OUT/SUMMARY.md"
echo "- finished: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$OUT/SUMMARY.md"
echo "- evidence: \`$OUT\`" >> "$OUT/SUMMARY.md"

if [[ "$CLEANUP" == "1" ]]; then
  "$SCRIPT_DIR/cleanup.sh" "$RUN_ID"
  echo "- cleanup: ran (evidence retained)" >> "$OUT/SUMMARY.md"
fi

echo "PASS features=$FEATURES_CSV evidence=$OUT"
