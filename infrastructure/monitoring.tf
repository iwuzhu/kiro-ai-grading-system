# AI Grading System - CloudWatch Monitoring & Alerting Configuration

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

variable "slack_webhook_url" {
  type      = string
  sensitive = true
  default   = ""
}

variable "pagerduty_integration_key" {
  type      = string
  sensitive = true
  default   = ""
}

variable "email_alerts" {
  type    = list(string)
  default = []
}

variable "ecs_cluster_name" {
  type = string
}

variable "ecs_service_name" {
  type = string
}

variable "rds_instance_id" {
  type = string
}

variable "redis_replication_group_id" {
  type = string
}

# CloudWatch Log Group for application logs
resource "aws_cloudwatch_log_group" "application" {
  name              = "/ecs/ai-grading-system"
  retention_in_days = 30

  tags = {
    Environment = var.environment
  }
}

# CloudWatch Log Group for Lambda functions
resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/grading-system"
  retention_in_days = 14

  tags = {
    Environment = var.environment
  }
}

# SNS Topic for critical alerts
resource "aws_sns_topic" "critical_alerts" {
  name = "grading-system-critical-alerts"

  tags = {
    Environment = var.environment
  }
}

# SNS Topic Subscription for email (if provided)
resource "aws_sns_topic_subscription" "critical_alerts_email" {
  count     = length(var.email_alerts) > 0 ? 1 : 0
  topic_arn = aws_sns_topic.critical_alerts.arn
  protocol  = "email"
  endpoint  = var.email_alerts[0]
}

# Lambda function for Slack notifications
resource "aws_lambda_function" "slack_notifier" {
  count            = var.slack_webhook_url != "" ? 1 : 0
  filename         = "lambda-slack-notifier.zip"
  function_name    = "grading-system-slack-notifier"
  role             = aws_iam_role.lambda_role[0].arn
  handler          = "index.handler"
  runtime          = "python3.11"
  source_code_hash = filebase64sha256("lambda-slack-notifier.zip")

  environment {
    variables = {
      SLACK_WEBHOOK_URL = var.slack_webhook_url
    }
  }

  timeout = 60

  tags = {
    Environment = var.environment
  }
}

# IAM Role for Lambda
resource "aws_iam_role" "lambda_role" {
  count = var.slack_webhook_url != "" ? 1 : 0
  name  = "grading-system-lambda-slack-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  count              = var.slack_webhook_url != "" ? 1 : 0
  role               = aws_iam_role.lambda_role[0].name
  policy_arn         = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# SNS Topic Subscription for Lambda (Slack notifications)
resource "aws_sns_topic_subscription" "critical_alerts_slack" {
  count     = var.slack_webhook_url != "" ? 1 : 0
  topic_arn = aws_sns_topic.critical_alerts.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.slack_notifier[0].arn
}

resource "aws_lambda_permission" "sns_invoke" {
  count         = var.slack_webhook_url != "" ? 1 : 0
  statement_id  = "AllowExecutionFromSNS"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.slack_notifier[0].function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.critical_alerts.arn
}

# ============================================================================
# API & Application Alarms
# ============================================================================

# Alarm: API Error Rate High
resource "aws_cloudwatch_metric_alarm" "api_error_rate_high" {
  alarm_name          = "grading-system-api-error-rate-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPError4xxCount"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = 50
  alarm_description   = "Alert when API 4xx error rate is high"
  alarm_actions       = [aws_sns_topic.critical_alerts.arn]

  dimensions = {
    LoadBalancer = "target-group/grading-api"
  }
}

# Alarm: API 5xx Errors
resource "aws_cloudwatch_metric_alarm" "api_5xx_errors" {
  alarm_name          = "grading-system-api-5xx-errors"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "HTTPError5xxCount"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "Alert when API returns 5xx errors"
  alarm_actions       = [aws_sns_topic.critical_alerts.arn]

  dimensions = {
    LoadBalancer = "target-group/grading-api"
  }
}

# Alarm: API Latency High
resource "aws_cloudwatch_metric_alarm" "api_latency_high" {
  alarm_name          = "grading-system-api-latency-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Average"
  threshold           = 2.0
  alarm_description   = "Alert when API average response time exceeds 2 seconds"
  alarm_actions       = [aws_sns_topic.critical_alerts.arn]

  dimensions = {
    LoadBalancer = "target-group/grading-api"
  }
}

# Alarm: ECS Task CPU High
resource "aws_cloudwatch_metric_alarm" "ecs_cpu_high" {
  alarm_name          = "grading-system-ecs-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Alert when ECS task CPU exceeds 80%"
  alarm_actions       = [aws_sns_topic.critical_alerts.arn]

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.ecs_service_name
  }
}

# Alarm: ECS Task Memory High
resource "aws_cloudwatch_metric_alarm" "ecs_memory_high" {
  alarm_name          = "grading-system-ecs-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 85
  alarm_description   = "Alert when ECS task memory exceeds 85%"
  alarm_actions       = [aws_sns_topic.critical_alerts.arn]

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.ecs_service_name
  }
}

# Alarm: ECS Task Failures
resource "aws_cloudwatch_metric_alarm" "ecs_task_failures" {
  alarm_name          = "grading-system-ecs-task-failures"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "TasksFailed"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  alarm_description   = "Alert when ECS tasks fail"
  alarm_actions       = [aws_sns_topic.critical_alerts.arn]

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.ecs_service_name
  }
}

# ============================================================================
# Database Alarms
# ============================================================================

# Alarm: RDS CPU High
resource "aws_cloudwatch_metric_alarm" "rds_cpu_high" {
  alarm_name          = "grading-system-rds-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Alert when RDS CPU exceeds 80%"
  alarm_actions       = [aws_sns_topic.critical_alerts.arn]

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_id
  }
}

# Alarm: RDS Connection Count High
resource "aws_cloudwatch_metric_alarm" "rds_connections_high" {
  alarm_name          = "grading-system-rds-connections-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 400
  alarm_description   = "Alert when RDS connections exceed 400"
  alarm_actions       = [aws_sns_topic.critical_alerts.arn]

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_id
  }
}

# Alarm: RDS Storage Low
resource "aws_cloudwatch_metric_alarm" "rds_storage_low" {
  alarm_name          = "grading-system-rds-storage-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 10737418240 # 10 GB
  alarm_description   = "Alert when RDS storage is below 10GB"
  alarm_actions       = [aws_sns_topic.critical_alerts.arn]

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_id
  }
}

# Alarm: RDS Memory Low
resource "aws_cloudwatch_metric_alarm" "rds_memory_low" {
  alarm_name          = "grading-system-rds-memory-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FreeableMemory"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 268435456 # 256 MB
  alarm_description   = "Alert when RDS available memory is below 256MB"
  alarm_actions       = [aws_sns_topic.critical_alerts.arn]

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_id
  }
}

# Alarm: RDS Read Latency High
resource "aws_cloudwatch_metric_alarm" "rds_read_latency_high" {
  alarm_name          = "grading-system-rds-read-latency-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ReadLatency"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 5.0 # 5ms
  alarm_description   = "Alert when RDS read latency exceeds 5ms"
  alarm_actions       = [aws_sns_topic.critical_alerts.arn]

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_id
  }
}

# ============================================================================
# Redis/Cache Alarms
# ============================================================================

# Alarm: Redis CPU High
resource "aws_cloudwatch_metric_alarm" "redis_cpu_high" {
  alarm_name          = "grading-system-redis-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 75
  alarm_description   = "Alert when Redis CPU exceeds 75%"
  alarm_actions       = [aws_sns_topic.critical_alerts.arn]

  dimensions = {
    ReplicationGroupId = var.redis_replication_group_id
  }
}

# Alarm: Redis Memory High
resource "aws_cloudwatch_metric_alarm" "redis_memory_high" {
  alarm_name          = "grading-system-redis-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 85
  alarm_description   = "Alert when Redis memory usage exceeds 85%"
  alarm_actions       = [aws_sns_topic.critical_alerts.arn]

  dimensions = {
    ReplicationGroupId = var.redis_replication_group_id
  }
}

# Alarm: Redis Evictions High
resource "aws_cloudwatch_metric_alarm" "redis_evictions_high" {
  alarm_name          = "grading-system-redis-evictions-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Evictions"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Sum"
  threshold           = 100
  alarm_description   = "Alert when Redis evictions exceed 100 in 5 minutes"
  alarm_actions       = [aws_sns_topic.critical_alerts.arn]

  dimensions = {
    ReplicationGroupId = var.redis_replication_group_id
  }
}

# ============================================================================
# CloudWatch Dashboard
# ============================================================================

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "grading-system-main"

  dashboard_body = jsonencode({
    widgets = [
      # API Performance
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/ApplicationELB", "TargetResponseTime", { label = "Response Time (s)" }],
            [".", "RequestCount", { label = "Request Count" }],
            [".", "HTTPError4xxCount", { label = "4xx Errors" }],
            [".", "HTTPError5xxCount", { label = "5xx Errors" }]
          ]
          period = 300
          stat   = "Average"
          region = data.aws_region.current.name
          title  = "API Performance Metrics"
          yAxis = {
            left = {
              label = "Count / Time"
            }
          }
        }
      },

      # ECS Task Resources
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/ECS", "CPUUtilization", { label = "CPU Usage %" }],
            [".", "MemoryUtilization", { label = "Memory Usage %" }]
          ]
          period = 300
          stat   = "Average"
          region = data.aws_region.current.name
          title  = "ECS Task Resources"
          dimensions = {
            ClusterName = var.ecs_cluster_name
            ServiceName = var.ecs_service_name
          }
        }
      },

      # Database Performance
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/RDS", "CPUUtilization", { label = "CPU Usage %" }],
            [".", "DatabaseConnections", { label = "Connections" }],
            [".", "ReadLatency", { label = "Read Latency (ms)" }],
            [".", "WriteLatency", { label = "Write Latency (ms)" }]
          ]
          period = 300
          stat   = "Average"
          region = data.aws_region.current.name
          title  = "Database Performance"
          dimensions = {
            DBInstanceIdentifier = var.rds_instance_id
          }
        }
      },

      # Cache Performance
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/ElastiCache", "CPUUtilization", { label = "CPU Usage %" }],
            [".", "DatabaseMemoryUsagePercentage", { label = "Memory Usage %" }],
            [".", "Evictions", { label = "Evictions" }],
            [".", "CurrConnections", { label = "Current Connections" }]
          ]
          period = 300
          stat   = "Average"
          region = data.aws_region.current.name
          title  = "Cache Performance"
          dimensions = {
            ReplicationGroupId = var.redis_replication_group_id
          }
        }
      }
    ]
  })
}

# Data source for current region
data "aws_region" "current" {}

# Outputs
output "sns_topic_arn" {
  value       = aws_sns_topic.critical_alerts.arn
  description = "SNS topic ARN for critical alerts"
}

output "log_group_name" {
  value       = aws_cloudwatch_log_group.application.name
  description = "CloudWatch log group name"
}

output "dashboard_url" {
  value       = "https://console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.name}#dashboards:name=${aws_cloudwatch_dashboard.main.dashboard_name}"
  description = "URL to CloudWatch dashboard"
}
