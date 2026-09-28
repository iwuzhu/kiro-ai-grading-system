# AI Grading System - AWS Secrets Manager Configuration
# Manages secrets for database credentials, API keys, and encryption keys

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Variables
variable "environment" {
  type    = string
  default = "production"
}

variable "db_host" {
  type = string
}

variable "db_port" {
  type    = number
  default = 5432
}

variable "db_username" {
  type = string
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "db_name" {
  type = string
}

variable "redis_host" {
  type = string
}

variable "redis_port" {
  type    = number
  default = 6379
}

variable "redis_password" {
  type      = string
  sensitive = true
}

variable "jwt_secret" {
  type      = string
  sensitive = true
}

variable "jwt_refresh_secret" {
  type      = string
  sensitive = true
}

variable "encryption_key" {
  type      = string
  sensitive = true
}

variable "openai_api_key" {
  type      = string
  sensitive = true
  default   = ""
}

variable "anthropic_api_key" {
  type      = string
  sensitive = true
  default   = ""
}

variable "aws_access_key_id" {
  type      = string
  sensitive = true
}

variable "aws_secret_access_key" {
  type      = string
  sensitive = true
}

variable "ecs_task_role_arn" {
  type = string
}

# Data sources
data "aws_caller_identity" "current" {}

# Database Host Secret
resource "aws_secretsmanager_secret" "db_host" {
  name                    = "/grading/${var.environment}/db-host"
  description             = "RDS database host for AI Grading System"
  recovery_window_in_days = 7

  tags = {
    Environment = var.environment
    Component   = "database"
  }
}

resource "aws_secretsmanager_secret_version" "db_host" {
  secret_id       = aws_secretsmanager_secret.db_host.id
  secret_string   = var.db_host
  version_stages = ["AWSCURRENT"]
}

# Database Port Secret
resource "aws_secretsmanager_secret" "db_port" {
  name                    = "/grading/${var.environment}/db-port"
  description             = "RDS database port"
  recovery_window_in_days = 7

  tags = {
    Environment = var.environment
    Component   = "database"
  }
}

resource "aws_secretsmanager_secret_version" "db_port" {
  secret_id       = aws_secretsmanager_secret.db_port.id
  secret_string   = tostring(var.db_port)
  version_stages = ["AWSCURRENT"]
}

# Database Username Secret
resource "aws_secretsmanager_secret" "db_username" {
  name                    = "/grading/${var.environment}/db-username"
  description             = "RDS database username"
  recovery_window_in_days = 7

  tags = {
    Environment = var.environment
    Component   = "database"
  }
}

resource "aws_secretsmanager_secret_version" "db_username" {
  secret_id       = aws_secretsmanager_secret.db_username.id
  secret_string   = var.db_username
  version_stages = ["AWSCURRENT"]
}

# Database Password Secret
resource "aws_secretsmanager_secret" "db_password" {
  name                    = "/grading/${var.environment}/db-password"
  description             = "RDS database password"
  recovery_window_in_days = 7

  tags = {
    Environment = var.environment
    Component   = "database"
  }
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id       = aws_secretsmanager_secret.db_password.id
  secret_string   = var.db_password
  version_stages = ["AWSCURRENT"]
}

# Database Name Secret
resource "aws_secretsmanager_secret" "db_name" {
  name                    = "/grading/${var.environment}/db-name"
  description             = "RDS database name"
  recovery_window_in_days = 7

  tags = {
    Environment = var.environment
    Component   = "database"
  }
}

resource "aws_secretsmanager_secret_version" "db_name" {
  secret_id       = aws_secretsmanager_secret.db_name.id
  secret_string   = var.db_name
  version_stages = ["AWSCURRENT"]
}

# Redis Host Secret
resource "aws_secretsmanager_secret" "redis_host" {
  name                    = "/grading/${var.environment}/redis-host"
  description             = "ElastiCache Redis host"
  recovery_window_in_days = 7

  tags = {
    Environment = var.environment
    Component   = "cache"
  }
}

resource "aws_secretsmanager_secret_version" "redis_host" {
  secret_id       = aws_secretsmanager_secret.redis_host.id
  secret_string   = var.redis_host
  version_stages = ["AWSCURRENT"]
}

# Redis Port Secret
resource "aws_secretsmanager_secret" "redis_port" {
  name                    = "/grading/${var.environment}/redis-port"
  description             = "ElastiCache Redis port"
  recovery_window_in_days = 7

  tags = {
    Environment = var.environment
    Component   = "cache"
  }
}

resource "aws_secretsmanager_secret_version" "redis_port" {
  secret_id       = aws_secretsmanager_secret.redis_port.id
  secret_string   = tostring(var.redis_port)
  version_stages = ["AWSCURRENT"]
}

# Redis Password Secret
resource "aws_secretsmanager_secret" "redis_password" {
  name                    = "/grading/${var.environment}/redis-password"
  description             = "ElastiCache Redis password"
  recovery_window_in_days = 7

  tags = {
    Environment = var.environment
    Component   = "cache"
  }
}

resource "aws_secretsmanager_secret_version" "redis_password" {
  secret_id       = aws_secretsmanager_secret.redis_password.id
  secret_string   = var.redis_password
  version_stages = ["AWSCURRENT"]
}

# JWT Secret
resource "aws_secretsmanager_secret" "jwt_secret" {
  name                    = "/grading/${var.environment}/jwt-secret"
  description             = "JWT signing secret for access tokens"
  recovery_window_in_days = 7

  tags = {
    Environment = var.environment
    Component   = "authentication"
  }
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id       = aws_secretsmanager_secret.jwt_secret.id
  secret_string   = var.jwt_secret
  version_stages = ["AWSCURRENT"]
}

# JWT Refresh Secret
resource "aws_secretsmanager_secret" "jwt_refresh_secret" {
  name                    = "/grading/${var.environment}/jwt-refresh-secret"
  description             = "JWT signing secret for refresh tokens"
  recovery_window_in_days = 7

  tags = {
    Environment = var.environment
    Component   = "authentication"
  }
}

resource "aws_secretsmanager_secret_version" "jwt_refresh_secret" {
  secret_id       = aws_secretsmanager_secret.jwt_refresh_secret.id
  secret_string   = var.jwt_refresh_secret
  version_stages = ["AWSCURRENT"]
}

# Encryption Key Secret
resource "aws_secretsmanager_secret" "encryption_key" {
  name                    = "/grading/${var.environment}/encryption-key"
  description             = "AES-256 encryption key for sensitive data at rest"
  recovery_window_in_days = 7

  tags = {
    Environment = var.environment
    Component   = "security"
  }
}

resource "aws_secretsmanager_secret_version" "encryption_key" {
  secret_id       = aws_secretsmanager_secret.encryption_key.id
  secret_string   = var.encryption_key
  version_stages = ["AWSCURRENT"]
}

# OpenAI API Key Secret
resource "aws_secretsmanager_secret" "openai_api_key" {
  count                   = var.openai_api_key != "" ? 1 : 0
  name                    = "/grading/${var.environment}/openai-api-key"
  description             = "OpenAI API key for GPT-4 grading"
  recovery_window_in_days = 7

  tags = {
    Environment = var.environment
    Component   = "ai-providers"
  }
}

resource "aws_secretsmanager_secret_version" "openai_api_key" {
  count             = var.openai_api_key != "" ? 1 : 0
  secret_id         = aws_secretsmanager_secret.openai_api_key[0].id
  secret_string     = var.openai_api_key
  version_stages   = ["AWSCURRENT"]
}

# Anthropic API Key Secret
resource "aws_secretsmanager_secret" "anthropic_api_key" {
  count                   = var.anthropic_api_key != "" ? 1 : 0
  name                    = "/grading/${var.environment}/anthropic-api-key"
  description             = "Anthropic API key for Claude grading"
  recovery_window_in_days = 7

  tags = {
    Environment = var.environment
    Component   = "ai-providers"
  }
}

resource "aws_secretsmanager_secret_version" "anthropic_api_key" {
  count             = var.anthropic_api_key != "" ? 1 : 0
  secret_id         = aws_secretsmanager_secret.anthropic_api_key[0].id
  secret_string     = var.anthropic_api_key
  version_stages   = ["AWSCURRENT"]
}

# AWS Access Key ID Secret
resource "aws_secretsmanager_secret" "aws_access_key_id" {
  name                    = "/grading/${var.environment}/aws-access-key-id"
  description             = "AWS access key ID for S3 and Bedrock access"
  recovery_window_in_days = 7

  tags = {
    Environment = var.environment
    Component   = "aws-credentials"
  }
}

resource "aws_secretsmanager_secret_version" "aws_access_key_id" {
  secret_id       = aws_secretsmanager_secret.aws_access_key_id.id
  secret_string   = var.aws_access_key_id
  version_stages = ["AWSCURRENT"]
}

# AWS Secret Access Key Secret
resource "aws_secretsmanager_secret" "aws_secret_access_key" {
  name                    = "/grading/${var.environment}/aws-secret-access-key"
  description             = "AWS secret access key for S3 and Bedrock access"
  recovery_window_in_days = 7

  tags = {
    Environment = var.environment
    Component   = "aws-credentials"
  }
}

resource "aws_secretsmanager_secret_version" "aws_secret_access_key" {
  secret_id       = aws_secretsmanager_secret.aws_secret_access_key.id
  secret_string   = var.aws_secret_access_key
  version_stages = ["AWSCURRENT"]
}

# IAM Policy for ECS Task Role to access secrets
resource "aws_iam_policy" "secrets_access" {
  name        = "grading-system-secrets-access"
  description = "Policy for ECS tasks to access secrets"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "GetSecrets"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          "arn:aws:secretsmanager:*:${data.aws_caller_identity.current.account_id}:secret:/grading/${var.environment}/*"
        ]
      },
      {
        Sid    = "DecryptSecrets"
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:ViaService" = "secretsmanager.*.amazonaws.com"
          }
        }
      }
    ]
  })
}

# Attach policy to ECS task role
resource "aws_iam_role_policy_attachment" "secrets_access" {
  role       = split("/", var.ecs_task_role_arn)[1]
  policy_arn = aws_iam_policy.secrets_access.arn
}

# Rotation configuration
resource "aws_secretsmanager_secret_rotation" "db_password_rotation" {
  secret_id           = aws_secretsmanager_secret.db_password.id
  rotation_enabled    = true
  rotation_rules {
    automatically_after_days = 30
  }
  # Note: Lambda function for rotation needs to be implemented separately
}

# Outputs
output "db_host_secret_arn" {
  value       = aws_secretsmanager_secret.db_host.arn
  description = "ARN of DB host secret"
}

output "db_password_secret_arn" {
  value       = aws_secretsmanager_secret.db_password.arn
  description = "ARN of DB password secret"
}

output "jwt_secret_arn" {
  value       = aws_secretsmanager_secret.jwt_secret.arn
  description = "ARN of JWT secret"
}

output "encryption_key_secret_arn" {
  value       = aws_secretsmanager_secret.encryption_key.arn
  description = "ARN of encryption key secret"
}

output "secrets_access_policy_arn" {
  value       = aws_iam_policy.secrets_access.arn
  description = "ARN of secrets access policy"
}
