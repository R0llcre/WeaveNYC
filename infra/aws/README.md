# WeaveNYC — AWS Pilot Infrastructure (M8)

This directory captures the AWS resources backing the pilot `api.weavenyc.org`
runtime (`services/api-gateway`). The intent is **pilot-grade, course-scope**:

- Cheap footprint (RDS `db.t3.micro` + App Runner smallest instance + free
  tier Upstash Redis + ECR).
- Everything reproducible from the CLI commands in this README and/or the
  `main.tf` Terraform stub.
- Not intended as a hardened production blueprint — see the caveats section.

All commands assume the operator is logged in as the `R0llcre` IAM user
(Account `590517422743`) with AdministratorAccess in region `us-east-1`.

## 0. Live pilot endpoints (as provisioned 2026-04-16)

| Resource | Value |
|----------|-------|
| App Runner service ARN | `arn:aws:apprunner:us-east-1:590517422743:service/weavenyc-api-gateway/07509b0481ce4b099e40085ed79bb506` |
| App Runner default URL | `https://hykmfmcf58.us-east-1.awsapprunner.com` |
| Public API hostname (via Cloudflare DNS-only → App Runner custom domain) | `https://api.weavenyc.org` |
| RDS endpoint | `weavenyc-pilot.cyr6g2wi2nku.us-east-1.rds.amazonaws.com:5432/weavenyc_pilot` |
| ECR image tag | `590517422743.dkr.ecr.us-east-1.amazonaws.com/weavenyc-api-gateway:v0.1.3` |
| Health probe | `GET /healthz` → `200 {"status":"ok"}` |
| Readiness probe | `GET /readyz` → `503 {"status":"degraded"}` while Redis is still localhost (see §6) |
| App Runner size | `0.25 vCPU / 0.5 GB` (pilot tier) |
| Custom-domain cert | ACM validated and SAN rolled out to the edge. `curl https://api.weavenyc.org/healthz` passes full TLS verify (`SSL_verify=0`). The initial validation-to-first-serve window was ~5 min for ACM to flip `pending_certificate_dns_validation` → `active`, and an additional ~10–30 min for the edge cert SAN to include `api.weavenyc.org`. |

Known IaC divergences from the sections below (actual names used):
- App Runner access role is `weavenyc-apprunner-access` (not `...-access-role`).
- App Runner instance role is `weavenyc-apprunner-instance` (not `...-instance-role`).
- Secrets are referenced by their full ARNs (with Secrets-Manager-assigned random suffix) in the App Runner `RuntimeEnvironmentSecrets` map — see §2.8.
- `DATABASE_URL` carries `?sslmode=no-verify` because RDS ships with a self-signed cert chain the `pg` driver would otherwise reject.
- The service ships a small `/usr/local/bin/docker-entrypoint.sh` shim that writes the `JWT_SIGNING_*` PEM blobs (delivered as Secrets Manager env vars) to `/app/.runtime-keys/*.pem` before exec'ing node, because `services/api-gateway/src/config.ts` expects file paths, not inline PEM strings.

## 1. Resource inventory

| Kind | Name / ARN | Purpose |
|------|------------|---------|
| ECR repository | `590517422743.dkr.ecr.us-east-1.amazonaws.com/weavenyc-api-gateway` | Stores multi-arch container images for api-gateway. Scan-on-push enabled. |
| RDS Postgres | `weavenyc-pilot` (db.t3.micro, engine 16.4) | Primary datastore. PostGIS extension enabled post-create. Publicly accessible for pilot (restricted to SG). |
| RDS security group | `weavenyc-pilot-rds` (`sg-0b68b0104ecd0f563`) | Allows inbound 5432 from 0.0.0.0/0 (pilot-grade; tighten before public launch). |
| RDS subnet group | `weavenyc-pilot-subnets` | Default VPC's 6 subnets for HA. |
| Secrets Manager | `weavenyc/pilot/rds-master-password` | Rotated RDS master password. |
| Secrets Manager | `weavenyc/pilot/jwt-private-key` | RS256 private key (api-gateway signs access tokens). |
| Secrets Manager | `weavenyc/pilot/jwt-public-key` | RS256 public key (api-gateway verifies access tokens). |
| Secrets Manager | `weavenyc/pilot/identity-hash-pepper` | `IDENTITY_HASH_PEPPER`. |
| Secrets Manager | `weavenyc/pilot/anchor-totp-encryption-key` | `ANCHOR_TOTP_ENCRYPTION_KEY`. |
| Secrets Manager | `weavenyc/pilot/internal-service-jwt-secret` | `INTERNAL_SERVICE_JWT_SECRET`. |
| Secrets Manager | `weavenyc/pilot/redis-url` | Upstash Redis `rediss://…` connection string (manually populated). |
| IAM role | `weavenyc-apprunner-access-role` | App Runner pulls image from ECR (AWSAppRunnerServicePolicyForECRAccess). |
| IAM role | `weavenyc-apprunner-instance-role` | App Runner service task role — grants `secretsmanager:GetSecretValue` on the 7 secrets above. |
| IAM role | `weavenyc-github-actions-deployer` | GitHub OIDC deploy role (push images + start App Runner deployments). |
| App Runner service | `weavenyc-api-gateway` | Listens on 4000, `/healthz` probe, reads secrets + env from role + config. |
| Cloudflare DNS | CNAME `api.weavenyc.org` → App Runner default hostname | Proxied for WAF/TLS. |

Also not in AWS: **Upstash Redis** — free-tier serverless Redis, signup at
<https://upstash.com>, connection string stored in
`weavenyc/pilot/redis-url`. Using Upstash avoids the ElastiCache
`cache.t2.micro` spend (~$13/mo) and keeps the pilot inside free credits.

## 2. Provisioning playbook (happy path)

### 2.1 ECR repository

```bash
aws ecr create-repository \
  --repository-name weavenyc-api-gateway \
  --region us-east-1 \
  --image-scanning-configuration scanOnPush=true
```

### 2.2 Build + push container

```bash
aws ecr get-login-password --region us-east-1 \
  | docker login --username AWS \
      --password-stdin 590517422743.dkr.ecr.us-east-1.amazonaws.com

docker build -t weavenyc-api-gateway:v0.1.0 \
  -f services/api-gateway/Dockerfile .

docker tag weavenyc-api-gateway:v0.1.0 \
  590517422743.dkr.ecr.us-east-1.amazonaws.com/weavenyc-api-gateway:v0.1.0
docker tag weavenyc-api-gateway:v0.1.0 \
  590517422743.dkr.ecr.us-east-1.amazonaws.com/weavenyc-api-gateway:latest

docker push 590517422743.dkr.ecr.us-east-1.amazonaws.com/weavenyc-api-gateway:v0.1.0
docker push 590517422743.dkr.ecr.us-east-1.amazonaws.com/weavenyc-api-gateway:latest
```

### 2.3 Networking (default VPC reused)

```bash
VPC_ID=$(aws ec2 describe-vpcs --filters Name=is-default,Values=true \
  --region us-east-1 --query 'Vpcs[0].VpcId' --output text)

aws ec2 create-security-group \
  --group-name weavenyc-pilot-rds \
  --description "WeaveNYC pilot RDS (Postgres+PostGIS)" \
  --vpc-id "$VPC_ID" --region us-east-1

aws ec2 authorize-security-group-ingress \
  --group-name weavenyc-pilot-rds \
  --protocol tcp --port 5432 --cidr 0.0.0.0/0 \
  --region us-east-1

aws rds create-db-subnet-group \
  --db-subnet-group-name weavenyc-pilot-subnets \
  --db-subnet-group-description "WeaveNYC pilot DB subnets (default VPC)" \
  --subnet-ids $(aws ec2 describe-subnets \
      --filters Name=vpc-id,Values="$VPC_ID" \
      --region us-east-1 --query 'Subnets[].SubnetId' --output text) \
  --region us-east-1
```

### 2.4 RDS Postgres

```bash
RDS_PW=$(openssl rand -base64 24 | tr -d '\n/+=')
aws secretsmanager create-secret \
  --name weavenyc/pilot/rds-master-password \
  --secret-string "$RDS_PW" --region us-east-1

aws rds create-db-instance \
  --db-instance-identifier weavenyc-pilot \
  --db-instance-class db.t3.micro \
  --engine postgres --engine-version 16.4 \
  --allocated-storage 20 --storage-type gp3 \
  --master-username weavenyc --master-user-password "$RDS_PW" \
  --db-name weavenyc_pilot \
  --backup-retention-period 7 \
  --publicly-accessible \
  --vpc-security-group-ids <weavenyc-pilot-rds SG id> \
  --db-subnet-group-name weavenyc-pilot-subnets \
  --region us-east-1
```

Wait 5–8 min for `Status == available`. Then enable PostGIS + migrations:

```bash
DB_HOST=$(aws rds describe-db-instances \
  --db-instance-identifier weavenyc-pilot --region us-east-1 \
  --query 'DBInstances[0].Endpoint.Address' --output text)

psql "postgres://weavenyc:$RDS_PW@$DB_HOST:5432/weavenyc_pilot" \
  -c "CREATE EXTENSION IF NOT EXISTS postgis;"

DATABASE_URL="postgres://weavenyc:$RDS_PW@$DB_HOST:5432/weavenyc_pilot" \
  pnpm db:migrate
```

### 2.5 Application secrets

```bash
openssl genrsa -out /tmp/jwt-private.pem 2048
openssl rsa -in /tmp/jwt-private.pem -pubout -out /tmp/jwt-public.pem

for pair in \
  "jwt-private-key:$(cat /tmp/jwt-private.pem)" \
  "jwt-public-key:$(cat /tmp/jwt-public.pem)" \
  "identity-hash-pepper:$(openssl rand -hex 32)" \
  "anchor-totp-encryption-key:$(openssl rand -hex 32)" \
  "internal-service-jwt-secret:$(openssl rand -hex 32)"
do
  NAME=${pair%%:*}; VALUE=${pair#*:}
  aws secretsmanager create-secret \
    --name "weavenyc/pilot/$NAME" \
    --secret-string "$VALUE" --region us-east-1
done

rm /tmp/jwt-private.pem /tmp/jwt-public.pem
```

### 2.6 Upstash Redis

1. Sign up at <https://upstash.com>, create a Global Redis database.
2. Copy the `rediss://default:<password>@global-xxxxx.upstash.io:6379` URL.
3. Store it:

```bash
aws secretsmanager create-secret \
  --name weavenyc/pilot/redis-url \
  --secret-string "rediss://default:xxxx@global-yyyy.upstash.io:6379" \
  --region us-east-1
```

If you choose **not** to use Upstash (higher-availability pilot), fall back
to `cache.t2.micro` ElastiCache — see §6.

### 2.7 IAM roles for App Runner

```bash
# ECR access role (image pulls)
aws iam create-role \
  --role-name weavenyc-apprunner-access-role \
  --assume-role-policy-document file://trust-apprunner-build.json
aws iam attach-role-policy \
  --role-name weavenyc-apprunner-access-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess

# Task role (secrets access)
aws iam create-role \
  --role-name weavenyc-apprunner-instance-role \
  --assume-role-policy-document file://trust-apprunner-tasks.json
aws iam put-role-policy \
  --role-name weavenyc-apprunner-instance-role \
  --policy-name apprunner-pilot-secrets \
  --policy-document file://policy-apprunner-secrets.json
```

Where trust + policy files are:

`trust-apprunner-build.json`:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "build.apprunner.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
```

`trust-apprunner-tasks.json`:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "tasks.apprunner.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
```

`policy-apprunner-secrets.json`: reads the 7 pilot secrets. See `main.tf`
for the canonical resource list and replace ARN prefixes as appropriate.

### 2.8 App Runner service

```bash
aws apprunner create-service \
  --service-name weavenyc-api-gateway \
  --cli-input-json file://apprunner-service.json \
  --region us-east-1
```

Reference JSON lives at `infra/aws/apprunner-service.json` — it references
the ECR image, binds env vars from Secrets Manager ARNs, and sets the
`/healthz` health check.

### 2.9 Cloudflare DNS

```bash
APP_RUNNER_HOST=$(aws apprunner describe-service \
  --service-arn $(aws apprunner list-services \
    --query 'ServiceSummaryList[?ServiceName==`weavenyc-api-gateway`].ServiceArn' \
    --output text --region us-east-1) \
  --region us-east-1 --query 'Service.ServiceUrl' --output text)

curl -X POST \
  "https://api.cloudflare.com/client/v4/zones/db153bc364c37fe572451d2482c7cdac/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"CNAME\",\"name\":\"api\",\"content\":\"$APP_RUNNER_HOST\",\"proxied\":true}"
```

### 2.10 GitHub OIDC deployer role

See the template in §4 of
[`docs/19_Deployment_Guide.md`](../../docs/19_Deployment_Guide.md). The
role trust policy points at the GitHub OIDC provider
(`token.actions.githubusercontent.com`) with a condition scoping access to
`repo:R0llcre/WeaveNYC:ref:refs/heads/main`.

## 3. Terraform stub

`main.tf` encodes the same resources declaratively. It is **not** applied
by CI today — it is a reference so future operators can reproduce the
environment without re-typing CLI invocations. To apply:

```bash
cd infra/aws
terraform init
terraform plan -out=plan.tfplan
terraform apply plan.tfplan
```

State is deliberately stored locally (`terraform.tfstate`) for the pilot.
Before promoting out of the pilot, migrate to an S3 backend + DynamoDB
lock table.

## 4. Teardown (pilot shutdown)

```bash
# 1) App Runner
aws apprunner delete-service \
  --service-arn $(aws apprunner list-services \
    --query 'ServiceSummaryList[?ServiceName==`weavenyc-api-gateway`].ServiceArn' \
    --output text --region us-east-1) \
  --region us-east-1

# 2) RDS (skip final snapshot to avoid fees in pilot)
aws rds delete-db-instance \
  --db-instance-identifier weavenyc-pilot \
  --skip-final-snapshot \
  --delete-automated-backups \
  --region us-east-1

aws rds delete-db-subnet-group \
  --db-subnet-group-name weavenyc-pilot-subnets \
  --region us-east-1

# 3) Security groups
aws ec2 delete-security-group \
  --group-name weavenyc-pilot-rds \
  --region us-east-1

# 4) Secrets Manager
for name in jwt-private-key jwt-public-key identity-hash-pepper \
            anchor-totp-encryption-key internal-service-jwt-secret \
            rds-master-password redis-url ; do
  aws secretsmanager delete-secret \
    --secret-id "weavenyc/pilot/$name" \
    --force-delete-without-recovery \
    --region us-east-1
done

# 5) IAM roles (remove inline policies + attachments first)
for role in weavenyc-apprunner-access-role \
            weavenyc-apprunner-instance-role \
            weavenyc-github-actions-deployer ; do
  for p in $(aws iam list-attached-role-policies --role-name "$role" \
              --query 'AttachedPolicies[].PolicyArn' --output text); do
    aws iam detach-role-policy --role-name "$role" --policy-arn "$p"
  done
  for p in $(aws iam list-role-policies --role-name "$role" \
              --query 'PolicyNames' --output text); do
    aws iam delete-role-policy --role-name "$role" --policy-name "$p"
  done
  aws iam delete-role --role-name "$role"
done

# 6) ECR (deletes images as well)
aws ecr delete-repository \
  --repository-name weavenyc-api-gateway \
  --force --region us-east-1

# 7) Cloudflare DNS (optional — only if domain will no longer point here)
curl -X DELETE \
  "https://api.cloudflare.com/client/v4/zones/db153bc364c37fe572451d2482c7cdac/dns_records/<record-id>" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
```

## 5. Cost profile (monthly, pilot-scope)

| Resource | Free tier? | Rough $ cost |
|----------|-----------|--------------|
| RDS `db.t3.micro` + 20 GB gp3 | First 12 mo (new account) | $0 (free tier) or ~$15/mo |
| App Runner (1 vCPU / 2 GB, idle) | No | ~$5/mo idle + per-request |
| ECR (5 GB storage) | 500 MB free | ~$0.50/mo |
| Secrets Manager (8 secrets) | No | $3.20/mo |
| Upstash Redis (free tier, 10k cmd/day) | Yes | $0 |
| Cloudflare (Pages + WAF proxy) | Free plan | $0 |

Total ~$10–20/mo if outside free tier; ~$3/mo if RDS free tier applies.

## 6. Fallback: ElastiCache instead of Upstash

If an internal compliance rule blocks third-party Redis:

```bash
aws elasticache create-cache-cluster \
  --cache-cluster-id weavenyc-pilot-redis \
  --engine redis --engine-version 7.1 \
  --cache-node-type cache.t4g.micro \
  --num-cache-nodes 1 \
  --region us-east-1
```

Approx $13/mo. Remember to put the cache cluster inside the App Runner VPC
connector and update the `weavenyc/pilot/redis-url` secret.

## 6.1 Redis is a pilot-blocker — rotate `REDIS_URL` before go-live

The current App Runner service is **deployed with `REDIS_URL=redis://localhost:6379`** — i.e. pointing at nothing. The api-gateway process survives this (the `server.ts` process-level `uncaughtException` handler keeps it up) but `/readyz` returns `503` with `{"name":"redis","status":"degraded"}` until a reachable Redis is wired in.

**Path A — Upstash (recommended, free-tier):**

1. Sign up at <https://upstash.com> and create a Global Redis DB.
2. Copy the `rediss://default:<password>@global-xxxxx.upstash.io:6379` URL.
3. Update the App Runner service environment:

   ```bash
   SERVICE_ARN="arn:aws:apprunner:us-east-1:590517422743:service/weavenyc-api-gateway/07509b0481ce4b099e40085ed79bb506"
   aws apprunner describe-service --service-arn $SERVICE_ARN --region us-east-1 \
     --query 'Service.SourceConfiguration' > /tmp/src.json
   python3 -c "
   import json
   with open('/tmp/src.json') as f: s=json.load(f)
   s['ImageRepository']['ImageConfiguration']['RuntimeEnvironmentVariables']['REDIS_URL']='rediss://default:<password>@global-xxxxx.upstash.io:6379'
   json.dump({'SourceConfiguration': s}, open('/tmp/new-src.json','w'))
   "
   aws apprunner update-service --service-arn $SERVICE_ARN \
     --cli-input-json file:///tmp/new-src.json --region us-east-1
   ```

4. Wait ~5 min for the service to redeploy, then re-check:

   ```bash
   curl -sS https://api.weavenyc.org/readyz
   # expect: {"status":"ok", checks:[postgres: ok, redis: ok]}
   ```

**Path B — ElastiCache Serverless (AWS-native, ~$15/mo minimum):**
See §6 for the CLI recipe. Requires a VPC connector on App Runner — adds ~15 min of setup. Only use if a compliance rule forbids third-party Redis.

Until either path lands, `/readyz` will continue to return 503 and any feature that touches Redis (refresh-token store, chat real-time pub/sub, anti-abuse rate limits, P2P sync fan-out) will fail per request.

## 7. Known pilot-grade shortcuts

- RDS is publicly reachable (IP-restricted by SG but not VPC-only). Prior
  to public launch: put App Runner in a VPC connector and flip RDS to
  `--no-publicly-accessible`.
- No automated Terraform apply in CI. All infra changes go through the
  runbook above; `main.tf` is a reference only.
- App Runner min-instances is 1 — cold-start latency is negligible but the
  idle bill is nonzero. Switch to min=0 after the pilot if cost matters.
- IAM policies are intentionally tight (only the 7 pilot secrets); rotate
  out on each pilot-cohort boundary.
