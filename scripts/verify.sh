#!/usr/bin/env bash
#
# CoachLoop machine check — the gate for "done" (see RUBRIC.md).
# Runs typecheck + lint + the scoring fixture test + a curl of the live URL.
# Exits NON-ZERO if any stage fails. Stages run independently so you see the
# full picture in one pass, not just the first failure.
#
# Usage:   VERIFY_URL=https://your-app.vercel.app bash scripts/verify.sh
#
set -uo pipefail
cd "$(dirname "$0")/.." || exit 2

PASS=0
FAIL=0
RESULTS=()

run () {
  local name="$1"; shift
  echo "▶ ${name}"
  if "$@"; then
    echo "  ✓ ${name}"
    RESULTS+=("PASS  ${name}")
    PASS=$((PASS + 1))
  else
    local code=$?
    echo "  ✗ ${name} (exit ${code})"
    RESULTS+=("FAIL  ${name}")
    FAIL=$((FAIL + 1))
  fi
  echo
}

fail_stage () {
  local name="$1"; local msg="$2"
  echo "▶ ${name}"
  echo "  ✗ ${name} — ${msg}"
  RESULTS+=("FAIL  ${name} (${msg})")
  FAIL=$((FAIL + 1))
  echo
}

# 1. Types — requires deps installed (npm install)
run "typecheck" npm run --silent typecheck

# 2. Lint — requires deps installed
run "lint" npm run --silent lint

# 3. Fixture tests — zero-dep, runnable any time (Node built-in runner).
#    Runs the scoring grader AND the Batch-2 feature assertions (test/*.test.mjs).
run "test (scoring + feature gates)" node --test test/scorer.test.mjs test/features.test.mjs

# 3b. Responsive shell (Feature 0, F0-2) — structural grep, no browser needed.
#     app-nav must carry both a mobile branch and a desktop (lg:) branch; the
#     layout shell must no longer be hard-locked to a phone width.
responsive_check () {
  grep -q "lg:" src/components/app-nav.tsx \
    && grep -Eq "bottom|fixed" src/components/app-nav.tsx \
    && ! grep -q 'max-w-md"' src/app/layout.tsx
}
run "responsive (F0-2)" responsive_check

# 3c. Write model unchanged (meta-invariant, F0-M) — the Evaluation write model
#     and the pure grader must be byte-for-byte the pre-batch versions. Pinned by
#     git blob hash so it holds before AND after commit (not just vs working tree).
write_model_unchanged () {
  local coaching="77e53a8787c9f4d884fef88ec71fbdab7a7258f3"
  local grade="9e80899b23caf9a54298234e1a2f043bc23c6c60"
  [ "$(git hash-object src/domain/coaching.ts)" = "${coaching}" ] \
    && [ "$(git hash-object lib/scoring/grade.mjs)" = "${grade}" ]
}
run "write-model-unchanged (F0-M)" write_model_unchanged

# 4. Live URL responds
URL="${VERIFY_URL:-}"
if [ -z "${URL}" ]; then
  fail_stage "live url" "VERIFY_URL is not set — point it at the deployed URL"
else
  run "live url (${URL})" curl -fsS -o /dev/null --max-time 15 "${URL}"
fi

echo "──────────── summary ────────────"
for r in "${RESULTS[@]}"; do echo "  ${r}"; done
echo "  ${PASS} passed, ${FAIL} failed"
echo "─────────────────────────────────"

[ "${FAIL}" -eq 0 ]
