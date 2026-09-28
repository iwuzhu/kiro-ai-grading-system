# AI Grading System - AWS RDS PostgreSQL Configuration
# Manages PostgreSQL database with Multi-AZ, automated backups, and monitoring

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

variable "db_instance_class" {
  type    = string
  default = "db.t3.small"
}

variable "allocated_storage" {
  type    = number
  default = 100
}

variable "db_name" {
  type    = string
  default = "grading_system"
}

variable "db_username" {
  type    = string
  default = "grading_admin"
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "vpc_id" {
  type = string
}

variable "subnet_ids" {
  type = list(string)
}

variable "ecs_security_group_id" {
  type = string
}

# Data source for current AWS account
data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

# RDS Security Group
resource "aws_security_group" "rds" {
  name        = "grading-system-rds-sg"
  description = "Security group for AI Grading System RDS"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.ecs_security_group_id]
    description     = "PostgreSQL from ECS"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "All outbound traffic"
  }

  tags = {
    Name        = "grading-system-rds-sg"
    Environment = var.environment
  }
}

# RDS Subnet Group
resource "aws_db_subnet_group" "grading" {
  name       = "grading-system-db-subnet-group"
  subnet_ids = var.subnet_ids

  tags = {
    Name        = "grading-system-db-subnet-group"
    Environment = var.environment
  }
}

# RDS Parameter Group
resource "aws_db_parameter_group" "grading" {
  name   = "grading-system-postgres16"
  family = "postgres16"

  # Performance tuning parameters
  parameter {
    name  = "max_connections"
    value = "500"
  }

  parameter {
    name  = "shared_buffers"
    value = "262144" # 2GB for db.t3.small
  }

  parameter {
    name  = "effective_cache_size"
    value = "524288" # 4GB
  }

  parameter {
    name  = "work_mem"
    value = "4096" # 4MB per operation
  }

  parameter {
    name  = "maintenance_work_mem"
    value = "65536" # 64MB
  }

  # Connection settings
  parameter {
    name  = "idle_in_transaction_session_timeout"
    value = "300000" # 5 minutes
  }

  # Logging for monitoring
  parameter {
    name  = "log_statement"
    value = "all"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000" # Log queries taking > 1 second
  }

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  # Row Level Security support
  parameter {
    name  = "rls_enabled"
    value = "1"
  }

  tags = {
    Environment = var.environment
  }
}

# Enhanced Monitoring Role
resource "aws_iam_role" "rds_monitoring" {
  name = "grading-system-rds-monitoring-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Environment = var.environment
  }
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# RDS PostgreSQL Instance
resource "aws_db_instance" "grading" {
  identifier = "grading-system-prod"

  # Engine configuration
  engine               = "postgres"
  engine_version       = "16.1"
  family               = "postgres16"
  instance_class       = var.db_instance_class
  allocated_storage    = var.allocated_storage
  max_allocated_storage = 1000 # Enable auto-scaling up to 1TB

  # Database configuration
  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  # Backup configuration
  backup_retention_period = 30
  backup_window           = "02:00-03:00"
  backup_compression_enabled = true
  copy_tags_to_snapshot = true

  # Maintenance window
  maintenance_window = "sun:03:00-sun:04:00"
  auto_minor_version_upgrade = true

  # High availability
  multi_az = true

  # Storage configuration
  storage_type          = "gp3"
  storage_throughput    = 125 # IOPS/throughput ratio
  iops                  = 3000
  storage_encrypted     = true
  kms_key_id           = aws_kms_key.rds.arn

  # Security
  db_subnet_group_name   = aws_db_subnet_group.grading.name
  publicly_accessible    = false
  vpc_security_group_ids = [aws_security_group.rds.id]

  # Parameters & options
  parameter_group_name = aws_db_parameter_group.grading.name

  # Monitoring
  enabled_cloudwatch_logs_exports = ["postgresql"]
  monitoring_interval             = 60
  monitoring_role_arn            = aws_iam_role.rds_monitoring.arn
  performance_insights_enabled    = true
  performance_insights_retention_period = 7

  # Snapshots
  skip_final_snapshot       = false
  final_snapshot_identifier = "grading-system-prod-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"

  # Deletion protection
  deletion_protection = true

  # Database customization
  db_parameter_group_name = aws_db_parameter_group.grading.name

  tags = {
    Name        = "grading-system-rds"
    Environment = var.environment
    Application = "ai-grading-system"
  }

  depends_on = [aws_iam_role_policy_attachment.rds_monitoring]
}

# KMS Key for encryption
resource "aws_kms_key" "rds" {
  description             = "KMS key for AI Grading System RDS encryption"
  deletion_window_in_days = 10
  enable_key_rotation     = true

  tags = {
    Environment = var.environment
  }
}

resource "aws_kms_alias" "rds" {
  name          = "alias/grading-system-rds"
  target_key_id = aws_kms_key.rds.key_id
}

# IAM Role for RDS Backup to S3
resource "aws_iam_role" "rds_backup_role" {
  name = "grading-system-rds-backup-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
      }
    ]
  })

  tags = {
    Environment = var.environment
  }
}

resource "aws_iam_role_policy" "rds_backup" {
  name = "grading-system-rds-backup-policy"
  role = aws_iam_role.rds_backup_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject"
        ]
        Resource = "arn:aws:s3:::grading-system-backups/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = "arn:aws:s3:::grading-system-backups"
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = aws_kms_key.rds.arn
      }
    ]
  })
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "grading-system-rds-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Alert when RDS CPU exceeds 80%"
  alarm_actions       = [] # Add SNS topic ARN

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.grading.id
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_storage" {
  alarm_name          = "grading-system-rds-storage-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 10737418240 # 10 GB in bytes
  alarm_description   = "Alert when RDS storage is below 10GB"
  alarm_actions       = [] # Add SNS topic ARN

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.grading.id
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_memory" {
  alarm_name          = "grading-system-rds-memory-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FreeableMemory"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 268435456 # 256 MB in bytes
  alarm_description   = "Alert when RDS available memory is below 256MB"
  alarm_actions       = [] # Add SNS topic ARN

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.grading.id
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_connections" {
  alarm_name          = "grading-system-rds-connections-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 400
  alarm_description   = "Alert when database connections exceed 400"
  alarm_actions       = [] # Add SNS topic ARN

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.grading.id
  }
}

# Outputs
output "db_endpoint" {
  value       = aws_db_instance.grading.endpoint
  description = "RDS endpoint (address:port)"
}

output "db_address" {
  value       = aws_db_instance.grading.address
  description = "RDS address only"
}

output "db_port" {
  value       = aws_db_instance.grading.port
  description = "RDS port"
}

output "db_name" {
  value       = aws_db_instance.grading.db_name
  description = "Database name"
}

output "db_username" {
  value       = aws_db_instance.grading.username
  description = "Database username"
  sensitive   = true
}

output "security_group_id" {
  value       = aws_security_group.rds.id
  description = "RDS security group ID"
}

output "backup_role_arn" {
  value       = aws_iam_role.rds_backup_role.arn
  description = "IAM role ARN for RDS backups"
}
