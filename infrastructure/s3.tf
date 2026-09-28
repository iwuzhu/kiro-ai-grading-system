# AI Grading System - AWS S3 Configuration
# Manages S3 bucket for file storage, backups, and logs

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

variable "bucket_name" {
  type    = string
  default = "grading-system-storage-prod"
}

variable "enable_versioning" {
  type    = bool
  default = true
}

variable "enable_mfa_delete" {
  type    = bool
  default = false
}

variable "ecs_role_arn" {
  type = string
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# KMS Key for S3 encryption
resource "aws_kms_key" "s3" {
  description             = "KMS key for AI Grading System S3 encryption"
  deletion_window_in_days = 10
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow S3 to use the key"
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = "*"
      },
      {
        Sid    = "Allow ECS to use the key"
        Effect = "Allow"
        Principal = {
          AWS = var.ecs_role_arn
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Environment = var.environment
  }
}

resource "aws_kms_alias" "s3" {
  name          = "alias/grading-system-s3"
  target_key_id = aws_kms_key.s3.key_id
}

# S3 Bucket for file storage and backups
resource "aws_s3_bucket" "grading" {
  bucket = var.bucket_name

  tags = {
    Name        = "grading-system-storage"
    Environment = var.environment
    Application = "ai-grading-system"
  }
}

# Block public access
resource "aws_s3_bucket_public_access_block" "grading" {
  bucket = aws_s3_bucket.grading.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Versioning for accidental deletion recovery
resource "aws_s3_bucket_versioning" "grading" {
  bucket = aws_s3_bucket.grading.id

  versioning_configuration {
    status     = var.enable_versioning ? "Enabled" : "Suspended"
    mfa_delete = var.enable_mfa_delete ? "Enabled" : "Disabled"
  }
}

# Server-side encryption (AES-256)
resource "aws_s3_bucket_server_side_encryption_configuration" "grading" {
  bucket = aws_s3_bucket.grading.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.s3.arn
    }
    bucket_key_enabled = true
  }
}

# Enable SSL/TLS only
resource "aws_s3_bucket_policy" "grading_enforce_ssl" {
  bucket = aws_s3_bucket.grading.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DenyInsecureTransport"
        Effect = "Deny"
        Principal = "*"
        Action   = "s3:*"
        Resource = [
          aws_s3_bucket.grading.arn,
          "${aws_s3_bucket.grading.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })
}

# Logging configuration for audit trail
resource "aws_s3_bucket" "logs" {
  bucket = "${var.bucket_name}-logs"

  tags = {
    Name        = "grading-system-logs"
    Environment = var.environment
  }
}

resource "aws_s3_bucket_versioning" "logs" {
  bucket = aws_s3_bucket.logs.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "logs" {
  bucket = aws_s3_bucket.logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_logging" "grading" {
  bucket = aws_s3_bucket.grading.id

  target_bucket = aws_s3_bucket.logs.id
  target_prefix = "s3-access-logs/"
}

# CloudTrail logging for API audit
resource "aws_s3_bucket_policy" "cloudtrail" {
  bucket = aws_s3_bucket.logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AWSCloudTrailAclCheck"
        Effect = "Allow"
        Principal = {
          Service = "cloudtrail.amazonaws.com"
        }
        Action   = "s3:GetBucketAcl"
        Resource = aws_s3_bucket.logs.arn
      },
      {
        Sid    = "AWSCloudTrailWrite"
        Effect = "Allow"
        Principal = {
          Service = "cloudtrail.amazonaws.com"
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.logs.arn}/*"
        Condition = {
          StringEquals = {
            "s3:x-amz-acl" = "bucket-owner-full-control"
          }
        }
      }
    ]
  })
}

# Lifecycle policy for transitions and expiration
resource "aws_s3_bucket_lifecycle_configuration" "grading" {
  bucket = aws_s3_bucket.grading.id

  rule {
    id     = "DeleteOldDailyBackups"
    status = "Enabled"

    filter {
      prefix = "daily/"
    }

    expiration {
      days = 30
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }

    transition {
      days          = 7
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 14
      storage_class = "GLACIER"
    }
  }

  rule {
    id     = "DeleteOldWeeklyBackups"
    status = "Enabled"

    filter {
      prefix = "weekly/"
    }

    expiration {
      days = 84
    }

    noncurrent_version_expiration {
      noncurrent_days = 84
    }

    transition {
      days          = 30
      storage_class = "GLACIER"
    }
  }

  rule {
    id     = "CleanupOldSubmissions"
    status = "Enabled"

    filter {
      prefix = "submissions/"
    }

    expiration {
      days = 365
    }

    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 180
      storage_class = "GLACIER"
    }
  }

  rule {
    id     = "CleanupLogsAfter30Days"
    status = "Enabled"

    filter {
      prefix = "s3-access-logs/"
    }

    expiration {
      days = 30
    }
  }
}

# CORS Configuration
resource "aws_s3_bucket_cors" "grading" {
  bucket = aws_s3_bucket.grading.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = [
      "https://grading.example.com",
      "https://admin.example.com"
    ]
    expose_headers = [
      "ETag",
      "x-amz-version-id",
      "x-amz-request-id"
    ]
    max_age_seconds = 3000
  }
}

# IAM Policy for ECS access
resource "aws_iam_policy" "s3_access" {
  name        = "grading-system-s3-access"
  description = "Policy for ECS to access S3 bucket"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3BucketAccess"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:GetObjectVersion",
          "s3:ListBucket",
          "s3:ListBucketVersions"
        ]
        Resource = [
          aws_s3_bucket.grading.arn,
          "${aws_s3_bucket.grading.arn}/*"
        ]
      },
      {
        Sid    = "KMSDecrypt"
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = aws_kms_key.s3.arn
      }
    ]
  })
}

# CloudTrail for API audit logging
resource "aws_cloudtrail" "grading" {
  name                          = "grading-system-trail"
  s3_bucket_name                = aws_s3_bucket.logs.id
  include_global_service_events = true
  is_multi_region_trail         = true
  enable_log_file_validation    = true
  depends_on                    = [aws_s3_bucket_policy.cloudtrail]

  event_selector {
    read_write_type           = "All"
    include_management_events = true

    data_resource {
      type   = "AWS::S3::Object"
      values = ["${aws_s3_bucket.grading.arn}/*"]
    }
  }

  tags = {
    Environment = var.environment
  }
}

# Outputs
output "bucket_name" {
  value       = aws_s3_bucket.grading.id
  description = "S3 bucket name"
}

output "bucket_arn" {
  value       = aws_s3_bucket.grading.arn
  description = "S3 bucket ARN"
}

output "kms_key_id" {
  value       = aws_kms_key.s3.id
  description = "KMS key ID for S3 encryption"
}

output "s3_access_policy_arn" {
  value       = aws_iam_policy.s3_access.arn
  description = "IAM policy ARN for S3 access"
}

output "logs_bucket_name" {
  value       = aws_s3_bucket.logs.id
  description = "S3 logs bucket name"
}
