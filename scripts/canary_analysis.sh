#!/usr/bin/env bash
#
# canary_analysis.sh — metric-driven canary gate.
#
# Runs during the canary phase (while ~AB_TRAFFIC_WEIGHT of live traffic is on
# the NEW Lambda version). It bakes for a short window, then compares the new
# version's CloudWatch error rate against a threshold. Exit 0 = healthy
# (promotion may proceed); non-zero = unhealthy (caller must roll back).
#
# This is deliberately conservative and self-contained: it reads real
# CloudWatch metrics rather than trusting the smoke test alone. It is the
# middle ground between "no analysis" and a full CodeDeploy canary; see the
# README Roadmap for the remaining gaps (multi-metric, longer bake, alarm
# integration).
#
# Required env:
#   FUNCTION_NAME   Lambda function name (e.g. TransactionSimulatorAPI)
#   NEW_VERSION     the numeric version receiving canary traffic
# Optional env:
#   BAKE_SECONDS          bake window before evaluating   (default 300)
#   ERROR_RATE_THRESHOLD  fail if errorRate exceeds this  (default 0.05 = 5%)
#   MIN_INVocations       below this, treat as inconclusive->pass (default 5)
set -euo pipefail

: "${FUNCTION_NAME:?FUNCTION_NAME is required}"
: "${NEW_VERSION:?NEW_VERSION is required}"
BAKE_SECONDS="${BAKE_SECONDS:-300}"
ERROR_RATE_THRESHOLD="${ERROR_RATE_THRESHOLD:-0.05}"
MIN_INVOCATIONS="${MIN_INVOCATIONS:-5}"

echo "Canary analysis: function=$FUNCTION_NAME version=$NEW_VERSION"
echo "Baking for ${BAKE_SECONDS}s before evaluating metrics..."
sleep "$BAKE_SECONDS"

START_TIME=$(date -u -d "@$(( $(date +%s) - BAKE_SECONDS - 60 ))" +%Y-%m-%dT%H:%M:%SZ)
END_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Per-version metrics: Lambda emits Errors/Invocations dimensioned by both
# FunctionName and ExecutedVersion, so we can isolate the canary version.
metric_sum() {
  local metric="$1"
  aws cloudwatch get-metric-statistics \
    --namespace AWS/Lambda \
    --metric-name "$metric" \
    --dimensions Name=FunctionName,Value="$FUNCTION_NAME" Name=ExecutedVersion,Value="$NEW_VERSION" \
    --start-time "$START_TIME" \
    --end-time "$END_TIME" \
    --period "$(( BAKE_SECONDS + 120 ))" \
    --statistics Sum \
    --query 'Datapoints[].Sum' \
    --output text 2>/dev/null | tr '\t' '\n' | awk '{s+=$1} END {printf "%d", s+0}'
}

INVOCATIONS=$(metric_sum Invocations)
ERRORS=$(metric_sum Errors)

echo "Observed over bake window: invocations=$INVOCATIONS errors=$ERRORS"

if [ "$INVOCATIONS" -lt "$MIN_INVOCATIONS" ]; then
  echo "Too few invocations ($INVOCATIONS < $MIN_INVOCATIONS) to judge — treating as inconclusive PASS."
  echo "Consider a longer bake window or generating synthetic canary traffic for a firmer signal."
  exit 0
fi

# errorRate = errors / invocations, compared with awk (bash has no floats).
BREACH=$(awk -v e="$ERRORS" -v n="$INVOCATIONS" -v t="$ERROR_RATE_THRESHOLD" \
  'BEGIN { rate = (n>0)? e/n : 0; printf "%.4f %d", rate, (rate > t ? 1 : 0) }')
ERROR_RATE=$(echo "$BREACH" | awk '{print $1}')
IS_BREACH=$(echo "$BREACH" | awk '{print $2}')

echo "Canary error rate: $ERROR_RATE (threshold $ERROR_RATE_THRESHOLD)"

if [ "$IS_BREACH" -eq 1 ]; then
  echo "CANARY UNHEALTHY: error rate $ERROR_RATE exceeds threshold $ERROR_RATE_THRESHOLD." >&2
  exit 1
fi

echo "CANARY HEALTHY: within threshold. Promotion may proceed."
exit 0
