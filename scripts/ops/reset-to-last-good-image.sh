#!/usr/bin/env bash
#
# reset-to-last-good-image.sh — pin weavenyc-api-gateway (AWS App Runner)
# to a known-good ECR image tag.
#
# A8 P0-4: docs/29_M8_Pilot_Readiness.md §3.4 described the rollback
# steps inline but had no scriptified form. This script codifies that
# SOP so on-call can run one command with minimal cognitive load during
# an incident.
#
# Usage:
#   scripts/ops/reset-to-last-good-image.sh <sha-or-tag>
#   # examples:
#   scripts/ops/reset-to-last-good-image.sh v0.1.3
#   scripts/ops/reset-to-last-good-image.sh weavenyc-api-gateway-abc123def456
#   scripts/ops/reset-to-last-good-image.sh abc123def456
#
# Behaviour:
#   * Locates the weavenyc-api-gateway service ARN in the current
#     AWS_REGION (default us-east-1).
#   * Accepts either a bare tag, a SHA prefix, or a full
#     `<repo>-<sha>` identifier. If the input does not already look
#     like a fully-qualified ECR URL, the script resolves it against
#     the weavenyc-api-gateway ECR repository.
#   * Pulls the live SourceConfiguration, splices in the new
#     ImageIdentifier, and calls `aws apprunner update-service`.
#   * Polls describe-service until Status is RUNNING (or fails after
#     10 minutes).
#   * Runs a final check to confirm the serving image matches the
#     requested tag.
#
# Safety:
#   * Prompts once for confirmation unless WEAVENYC_NO_CONFIRM=1 is
#     set. During an active incident, an operator can skip the prompt
#     by exporting WEAVENYC_NO_CONFIRM=1 ahead of time.
#   * Never modifies the underlying env vars / secrets — only swaps
#     ImageIdentifier. Env var edits go via update-secret + redeploy,
#     not through this script.
#
# Exits non-zero on any failure.
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
APPRUNNER_SERVICE_NAME="${APPRUNNER_SERVICE_NAME:-weavenyc-api-gateway}"
ECR_REPOSITORY="${ECR_REPOSITORY:-weavenyc-api-gateway}"
POLL_MAX_ATTEMPTS="${POLL_MAX_ATTEMPTS:-30}"
POLL_SLEEP_SECONDS="${POLL_SLEEP_SECONDS:-20}"

usage() {
  cat >&2 <<EOF
Usage: $0 <sha-or-tag>

  <sha-or-tag>    A known-good image reference. Accepts:
                    * a short SHA (e.g. abc123def456)
                    * the full image name (e.g. weavenyc-api-gateway-abc123def456)
                    * an explicit tag already in ECR (e.g. v0.1.3)
                    * a fully-qualified ECR URL (passed through verbatim)

Environment overrides (optional):
  AWS_REGION                default us-east-1
  APPRUNNER_SERVICE_NAME    default weavenyc-api-gateway
  ECR_REPOSITORY            default weavenyc-api-gateway
  WEAVENYC_NO_CONFIRM=1     skip the confirmation prompt
EOF
  exit 2
}

if [[ $# -ne 1 ]]; then
  usage
fi

INPUT="$1"

for bin in aws jq; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "::error::$bin not found in PATH. Install the AWS CLI v2 and jq before running this script." >&2
    exit 1
  fi
done

echo "[reset] resolving App Runner service ARN for ${APPRUNNER_SERVICE_NAME} in ${AWS_REGION}..."
SERVICE_ARN=$(aws apprunner list-services \
  --region "$AWS_REGION" \
  --query "ServiceSummaryList[?ServiceName=='${APPRUNNER_SERVICE_NAME}'].ServiceArn" \
  --output text)

if [[ -z "$SERVICE_ARN" || "$SERVICE_ARN" == "None" ]]; then
  echo "::error::App Runner service ${APPRUNNER_SERVICE_NAME} not found in region ${AWS_REGION}." >&2
  exit 1
fi
echo "[reset] service ARN: ${SERVICE_ARN}"

# Resolve AWS account id / ECR registry so we can build fully-qualified URIs.
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGISTRY="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

resolve_full_image() {
  local raw="$1"
  if [[ "$raw" == *"/"* && "$raw" == *":"* ]]; then
    # already fully-qualified
    echo "$raw"
    return 0
  fi
  local tag="$raw"
  # strip any leading "weavenyc-api-gateway-" that matches the ECR repo name
  # — callers sometimes pass the full image name from describe-services.
  if [[ "$tag" == "${ECR_REPOSITORY}-"* ]]; then
    tag="${tag#${ECR_REPOSITORY}-}"
  fi
  echo "${REGISTRY}/${ECR_REPOSITORY}:${tag}"
}

FULL_IMAGE="$(resolve_full_image "$INPUT")"
echo "[reset] target image: ${FULL_IMAGE}"

# Verify the tag exists in ECR before we try to deploy it — catches typos.
IMAGE_TAG="${FULL_IMAGE##*:}"
if ! aws ecr describe-images \
  --repository-name "$ECR_REPOSITORY" \
  --region "$AWS_REGION" \
  --image-ids "imageTag=${IMAGE_TAG}" \
  --output text >/dev/null 2>&1; then
  echo "::error::ECR tag '${IMAGE_TAG}' not found in repository '${ECR_REPOSITORY}' (region ${AWS_REGION}). Aborting before touching the service." >&2
  exit 1
fi
echo "[reset] confirmed tag '${IMAGE_TAG}' exists in ECR."

if [[ "${WEAVENYC_NO_CONFIRM:-0}" != "1" ]]; then
  echo
  echo "About to pin ${APPRUNNER_SERVICE_NAME} to:"
  echo "    ${FULL_IMAGE}"
  echo "This triggers an immediate App Runner redeploy. Proceed? [y/N]"
  read -r answer
  if [[ "$answer" != "y" && "$answer" != "Y" ]]; then
    echo "[reset] aborted by operator."
    exit 1
  fi
fi

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

echo "[reset] fetching current SourceConfiguration..."
aws apprunner describe-service \
  --service-arn "$SERVICE_ARN" \
  --region "$AWS_REGION" \
  --query 'Service.SourceConfiguration' > "${TMPDIR}/source.json"

jq --arg tag "$FULL_IMAGE" \
  '.ImageRepository.ImageIdentifier = $tag' \
  "${TMPDIR}/source.json" > "${TMPDIR}/source-updated.json"

echo "[reset] issuing update-service..."
aws apprunner update-service \
  --service-arn "$SERVICE_ARN" \
  --region "$AWS_REGION" \
  --source-configuration "file://${TMPDIR}/source-updated.json" \
  --query 'Service.Status' --output text >/dev/null

echo "[reset] polling until service is RUNNING..."
for ((i = 1; i <= POLL_MAX_ATTEMPTS; i++)); do
  STATUS=$(aws apprunner describe-service \
    --service-arn "$SERVICE_ARN" \
    --region "$AWS_REGION" \
    --query 'Service.Status' --output text)
  echo "[reset] [$i/${POLL_MAX_ATTEMPTS}] status=${STATUS}"
  case "$STATUS" in
    RUNNING) break ;;
    CREATE_FAILED|DELETE_FAILED|PAUSED)
      echo "::error::App Runner service is in ${STATUS}; manual intervention required." >&2
      exit 1
      ;;
  esac
  sleep "$POLL_SLEEP_SECONDS"
done

if [[ "$STATUS" != "RUNNING" ]]; then
  echo "::error::timed out waiting for App Runner to reach RUNNING (last status: ${STATUS})." >&2
  exit 1
fi

echo "[reset] verifying ImageIdentifier..."
ACTUAL=$(aws apprunner describe-service \
  --service-arn "$SERVICE_ARN" \
  --region "$AWS_REGION" \
  --query 'Service.SourceConfiguration.ImageRepository.ImageIdentifier' \
  --output text)
echo "[reset] live ImageIdentifier: ${ACTUAL}"
if [[ "$ACTUAL" != "$FULL_IMAGE" ]]; then
  echo "::error::ImageIdentifier did not update as expected. Expected ${FULL_IMAGE}, got ${ACTUAL}." >&2
  exit 1
fi

echo
echo "[reset] DONE — ${APPRUNNER_SERVICE_NAME} is pinned to ${FULL_IMAGE}."
echo "[reset] run 'curl https://api.weavenyc.org/readyz | jq .checks' to confirm post-rollback readiness."
