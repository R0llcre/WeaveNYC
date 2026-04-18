# infra/azure — WeaveNYC Pilot Azure deployment

This directory documents the Azure resources that host the
`services/notifications` microservice behind `notify.weavenyc.org`
for the M8 pilot (W4B-Azure).

The notifications service is a Fastify runtime for Twilio SMS (OTP) and
Resend email (magic-link) delivery. In production it runs in Azure
Container Apps; in local/staging it falls back to stub providers via
`NOTIFICATIONS_PROVIDER_MODE=stub`, so this deployment can demo the
infrastructure even before Twilio + Resend domains are provisioned.

Companion docs: [`docs/19_Deployment_Guide.md`](../../docs/19_Deployment_Guide.md)
(environment matrix) and [`docs/11_Ops_Runbook.md`](../../docs/11_Ops_Runbook.md)
(incident response). Sibling infra: [`infra/aws/README.md`](../aws/README.md),
[`infra/gcp/README.md`](../gcp/README.md).

---

## 1. Resource inventory

| Kind | Name | Region | Purpose |
|------|------|--------|---------|
| Subscription | `Azure 订阅 1` (`fc44bc0c-0dcf-4b72-a442-2342592baacc`) | global | Billing boundary. |
| Resource group | `weavenyc-pilot` | eastus | Holds every Azure resource listed below. |
| Container Registry (Basic) | `weavenycpilot` / `weavenycpilot.azurecr.io` | eastus | Stores `notifications:<tag>` images. Admin user enabled so the Container App can pull on the cheapest tier (Basic, ~$5/mo). |
| Container Apps environment | `weavenyc-env` | eastus | Shared Consumption-plan environment (serverless, scale-to-zero capable). |
| Container App | `notifications` | eastus | External ingress on port 4105, min=0 max=3 replicas, 0.5 vCPU / 1 GiB. Backs `notify.weavenyc.org`. |
| Managed secret | `internal-jwt-secret` (on the Container App) | eastus | HS256 secret shared with api-gateway for internal service JWTs. |
| Managed secret | `twilio-account-sid`, `twilio-auth-token` | eastus | Twilio credentials (STUB for pilot until real account provisioned). |
| Managed secret | `resend-api-key` | eastus | Resend API key (STUB for pilot until domain DNS is verified). |
| Entra workload identity (federated credential) | `weavenyc-github-deploy` (service principal `notify-deployer`) | global | Trusts GitHub Actions OIDC tokens from `repo:R0llcre/WeaveNYC:ref:refs/heads/main` — used by `.github/workflows/deploy-notify.yml`. |
| DNS record (Cloudflare) | `notify.weavenyc.org` | n/a | CNAME to the Container App FQDN (see §6). |

Region choice (`eastus`) matches the AWS/GCP pilot region so cross-cloud
latency stays single-digit ms across the public network.

---

## 2. Provisioning playbook (happy path)

All commands assume:

```bash
az login
az account set --subscription fc44bc0c-0dcf-4b72-a442-2342592baacc
```

### 2.1 Resource group

```bash
az group create --name weavenyc-pilot --location eastus
```

### 2.2 Azure Container Registry (Basic tier)

```bash
az acr create \
  --name weavenycpilot \
  --resource-group weavenyc-pilot \
  --sku Basic \
  --admin-enabled true \
  --location eastus
```

`--admin-enabled true` is a pilot-grade shortcut: it lets the Container
App pull images using a username/password pair instead of managed
identity. Trade-off documented in §7.

### 2.3 Build + push container image

```bash
az acr login --name weavenycpilot

docker build --platform linux/amd64 \
  -t weavenycpilot.azurecr.io/notifications:v0.1.0 \
  -f services/notifications/Dockerfile .

docker push weavenycpilot.azurecr.io/notifications:v0.1.0
```

The build context is the monorepo root (not `services/notifications`) so
`pnpm install --frozen-lockfile` has the full workspace graph. The final
image carries only `packages/shared/dist` + `services/notifications/dist`
— everything else is pruned by `.dockerignore`.

> **Known issue:** Node 20.18.1's bundled corepack fails to verify newer
> pnpm release signatures (`Cannot find matching keyid`). The Dockerfile
> works around this by `npm install -g corepack@latest` before
> `corepack prepare pnpm@…`. If you bump the base image past 20.20.x the
> workaround should no longer be needed.

### 2.4 Container Apps environment

```bash
az containerapp env create \
  --name weavenyc-env \
  --resource-group weavenyc-pilot \
  --location eastus
```

Takes ~45 seconds — it provisions the backing Log Analytics workspace
implicitly. Inspect at `az containerapp env show --name weavenyc-env`.

### 2.5 Container App

```bash
ACR_USER=$(az acr credential show --name weavenycpilot --query username -o tsv)
ACR_PASS=$(az acr credential show --name weavenycpilot --query passwords[0].value -o tsv)

az containerapp create \
  --name notifications \
  --resource-group weavenyc-pilot \
  --environment weavenyc-env \
  --image weavenycpilot.azurecr.io/notifications:v0.1.0 \
  --registry-server weavenycpilot.azurecr.io \
  --registry-username "$ACR_USER" \
  --registry-password "$ACR_PASS" \
  --min-replicas 0 \
  --max-replicas 3 \
  --cpu 0.5 \
  --memory 1.0Gi \
  --ingress external \
  --target-port 4105 \
  --env-vars \
    "NODE_ENV=production" \
    "NOTIFICATIONS_HOST=0.0.0.0" \
    "NOTIFICATIONS_PORT=4105" \
    "LOG_LEVEL=info" \
    "NOTIFICATIONS_PROVIDER_MODE=stub" \
    "NOTIFICATIONS_PILOT_MODE=1" \
    "NOTIFICATIONS_DEMO_BASE_URL=https://weavenyc.org" \
    "INTERNAL_SERVICE_JWT_SECRET=secretref:internal-jwt-secret" \
    "TWILIO_ACCOUNT_SID=secretref:twilio-account-sid" \
    "TWILIO_AUTH_TOKEN=secretref:twilio-auth-token" \
    "RESEND_API_KEY=secretref:resend-api-key" \
  --secrets \
    "internal-jwt-secret=$(openssl rand -hex 32)" \
    "twilio-account-sid=stub-twilio-account-sid" \
    "twilio-auth-token=stub-twilio-auth-token" \
    "resend-api-key=stub-resend-api-key"
```

- `--min-replicas 0` — scale to zero while idle, the Container Apps
  built-in cold-start sits under a second for this image so cost stays
  near $0/mo during pilot idle windows.
- `NOTIFICATIONS_PROVIDER_MODE=stub` + `NOTIFICATIONS_PILOT_MODE=1` —
  keeps the stub providers active until real Twilio/Resend credentials
  are available (§5). The pilot-mode flag bypasses the production guard
  in `services/notifications/src/config.ts`; **remove the flag** before
  promoting the service out of pilot status.
- The four secrets are stored in the Container App managed secret store;
  env vars reference them via the `secretref:` prefix.

> **Keep the `internal-jwt-secret` synchronized with**
> `weavenyc/pilot/internal-service-jwt-secret` in AWS Secrets Manager —
> the api-gateway signs, notifications verifies, so both sides must
> share the same HS256 secret. The helper script in §5.1 pulls the
> AWS-stored value and rotates the Azure secret to match.

### 2.6 Fetch the Container App FQDN

```bash
APP_FQDN=$(az containerapp show \
  --name notifications \
  --resource-group weavenyc-pilot \
  --query properties.configuration.ingress.fqdn -o tsv)
echo "$APP_FQDN"
# → notifications.<hash>.eastus.azurecontainerapps.io
```

Smoke test:

```bash
curl -fsS "https://$APP_FQDN/healthz"
# → {"status":"ok","service":"notifications-service","timestamp":"…"}
curl -fsS "https://$APP_FQDN/readyz"
# → {"status":"ok","service":"notifications-service","timestamp":"…"}
```

### 2.7 Cloudflare DNS (CNAME)

```bash
curl -X POST \
  "https://api.cloudflare.com/client/v4/zones/db153bc364c37fe572451d2482c7cdac/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data "{\"type\":\"CNAME\",\"name\":\"notify\",\"content\":\"$APP_FQDN\",\"proxied\":false}"
```

We keep `proxied=false` initially because Azure Container Apps requires a
domain-ownership TXT verification step (§2.8) that needs to see the raw
CNAME. After the managed cert is provisioned, optionally flip
`proxied=true` for Cloudflare WAF/Argo benefits.

### 2.8 Bind the custom domain to the Container App

```bash
# Fetch the verification token Azure expects on asuid.notify.weavenyc.org
VERIFICATION_ID=$(az containerapp show \
  --name notifications --resource-group weavenyc-pilot \
  --query properties.customDomainVerificationId -o tsv)

# Publish the TXT record via Cloudflare
curl -X POST \
  "https://api.cloudflare.com/client/v4/zones/db153bc364c37fe572451d2482c7cdac/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data "{\"type\":\"TXT\",\"name\":\"asuid.notify\",\"content\":\"$VERIFICATION_ID\",\"proxied\":false}"

# Let Azure provision a managed certificate and bind the hostname
az containerapp hostname add \
  --hostname notify.weavenyc.org \
  --name notifications \
  --resource-group weavenyc-pilot

az containerapp hostname bind \
  --hostname notify.weavenyc.org \
  --name notifications \
  --resource-group weavenyc-pilot \
  --environment weavenyc-env \
  --validation-method CNAME
```

Managed cert issuance takes ~15 minutes. Track with
`az containerapp hostname list --name notifications --resource-group weavenyc-pilot -o table`.

---

## 3. GitHub Actions OIDC federation (one-time)

`.github/workflows/deploy-notify.yml` assumes OIDC federation with
Entra ID so the job never handles static Azure credentials. One-time
setup:

```bash
# 3.1 Create the service principal the federation credential will attach to.
APP=$(az ad app create --display-name weavenyc-notify-deploy --query appId -o tsv)
SP=$(az ad sp create --id "$APP" --query id -o tsv)

# 3.2 Scope it to the resource group + ACR.
az role assignment create \
  --assignee "$APP" --role "Contributor" \
  --scope "/subscriptions/fc44bc0c-0dcf-4b72-a442-2342592baacc/resourceGroups/weavenyc-pilot"

az role assignment create \
  --assignee "$APP" --role "AcrPush" \
  --scope "/subscriptions/fc44bc0c-0dcf-4b72-a442-2342592baacc/resourceGroups/weavenyc-pilot/providers/Microsoft.ContainerRegistry/registries/weavenycpilot"

# 3.3 Trust GitHub Actions OIDC tokens from the main branch of this repo.
cat > /tmp/federated.json <<'JSON'
{
  "name": "github-main",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:R0llcre/WeaveNYC:ref:refs/heads/main",
  "audiences": ["api://AzureADTokenExchange"]
}
JSON

az ad app federated-credential create --id "$APP" --parameters @/tmp/federated.json

# 3.4 Capture the three values the workflow needs in GitHub → Settings → Secrets.
TENANT_ID=$(az account show --query tenantId -o tsv)
echo "AZURE_CLIENT_ID=$APP"
echo "AZURE_TENANT_ID=$TENANT_ID"
echo "AZURE_SUBSCRIPTION_ID=fc44bc0c-0dcf-4b72-a442-2342592baacc"
```

Add the three `echo`'d values as repository secrets. Push to `main`
changing anything under `services/notifications/**` and the workflow will
build, push, redeploy, and smoke-test `/healthz` automatically.

---

## 4. Environment reference

| Variable | Secret ref? | Value |
|----------|-------------|-------|
| `NODE_ENV` | no | `production` |
| `NOTIFICATIONS_HOST` | no | `0.0.0.0` |
| `NOTIFICATIONS_PORT` | no | `4105` |
| `LOG_LEVEL` | no | `info` |
| `NOTIFICATIONS_PROVIDER_MODE` | no | `stub` (pilot) / `real` (post-Twilio+Resend) |
| `NOTIFICATIONS_PILOT_MODE` | no | `1` while stub providers must run in `NODE_ENV=production`. Unset once real providers are in. |
| `NOTIFICATIONS_DEMO_BASE_URL` | no | `https://weavenyc.org` |
| `INTERNAL_SERVICE_JWT_SECRET` | `secretref:internal-jwt-secret` | 32-byte hex, matches AWS `weavenyc/pilot/internal-service-jwt-secret` |
| `TWILIO_ACCOUNT_SID` | `secretref:twilio-account-sid` | Real SID once account provisioned (§5) |
| `TWILIO_AUTH_TOKEN` | `secretref:twilio-auth-token` | Real token once account provisioned |
| `TWILIO_MESSAGING_SERVICE_SID` | `secretref:twilio-messaging-sid` | Optional — set either this or a from-number |
| `TWILIO_FROM_NUMBER` | `secretref:twilio-from-number` | Optional — set either this or a messaging service sid |
| `RESEND_API_KEY` | `secretref:resend-api-key` | Real key once Resend domain verified |
| `RESEND_FROM_EMAIL` | no (not secret) | e.g. `notifications@weavenyc.org` |

Config loader logic lives in `services/notifications/src/config.ts`. When
`NODE_ENV=production`, the loader **refuses to start** unless provider
mode is `real` and every Twilio + Resend field is populated — so flipping
out of stub mode requires all credentials to be present together.

---

## 5. Going to `real` providers (post-pilot)

### 5.1 Sync the internal JWT secret

```bash
# Pull the secret AWS currently enforces for the api-gateway.
AWS_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id weavenyc/pilot/internal-service-jwt-secret \
  --query SecretString --output text --region us-east-1)

# Rotate the Azure-side secret to match.
az containerapp secret set \
  --name notifications --resource-group weavenyc-pilot \
  --secrets "internal-jwt-secret=$AWS_SECRET"

# Restart active revisions so the new secret takes effect.
az containerapp revision restart \
  --name notifications --resource-group weavenyc-pilot \
  --revision "$(az containerapp revision list \
    --name notifications --resource-group weavenyc-pilot \
    --query '[?properties.active].name | [0]' -o tsv)"
```

### 5.2 Twilio (SMS / OTP)

1. Create a Twilio account (or reuse the team's trial), then:
   - Verify a toll-free or short-code sender, OR buy an A2P-registered
     long-code number.
   - Note the **Account SID** and **Auth Token** from the console.
2. Push the real values:

```bash
az containerapp secret set \
  --name notifications --resource-group weavenyc-pilot \
  --secrets \
    "twilio-account-sid=AC…" \
    "twilio-auth-token=…" \
    "twilio-from-number=+1…"

az containerapp update \
  --name notifications --resource-group weavenyc-pilot \
  --set-env-vars "NOTIFICATIONS_PROVIDER_MODE=real" "TWILIO_FROM_NUMBER=secretref:twilio-from-number"

# Drop the pilot escape hatch now that real providers are live.
az containerapp update \
  --name notifications --resource-group weavenyc-pilot \
  --remove-env-vars NOTIFICATIONS_PILOT_MODE
```

### 5.3 Resend (email / magic-link)

1. Add a sending domain in Resend console, publish DKIM + SPF + DMARC
   TXT records via Cloudflare (see §5.4 below for the exact records).
2. Wait for Resend to mark the domain as verified.
3. Push the key + set the from email:

```bash
az containerapp secret set \
  --name notifications --resource-group weavenyc-pilot \
  --secrets "resend-api-key=re_…"

az containerapp update \
  --name notifications --resource-group weavenyc-pilot \
  --set-env-vars \
    "RESEND_FROM_EMAIL=notifications@weavenyc.org"
```

### 5.4 Resend DNS records (reference — actuals come from Resend console)

| Type | Name | Content (provided by Resend) |
|------|------|-------------------------------|
| TXT | `resend._domainkey` | `p=MIGfMA0G…` (DKIM public key) |
| TXT | `@` | `v=spf1 include:amazonses.com ~all` or similar |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@weavenyc.org` |

---

## 6. Teardown (pilot shutdown)

```bash
# 1) Remove the custom domain so Azure stops renewing the managed cert.
az containerapp hostname delete \
  --hostname notify.weavenyc.org \
  --name notifications \
  --resource-group weavenyc-pilot

# 2) Delete the entire resource group — this removes the Container App,
#    environment, ACR, and all secrets in one shot.
az group delete --name weavenyc-pilot --yes --no-wait

# 3) Delete the Entra workload identity (service principal).
az ad app delete --id <AZURE_CLIENT_ID>

# 4) Remove Cloudflare DNS records (notify + asuid.notify TXT).
for record in notify asuid.notify ; do
  RECORD_ID=$(curl -s \
    "https://api.cloudflare.com/client/v4/zones/db153bc364c37fe572451d2482c7cdac/dns_records?name=$record.weavenyc.org" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    | jq -r '.result[0].id')
  curl -X DELETE \
    "https://api.cloudflare.com/client/v4/zones/db153bc364c37fe572451d2482c7cdac/dns_records/$RECORD_ID" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
done
```

---

## 7. Known pilot-grade shortcuts

- **ACR admin user enabled** — simplest way to pull from the Container
  App without wiring up managed identity. Before a public launch: disable
  the admin user and attach a system-assigned managed identity to the
  Container App with `AcrPull` scope.
- **Container App uses static ACR credentials** — same trade-off as
  above; move to managed identity post-pilot.
- **`--min-replicas 0`** — scale-to-zero saves money but adds ~800ms
  cold-start on first request after an idle window. Raise to 1 if the
  pilot UX can't tolerate the warm-up.
- **Managed secrets, not Key Vault** — Container Apps has a native secret
  store that satisfies the pilot. Production should use Key Vault + the
  Key Vault secret reference (`keyvaultref:…`) syntax.
- **Single region (`eastus`)** — no geo redundancy. Container Apps
  supports multi-region via Azure Front Door; out of scope for pilot.
- **OIDC federation scoped to `refs/heads/main` only** — tag-driven
  releases or deploys from feature branches require additional federated
  credentials (one per subject pattern).

---

## 8. Cost profile (monthly, pilot-scope)

| Resource | Free tier? | Rough $ cost |
|----------|-----------|--------------|
| Azure Container Registry (Basic) | 1 registry, 10 GB | ~$5/mo |
| Container Apps environment | Yes (included) | $0 |
| Container App (0.5 vCPU / 1 GiB, min-replicas 0) | 180,000 vCPU-s/mo free | ~$0–2/mo idle |
| Log Analytics workspace (Container Apps logs) | 5 GB/mo free | $0 at pilot volume |
| Cloudflare DNS + managed TLS | Free plan | $0 |

Total ~$5–8/mo at pilot traffic, dominated by the ACR Basic fee.

---

## 9. Operational runbook pointers

- **Logs:** `az containerapp logs show --name notifications --resource-group weavenyc-pilot --follow`.
- **Revisions:** `az containerapp revision list --name notifications --resource-group weavenyc-pilot -o table`.
- **Rollback:** `az containerapp revision activate --revision <old-revision> --name notifications --resource-group weavenyc-pilot` → then deactivate the bad revision.
- **Cert renewal:** Azure-managed certs auto-renew 30 days before
  expiry. Confirm with
  `az containerapp hostname list --name notifications --resource-group weavenyc-pilot -o table`.
- **Incident escalation:** see `docs/11_Ops_Runbook.md` for the full tree.
