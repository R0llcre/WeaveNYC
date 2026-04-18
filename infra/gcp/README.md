# infra/gcp — WeaveNYC Pilot Google Cloud deployment

This directory documents the Google Cloud resources that host the
`services/resource-directory` microservice behind `resources.weavenyc.org`
for the M8 pilot.

Supersedes nothing — this is the canonical W4B-GCP reference. Companion
docs: [`docs/19_Deployment_Guide.md`](../../docs/19_Deployment_Guide.md)
(environment matrix) and [`docs/11_Ops_Runbook.md`](../../docs/11_Ops_Runbook.md)
(incident response).

---

## 1. Resource inventory

| Kind                        | Name                                  | Region   | Purpose                                               |
|-----------------------------|---------------------------------------|----------|-------------------------------------------------------|
| Project                     | `weavenyc-pilot`                      | global   | Billing boundary for all pilot GCP resources.         |
| Artifact Registry (docker)  | `weavenyc`                            | us-east1 | Holds `resource-directory:<tag>` images.              |
| Cloud Run service           | `resource-directory`                  | us-east1 | Public HTTPS endpoint, backs `resources.weavenyc.org`.|
| Secret Manager secret       | `weavenyc-database-url`               | global   | RDS connection URL. Managed jointly with W4B-AWS.     |
| Secret Manager secret       | `weavenyc-internal-service-jwt-secret`| global   | HS256 secret shared with api-gateway for service JWT. |
| IAM Workload Identity Pool  | `github`                              | global   | Trusts GitHub Actions OIDC tokens.                    |
| IAM Workload Identity Provider | `github` (inside pool `github`)    | global   | Maps repo `R0llcre/WeaveNYC` → Google identity.       |
| Service account             | `github-deploy@…`                     | global   | Used by `deploy-resources.yml` to push + deploy.      |
| DNS record (Cloudflare)     | `resources.weavenyc.org`              | n/a      | CNAME to the Cloud Run URL (see §6).                  |

Region choice (`us-east1`) matches the AWS RDS region so RDS → Cloud Run
round-trip latency is single-digit ms across the public network.

---

## 2. One-time bootstrap (already partially run)

Current run log is captured in commits on `feature/m7-closeout-m8-pilot-readiness`.

### 2.1 Create the project

```bash
gcloud projects create weavenyc-pilot \
  --name="WeaveNYC Pilot" \
  --labels=course=spring26,env=pilot
```

> Status (2026-04-16): project is created but **billing is not yet linked**.
> All API enables and deploys below will fail with
> `FAILED_PRECONDITION: Billing account … is not found` until the owner
> attaches a billing account at
> <https://console.cloud.google.com/billing/linkedaccount?project=weavenyc-pilot>.

### 2.2 Enable required APIs

```bash
gcloud config set project weavenyc-pilot
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com
```

### 2.3 Create the Artifact Registry docker repo

```bash
gcloud artifacts repositories create weavenyc \
  --repository-format=docker \
  --location=us-east1 \
  --description="WeaveNYC pilot container images"
```

### 2.4 Create secrets (values sourced from W4B-AWS)

```bash
# Reuse the RDS URL the AWS stack publishes.
printf '%s' "$DATABASE_URL_FROM_AWS" \
  | gcloud secrets create weavenyc-database-url --data-file=-

# Reuse the HS256 secret api-gateway is configured with so internal JWTs
# minted by api-gateway validate on resource-directory too.
printf '%s' "$INTERNAL_SERVICE_JWT_SECRET_FROM_AWS" \
  | gcloud secrets create weavenyc-internal-service-jwt-secret --data-file=-
```

If the AWS stack hasn't run yet, bootstrap with placeholders so Cloud Run
can deploy (it will fail `/readyz` until the real values are swapped in):

```bash
printf 'postgres://TODO:TODO@TODO:5432/weavenyc?sslmode=require' \
  | gcloud secrets create weavenyc-database-url --data-file=-
printf 'TODO-hs256-secret-min-32-chars-long-xxxxx' \
  | gcloud secrets create weavenyc-internal-service-jwt-secret --data-file=-
```

To rotate later:

```bash
printf '%s' "$NEW_VALUE" \
  | gcloud secrets versions add weavenyc-database-url --data-file=-
```

Cloud Run resolves `:latest` on every new revision, so a rotation requires
triggering a new revision (redeploy or `gcloud run services update`).

### 2.5 Workload Identity Federation for GitHub Actions

Run once per project. Replace `<REPO>` with `R0llcre/WeaveNYC`.

```bash
PROJECT_ID=weavenyc-pilot
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
REPO=R0llcre/WeaveNYC

# Service account Cloud Run will run as, and that GH Actions impersonates.
gcloud iam service-accounts create github-deploy \
  --display-name="GitHub Actions deploy" \
  --project="$PROJECT_ID"

SA_EMAIL="github-deploy@${PROJECT_ID}.iam.gserviceaccount.com"

# Roles the deploy job needs.
for role in \
    roles/run.admin \
    roles/artifactregistry.writer \
    roles/secretmanager.secretAccessor \
    roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$role"
done

# Workload Identity Pool + provider.
gcloud iam workload-identity-pools create github \
  --location=global \
  --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc github \
  --location=global \
  --workload-identity-pool=github \
  --display-name="GitHub" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository=='${REPO}'"

# Let the repo impersonate github-deploy@.
gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository/${REPO}"

# Values to paste into GitHub Variables.
echo "GCP_WORKLOAD_IDENTITY_PROVIDER=projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/providers/github"
echo "GCP_DEPLOY_SERVICE_ACCOUNT=${SA_EMAIL}"
```

### 2.6 GitHub repository settings

Repo → Settings → Environments → `pilot` → add Variables:

| Variable                         | Value                                                                                               |
|----------------------------------|-----------------------------------------------------------------------------------------------------|
| `GCP_PROJECT_ID`                 | `weavenyc-pilot`                                                                                    |
| `GCP_REGION`                     | `us-east1`                                                                                          |
| `GCP_AR_REPOSITORY`              | `weavenyc`                                                                                          |
| `GCP_RESOURCE_DIRECTORY_SERVICE` | `resource-directory`                                                                                |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Output from §2.5                                                                                    |
| `GCP_DEPLOY_SERVICE_ACCOUNT`     | `github-deploy@weavenyc-pilot.iam.gserviceaccount.com`                                              |

No long-lived GitHub Secrets are required for GCP — OIDC is used end-to-end.

---

## 3. Manual build + deploy (off-CI)

Handy for first deploy, re-seeding, or diagnosing a broken CI push.

```bash
export PROJECT_ID=weavenyc-pilot
export REGION=us-east1
export REPO=weavenyc
export SERVICE=resource-directory
export TAG=v0.1.0

gcloud config set project "$PROJECT_ID"
gcloud auth configure-docker "${REGION}-docker.pkg.dev"

# Build from the repo root so the Dockerfile can copy packages/shared + db.
docker build \
  -t "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${SERVICE}:${TAG}" \
  -f services/resource-directory/Dockerfile \
  .

docker push "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${SERVICE}:${TAG}"

gcloud run deploy "$SERVICE" \
  --image="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${SERVICE}:${TAG}" \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=3 \
  --timeout=60s \
  --concurrency=80 \
  --set-env-vars="NODE_ENV=production,WEAVENYC_DEPLOY_PROFILE=production,SERVICE_PORT=8080,HOST=0.0.0.0,PORT=8080,LOG_LEVEL=info,INTERNAL_SERVICE_JWT_ISSUER=weavenyc-api-gateway:internal" \
  --set-secrets="DATABASE_URL=weavenyc-database-url:latest,INTERNAL_SERVICE_JWT_SECRET=weavenyc-internal-service-jwt-secret:latest"

CLOUD_RUN_URL=$(gcloud run services describe "$SERVICE" --region="$REGION" --format='value(status.url)')
echo "Service URL: $CLOUD_RUN_URL"
curl -sSfL "$CLOUD_RUN_URL/healthz"
```

`--allow-unauthenticated` is safe: the `/internal/v1/resource-directory/*`
endpoints enforce an HS256 Bearer JWT at the application layer. Only
`/healthz`, `/readyz`, `/versionz`, `/metrics` are intentionally public.

---

## 4. DNS — `resources.weavenyc.org`

Cloud Run managed certificates require the domain to be mapped to the
service **before** the cert can be issued. Two-step flow:

```bash
# 1) Map the custom domain (creates an entry in "Custom Domains" section
#    of the Cloud Run service).
gcloud run domain-mappings create \
  --service=resource-directory \
  --domain=resources.weavenyc.org \
  --region=us-east1

# 2) Inspect the required DNS records.
gcloud run domain-mappings describe \
  --domain=resources.weavenyc.org \
  --region=us-east1 \
  --format='value(status.resourceRecords)'
```

Then add the Cloudflare record via API (same pattern used for the PWA):

```bash
CLOUD_RUN_HOST=$(gcloud run services describe resource-directory \
  --region=us-east1 --format='value(status.url)' | sed 's|https://||')

curl -X POST \
  "https://api.cloudflare.com/client/v4/zones/db153bc364c37fe572451d2482c7cdac/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data "{\"type\":\"CNAME\",\"name\":\"resources\",\"content\":\"${CLOUD_RUN_HOST}\",\"proxied\":false}"
```

Caveat: `proxied:true` (Cloudflare orange cloud) in front of a naked Cloud
Run URL does not currently work without a serverless NEG + external HTTPS
load balancer. For M8 we ship `proxied:false` (DNS-only, Cloud Run serves
its own Google-managed cert) — same pattern as most Cloud Run + Cloudflare
guides. To upgrade to proxied later, add a global external LB + serverless
NEG per <https://cloud.google.com/run/docs/mapping-custom-domains#lb-setup>.

---

## 5. Teardown (end of course)

```bash
# Delete Cloud Run service (keeps image history).
gcloud run services delete resource-directory --region=us-east1 --quiet

# Delete Artifact Registry repo (removes all tags + images).
gcloud artifacts repositories delete weavenyc --location=us-east1 --quiet

# Delete secrets.
gcloud secrets delete weavenyc-database-url --quiet
gcloud secrets delete weavenyc-internal-service-jwt-secret --quiet

# Delete domain mapping + Cloudflare record (manual via Cloudflare API).
gcloud run domain-mappings delete --domain=resources.weavenyc.org --region=us-east1 --quiet

# Finally, shut down the project itself (30-day soft-delete window).
gcloud projects delete weavenyc-pilot --quiet
```

---

## 6. Current deploy status (2026-04-16)

| Step                                 | Status                       | Evidence                                     |
|--------------------------------------|------------------------------|----------------------------------------------|
| `gcloud projects create weavenyc-pilot` | DONE                      | `/tmp/gcp-create.log`                        |
| `gcloud services enable …`           | BLOCKED on billing           | `/tmp/gcp-enable.log` (`UREQ_PROJECT_BILLING_NOT_FOUND`) |
| Artifact Registry repo create        | BLOCKED on billing           | depends on API enable                        |
| Secret Manager secrets               | BLOCKED on billing           | depends on API enable                        |
| Cloud Run deploy                     | BLOCKED on billing           | depends on AR + secrets                      |
| DNS CNAME `resources.weavenyc.org`   | BLOCKED on Cloud Run URL     | depends on Cloud Run deploy                  |
| Dockerfile (`services/resource-directory/Dockerfile`) | DELIVERED   | file shipped in this branch                  |
| GitHub Actions workflow (`deploy-resources.yml`) | DELIVERED         | file shipped in this branch                  |
| IaC docs (this file)                 | DELIVERED                    | file shipped in this branch                  |

Unblocker: the account owner must attach a billing account to `weavenyc-pilot`
at <https://console.cloud.google.com/billing/linkedaccount?project=weavenyc-pilot>
(GCP gives every new account $300 in free credits — sufficient for the
course). After that, §2.2 onward can be re-run by any contributor with
`roles/owner` on the project.
