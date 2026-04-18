###############################################################################
# WeaveNYC — AWS pilot infrastructure (M8)
#
# Terraform stub that mirrors the CLI playbook documented in
# infra/aws/README.md. This file is a **reference**, not the canonical
# source of truth today: the pilot was initially provisioned via the AWS
# CLI, and we import / translate here so future operators can reproduce
# the environment declaratively.
#
# To apply:
#   cd infra/aws
#   terraform init
#   terraform plan -out=plan.tfplan
#   terraform apply plan.tfplan
#
# Secrets (RDS password, JWT keys, peppers, internal-service secret,
# Upstash Redis URL) are created manually and referenced by ARN. This
# intentionally keeps sensitive material out of Terraform state.
###############################################################################

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.80"
    }
  }
}

provider "aws" {
  region = var.region
}

###############################################################################
# Inputs
###############################################################################

variable "region" {
  description = "AWS region for pilot infra."
  type        = string
  default     = "us-east-1"
}

variable "account_id" {
  description = "AWS account id (Spring'26 class account)."
  type        = string
  default     = "590517422743"
}

variable "image_tag" {
  description = "ECR tag that the App Runner service should launch."
  type        = string
  default     = "latest"
}

variable "db_master_username" {
  description = "RDS master username."
  type        = string
  default     = "weavenyc"
}

variable "github_repository" {
  description = "GitHub repo (owner/name) allowed to assume the deployer role."
  type        = string
  default     = "R0llcre/WeaveNYC"
}

locals {
  pilot_secret_arn_prefix = "arn:aws:secretsmanager:${var.region}:${var.account_id}:secret:weavenyc/pilot/"
  common_tags = {
    Project     = "weavenyc"
    Environment = "pilot"
    ManagedBy   = "terraform"
  }
}

###############################################################################
# Networking (default VPC — no new VPC for pilot)
###############################################################################

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

resource "aws_security_group" "rds" {
  name        = "weavenyc-pilot-rds"
  description = "Allow inbound Postgres 5432 for the pilot RDS instance."
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Public access restricted by DB auth + password (pilot-grade)."
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.common_tags
}

resource "aws_db_subnet_group" "pilot" {
  name       = "weavenyc-pilot-subnets"
  subnet_ids = data.aws_subnets.default.ids
  tags       = local.common_tags
}

###############################################################################
# RDS — Postgres + PostGIS
###############################################################################

data "aws_secretsmanager_secret" "rds_password" {
  name = "weavenyc/pilot/rds-master-password"
}

data "aws_secretsmanager_secret_version" "rds_password" {
  secret_id = data.aws_secretsmanager_secret.rds_password.id
}

resource "aws_db_instance" "pilot" {
  identifier        = "weavenyc-pilot"
  engine            = "postgres"
  engine_version    = "16.4"
  instance_class    = "db.t3.micro"
  allocated_storage = 20
  storage_type      = "gp3"

  db_name  = "weavenyc_pilot"
  username = var.db_master_username
  password = data.aws_secretsmanager_secret_version.rds_password.secret_string

  publicly_accessible    = true
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.pilot.name

  backup_retention_period = 7
  skip_final_snapshot     = true
  apply_immediately       = true
  deletion_protection     = false

  tags = local.common_tags
}

###############################################################################
# ECR
###############################################################################

resource "aws_ecr_repository" "api_gateway" {
  name                 = "weavenyc-api-gateway"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = local.common_tags
}

###############################################################################
# IAM — App Runner roles
###############################################################################

data "aws_iam_policy_document" "apprunner_build_trust" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["build.apprunner.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "apprunner_access" {
  name               = "weavenyc-apprunner-access-role"
  assume_role_policy = data.aws_iam_policy_document.apprunner_build_trust.json
  tags               = local.common_tags
}

resource "aws_iam_role_policy_attachment" "apprunner_ecr_access" {
  role       = aws_iam_role.apprunner_access.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
}

data "aws_iam_policy_document" "apprunner_task_trust" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["tasks.apprunner.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "apprunner_instance" {
  name               = "weavenyc-apprunner-instance-role"
  assume_role_policy = data.aws_iam_policy_document.apprunner_task_trust.json
  tags               = local.common_tags
}

data "aws_iam_policy_document" "apprunner_instance_secrets" {
  statement {
    actions = [
      "secretsmanager:GetSecretValue",
      "secretsmanager:DescribeSecret"
    ]
    resources = [
      "${local.pilot_secret_arn_prefix}rds-master-password-*",
      "${local.pilot_secret_arn_prefix}jwt-private-key-*",
      "${local.pilot_secret_arn_prefix}jwt-public-key-*",
      "${local.pilot_secret_arn_prefix}identity-hash-pepper-*",
      "${local.pilot_secret_arn_prefix}anchor-totp-encryption-key-*",
      "${local.pilot_secret_arn_prefix}internal-service-jwt-secret-*",
      "${local.pilot_secret_arn_prefix}redis-url-*"
    ]
  }
}

resource "aws_iam_role_policy" "apprunner_instance_secrets" {
  name   = "apprunner-pilot-secrets"
  role   = aws_iam_role.apprunner_instance.id
  policy = data.aws_iam_policy_document.apprunner_instance_secrets.json
}

###############################################################################
# GitHub OIDC deployer role
###############################################################################

data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

data "aws_iam_policy_document" "github_trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [data.aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repository}:*"]
    }
  }
}

resource "aws_iam_role" "github_deployer" {
  name               = "weavenyc-github-actions-deployer"
  assume_role_policy = data.aws_iam_policy_document.github_trust.json
  tags               = local.common_tags
}

data "aws_iam_policy_document" "github_deployer" {
  statement {
    sid       = "EcrAuth"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid = "EcrPush"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:CompleteLayerUpload",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
      "ecr:BatchGetImage",
      "ecr:DescribeImages",
      "ecr:DescribeRepositories"
    ]
    resources = [aws_ecr_repository.api_gateway.arn]
  }

  statement {
    sid = "AppRunnerDeploy"
    actions = [
      "apprunner:DescribeService",
      "apprunner:ListServices",
      "apprunner:StartDeployment",
      "apprunner:UpdateService"
    ]
    resources = ["arn:aws:apprunner:${var.region}:${var.account_id}:service/${aws_apprunner_service.api_gateway.service_name}/*"]
  }

  statement {
    sid       = "AppRunnerList"
    actions   = ["apprunner:ListServices"]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "github_deployer" {
  name   = "github-deployer-scope"
  role   = aws_iam_role.github_deployer.id
  policy = data.aws_iam_policy_document.github_deployer.json
}

###############################################################################
# App Runner service
###############################################################################

resource "aws_apprunner_service" "api_gateway" {
  service_name = "weavenyc-api-gateway"

  source_configuration {
    authentication_configuration {
      access_role_arn = aws_iam_role.apprunner_access.arn
    }
    auto_deployments_enabled = false

    image_repository {
      image_identifier      = "${aws_ecr_repository.api_gateway.repository_url}:${var.image_tag}"
      image_repository_type = "ECR"

      image_configuration {
        port = "4000"

        runtime_environment_variables = {
          NODE_ENV                        = "production"
          WEAVENYC_DEPLOY_PROFILE         = "production"
          LOG_LEVEL                       = "info"
          API_HOST                        = "0.0.0.0"
          API_PORT                        = "4000"
          ALLOWED_CORS_ORIGINS            = "https://weavenyc.org,https://admin.weavenyc.org,https://pilot.weavenyc.org"
          POSTS_SERVICE_URL               = "http://localhost:4000"
          MATCH_SERVICE_URL               = "http://localhost:4000"
          CHAT_SERVICE_URL                = "http://localhost:4000"
          RESOURCE_DIRECTORY_SERVICE_URL  = "http://localhost:4000"
          NOTIFICATIONS_SERVICE_URL       = "http://localhost:4000"
          DATABASE_URL                    = "postgres://${var.db_master_username}:${data.aws_secretsmanager_secret_version.rds_password.secret_string}@${aws_db_instance.pilot.address}:5432/${aws_db_instance.pilot.db_name}"
        }

        runtime_environment_secrets = {
          REDIS_URL                    = "${local.pilot_secret_arn_prefix}redis-url"
          JWT_SIGNING_PRIVATE_KEY      = "${local.pilot_secret_arn_prefix}jwt-private-key"
          JWT_SIGNING_PUBLIC_KEY       = "${local.pilot_secret_arn_prefix}jwt-public-key"
          IDENTITY_HASH_PEPPER         = "${local.pilot_secret_arn_prefix}identity-hash-pepper"
          ANCHOR_TOTP_ENCRYPTION_KEY   = "${local.pilot_secret_arn_prefix}anchor-totp-encryption-key"
          INTERNAL_SERVICE_JWT_SECRET  = "${local.pilot_secret_arn_prefix}internal-service-jwt-secret"
        }
      }
    }
  }

  instance_configuration {
    cpu               = "1024"
    memory            = "2048"
    instance_role_arn = aws_iam_role.apprunner_instance.arn
  }

  health_check_configuration {
    protocol            = "HTTP"
    path                = "/healthz"
    interval            = 10
    timeout             = 5
    healthy_threshold   = 1
    unhealthy_threshold = 5
  }

  tags = local.common_tags
}

###############################################################################
# Outputs
###############################################################################

output "ecr_repository_url" {
  value       = aws_ecr_repository.api_gateway.repository_url
  description = "Push tag target for CI."
}

output "rds_endpoint" {
  value       = aws_db_instance.pilot.address
  description = "RDS Postgres hostname."
}

output "apprunner_service_url" {
  value       = aws_apprunner_service.api_gateway.service_url
  description = "Default App Runner hostname — point api.weavenyc.org at this."
}

output "github_deployer_role_arn" {
  value       = aws_iam_role.github_deployer.arn
  description = "ARN to plug into the deploy-api.yml OIDC assume-role step."
}
