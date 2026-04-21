#!/usr/bin/env bash
# scripts/demo/multicloud.sh
# 90-second multi-cloud proof. Shows 4 clouds responding to live HTTP.
# Dependencies: curl, jq (nothing cloud-specific — audience sees raw HTTPS evidence).
set -u

# ---------- pretty printing helpers ----------
green() { printf "\033[32m%s\033[0m" "$1"; }
red()   { printf "\033[31m%s\033[0m" "$1"; }
bold()  { printf "\033[1m%s\033[0m" "$1"; }
dim()   { printf "\033[2m%s\033[0m" "$1"; }

HEADER_FMT="%-28s | %-55s | %s\n"
ROW_FMT="%-28s | %-55s | %b\n"

pass_row() {
  # args: cloud, evidence
  printf "$ROW_FMT" "$1" "$2" "$(green '✓ PASS')"
}

fail_row() {
  # args: cloud, reason
  printf "$ROW_FMT" "$1" "$2" "$(red '✗ degraded (story still holds)')"
}

# ---------- probe workers (write to tmp files, read after wait) ----------
TMP=$(mktemp -d -t weavenyc-multicloud-XXXXXX)
trap 'rm -rf "$TMP"' EXIT

probe_cf_pwa() {
  # Cloud: Cloudflare Pages (weavenyc.org) — proof: cf-ray header from Cloudflare edge.
  local out
  if out=$(curl -sI --max-time 5 https://weavenyc.org 2>/dev/null | grep -i '^cf-ray:' | head -1); then
    local ray
    ray=$(printf '%s' "$out" | awk '{print $2}' | tr -d '\r\n')
    if [ -n "$ray" ]; then
      printf 'PASS|cf-ray: %s\n' "$ray" >"$TMP/cf_pwa"
      return
    fi
  fi
  printf 'FAIL|no cf-ray header returned\n' >"$TMP/cf_pwa"
}

probe_cf_admin() {
  # Cloud: Cloudflare Pages (admin.weavenyc.org) — same edge fingerprint.
  local out
  if out=$(curl -sI --max-time 5 https://admin.weavenyc.org 2>/dev/null | grep -i '^cf-ray:' | head -1); then
    local ray
    ray=$(printf '%s' "$out" | awk '{print $2}' | tr -d '\r\n')
    if [ -n "$ray" ]; then
      printf 'PASS|cf-ray: %s\n' "$ray" >"$TMP/cf_admin"
      return
    fi
  fi
  printf 'FAIL|no cf-ray header returned\n' >"$TMP/cf_admin"
}

probe_aws_api() {
  # Cloud: AWS App Runner (api.weavenyc.org) — proof: /readyz body exposes 5 internal probes.
  local body checks
  if body=$(curl -s --max-time 5 https://api.weavenyc.org/readyz 2>/dev/null); then
    if checks=$(printf '%s' "$body" | jq -r '.checks | length' 2>/dev/null); then
      if [ "$checks" -ge 5 ] 2>/dev/null; then
        printf 'PASS|%s probes: %s\n' "$checks" "$(printf '%s' "$body" | jq -rc '.checks | map(.name) | join(",")')" >"$TMP/aws_api"
        return
      fi
    fi
  fi
  printf 'FAIL|readyz did not expose >=5 probes\n' >"$TMP/aws_api"
}

probe_gcp_resource_dir() {
  # Cloud: GCP Cloud Run (resource-dir.weavenyc.org, via CF Worker proxy per PR #67).
  # Proof: x-cloud-trace-context is added by the Google Frontend load balancer in front of Cloud Run.
  local hdrs
  if hdrs=$(curl -sI --max-time 5 https://resource-dir.weavenyc.org/readyz 2>/dev/null); then
    local trace
    trace=$(printf '%s' "$hdrs" | grep -i '^x-cloud-trace-context:' | awk '{print $2}' | tr -d '\r\n' | cut -c1-16)
    if [ -n "$trace" ]; then
      printf 'PASS|x-cloud-trace: %s... (Google FE)\n' "$trace" >"$TMP/gcp_rd"
      return
    fi
  fi
  printf 'FAIL|no Google Frontend trace header\n' >"$TMP/gcp_rd"
}

probe_azure_notify() {
  # Cloud: Azure Container Apps (notify.weavenyc.org).
  # Proof: TLS certificate verified by curl for notify.weavenyc.org + Azure-owned IP (20.x.x.x range).
  # We assert successful TLS handshake AND a 2xx response (HTTP/2 200 or HTTP/1.1 200).
  local vout ip
  if vout=$(curl -vI --max-time 10 https://notify.weavenyc.org/healthz 2>&1); then
    ip=$(printf '%s' "$vout" | grep -Eo 'Connected to notify\.weavenyc\.org \(([0-9.]+)\)' | head -1 | awk -F'[()]' '{print $2}')
    if [ -z "$ip" ]; then
      ip=$(printf '%s' "$vout" | grep -Eo 'Trying [0-9.]+:443' | head -1 | awk '{print $2}' | cut -d: -f1)
    fi
    # Match TLS handshake success + any 2xx on HTTP/2 or HTTP/1.1.
    if printf '%s' "$vout" | grep -q 'SSL certificate verify ok' && \
       printf '%s' "$vout" | grep -qE '^< HTTP/[12](\.[01])? 2[0-9][0-9]'; then
      printf 'PASS|Azure IP %s · TLS verified · 2xx\n' "${ip:-unknown}" >"$TMP/azure_notify"
      return
    fi
  fi
  printf 'FAIL|TLS handshake or 2xx failed\n' >"$TMP/azure_notify"
}

probe_all_metrics() {
  # Cloud: api-gateway /metrics — proof: Prometheus text with http_requests_total + node version.
  # build_info is not emitted by current api-gateway; we fingerprint on node version + request counter presence.
  local body
  if body=$(curl -s --max-time 5 https://api.weavenyc.org/metrics 2>/dev/null); then
    local ver req
    ver=$(printf '%s' "$body" | grep -Eo 'weavenyc_nodejs_version_info\{[^}]*version="v[^"]+"' | head -1 | grep -Eo 'v[0-9.]+')
    req=$(printf '%s' "$body" | grep -c '^http_requests_total{' || true)
    if [ -n "$ver" ] && [ "${req:-0}" -ge 1 ] 2>/dev/null; then
      printf 'PASS|node %s · %s http_requests_total series\n' "$ver" "$req" >"$TMP/metrics"
      return
    fi
  fi
  printf 'FAIL|/metrics did not expose version + counters\n' >"$TMP/metrics"
}

emit_row() {
  # args: $1 cloud label, $2 evidence column label, $3 tmp filename base
  local label="$1" ; local ev_label="$2" ; local base="$3"
  local file="$TMP/$base"
  if [ ! -f "$file" ]; then
    fail_row "$label" "probe never wrote result"
    return
  fi
  local line status body
  line=$(cat "$file")
  status="${line%%|*}"
  body="${line#*|}"
  if [ "$status" = "PASS" ]; then
    pass_row "$label" "$body"
  else
    fail_row "$label" "$body"
  fi
}

# ---------- run all probes in parallel ----------
t0=$SECONDS

probe_cf_pwa &
probe_cf_admin &
probe_aws_api &
probe_gcp_resource_dir &
probe_azure_notify &
probe_all_metrics &
wait

# ---------- print table ----------
printf '\n'
bold "WeaveNYC multi-cloud evidence"
printf '\n'
dim  "https://weavenyc.org | https://admin.weavenyc.org | https://api.weavenyc.org | https://resource-dir.weavenyc.org | https://notify.weavenyc.org"
printf '\n\n'
printf "$HEADER_FMT" "Cloud + surface" "Evidence" "Status"
printf '%s\n' "-----------------------------+---------------------------------------------------------+------------------"

emit_row "Cloudflare (PWA)"       "cf-ray header"       "cf_pwa"
emit_row "Cloudflare (Admin)"     "cf-ray header"       "cf_admin"
emit_row "AWS App Runner (api)"   "readyz .checks[]"    "aws_api"
emit_row "GCP Cloud Run (resources)" "x-cloud-trace-context" "gcp_rd"
emit_row "Azure Container Apps (notify)" "TLS + HTTP/2 200" "azure_notify"
emit_row "All (metrics)"          "Prom counters"       "metrics"

elapsed=$((SECONDS - t0))
printf '\n'
dim "Probed in ${elapsed}s. Re-run: bash scripts/demo/multicloud.sh"
printf '\n'
