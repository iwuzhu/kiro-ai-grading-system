# AI Grading System - AWS ElastiCache Redis Configuration
# Manages Redis cluster for caching and session management

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

variable "node_type" {
  type    = string
  default = "cache.t3.small"
}

variable "num_cache_nodes" {
  type    = number
  default = 2
}

variable "engine_version" {
  type    = string
  default = "7.0"
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

variable "redis_password" {
  type      = string
  sensitive = true
}

# ElastiCache Security Group
resource "aws_security_group" "redis" {
  name        = "grading-system-redis-sg"
  description = "Security group for AI Grading System Redis"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [var.ecs_security_group_id]
    description     = "Redis from ECS"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "All outbound traffic"
  }

  tags = {
    Name        = "grading-system-redis-sg"
    Environment = var.environment
  }
}

# ElastiCache Subnet Group
resource "aws_elasticache_subnet_group" "grading" {
  name       = "grading-system-redis-subnet-group"
  subnet_ids = var.subnet_ids

  tags = {
    Environment = var.environment
  }
}

# ElastiCache Parameter Group
resource "aws_elasticache_parameter_group" "grading" {
  family = "redis7"
  name   = "grading-system-redis-params"

  # Eviction policy: Remove least recently used keys
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  # Persistence settings
  parameter {
    name  = "appendonly"
    value = "yes"
  }

  parameter {
    name  = "appendfsync"
    value = "everysec"
  }

  # Timeout for idle connections
  parameter {
    name  = "timeout"
    value = "300"
  }

  # TCP keepalive
  parameter {
    name  = "tcp-keepalive"
    value = "60"
  }

  # Slow log
  parameter {
    name  = "slowlog-log-slower-than"
    value = "10000"
  }

  parameter {
    name  = "slowlog-max-len"
    value = "128"
  }

  tags = {
    Environment = var.environment
  }
}

# KMS Key for encryption
resource "aws_kms_key" "redis" {
  description             = "KMS key for AI Grading System Redis encryption"
  deletion_window_in_days = 10
  enable_key_rotation     = true

  tags = {
    Environment = var.environment
  }
}

resource "aws_kms_alias" "redis" {
  name          = "alias/grading-system-redis"
  target_key_id = aws_kms_key.redis.key_id
}

# ElastiCache Replication Group (Redis Cluster)
resource "aws_elasticache_replication_group" "grading" {
  replication_group_description = "Redis cluster for AI Grading System"
  engine                        = "redis"
  engine_version                = var.engine_version
  node_type                     = var.node_type
  num_cache_clusters            = var.num_cache_nodes
  parameter_group_name          = aws_elasticache_parameter_group.grading.name
  port                          = 6379
  subnet_group_name             = aws_elasticache_subnet_group.grading.name
  security_group_ids            = [aws_security_group.redis.id]

  # Authentication
  auth_token                      = var.redis_password
  auth_token_update_strategy      = "ROTATE"
  transit_encryption_enabled      = true
  transit_encryption_mode         = "preferred"
  at_rest_encryption_enabled      = true
  kms_key_id                      = aws_kms_key.redis.arn

  # Automatic failover
  automatic_failover_enabled = true
  multi_az_enabled          = true

  # Backup and snapshots
  snapshot_retention_limit = 5
  snapshot_window          = "03:00-05:00"
  snapshot_name            = "grading-system-redis-snapshot"

  # Notifications
  notification_topic_arn = "" # Set SNS topic ARN if needed

  # Maintenance window
  maintenance_window = "sun:05:00-sun:06:00"
  auto_minor_version_upgrade = true

  # Logging
  log_delivery_configuration {
    destination      = "" # Set CloudWatch log group
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "slow-log"
    enabled          = true
  }

  log_delivery_configuration {
    destination      = "" # Set CloudWatch log group
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "engine-log"
    enabled          = true
  }

  tags = {
    Name        = "grading-system-redis"
    Environment = var.environment
    Application = "ai-grading-system"
  }

  depends_on = [
    aws_elasticache_subnet_group.grading,
    aws_elasticache_parameter_group.grading
  ]
}

# CloudWatch Alarms for Redis
resource "aws_cloudwatch_metric_alarm" "redis_cpu" {
  alarm_name          = "grading-system-redis-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 75
  alarm_description   = "Alert when Redis CPU exceeds 75%"

  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.grading.id
  }
}

resource "aws_cloudwatch_metric_alarm" "redis_memory" {
  alarm_name          = "grading-system-redis-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 85
  alarm_description   = "Alert when Redis memory usage exceeds 85%"

  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.grading.id
  }
}

resource "aws_cloudwatch_metric_alarm" "redis_evictions" {
  alarm_name          = "grading-system-redis-evictions-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Evictions"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Sum"
  threshold           = 100
  alarm_description   = "Alert when Redis evictions exceed 100 in 5 minutes"

  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.grading.id
  }
}

resource "aws_cloudwatch_metric_alarm" "redis_swap" {
  alarm_name          = "grading-system-redis-swap-usage"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "SwapUsage"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Maximum"
  threshold           = 52428800 # 50 MB
  alarm_description   = "Alert when Redis swap usage exceeds 50MB"

  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.grading.id
  }
}

resource "aws_cloudwatch_metric_alarm" "redis_connection_count" {
  alarm_name          = "grading-system-redis-connections-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CurrConnections"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 800
  alarm_description   = "Alert when current Redis connections exceed 800"

  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.grading.id
  }
}

# CloudWatch Dashboard for Redis
resource "aws_cloudwatch_dashboard" "redis" {
  dashboard_name = "grading-system-redis"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/ElastiCache", "CPUUtilization", { stat = "Average" }],
            [".", "DatabaseMemoryUsagePercentage", { stat = "Average" }],
            [".", "Evictions", { stat = "Sum" }],
            [".", "CurrConnections", { stat = "Average" }]
          ]
          period = 300
          stat   = "Average"
          region = data.aws_region.current.name
          title  = "Redis Cluster Metrics"
        }
      }
    ]
  })
}

# Data source for current region
data "aws_region" "current" {}

# Outputs
output "redis_endpoint" {
  value       = aws_elasticache_replication_group.grading.primary_endpoint_address
  description = "Redis primary endpoint address"
}

output "redis_port" {
  value       = aws_elasticache_replication_group.grading.port
  description = "Redis port"
}

output "redis_configuration_endpoint" {
  value       = aws_elasticache_replication_group.grading.configuration_endpoint_address
  description = "Redis configuration endpoint for cluster mode"
}

output "security_group_id" {
  value       = aws_security_group.redis.id
  description = "Redis security group ID"
}

output "replication_group_id" {
  value       = aws_elasticache_replication_group.grading.id
  description = "ElastiCache replication group ID"
}
