# AI Grading System - Infrastructure & DevOps Guide

## Overview

This directory contains all infrastructure-as-code (IaC) and DevOps configurations for the AI Grading System deployment on AWS. It includes Docker containerization, Terraform configurations, backup/recovery procedures, CI/CD pipelines, and monitoring setup.

## Directory Structure

```
infrastructure/
├── README.md                           # This file
├── Dockerfile                          # Multi-stage Docker build
├── docker-compose.yml                  # Local development environment
├── .dockerignore                       # Docker build exclusions
├── ecs-task-definition.json           # AWS ECS task definition
├── rds.tf                             # RDS PostgreSQL configuration
├── elasticache.tf                     # ElastiCache Redis configuration
├── s3.tf                              # S3 bucket and policies
├── secrets-manager.tf                 # AWS Secrets Manager setup
├── monitoring.tf                      # CloudWatch monitoring & alerts
├── .github/workflows/ci-cd.yml        # GitHub Actions CI/CD pipeline
├── backup-database.sh                 # PostgreSQL backup script
├── restore-database.sh                # PostgreSQL restore script
├── BACKUP_RECOVERY_PROCEDURES.md      # Backup/recovery documentation
└── s3-lifecycle-policy.json           # S3 lifecycle rules
```

## Quick Start

### Local Development

#### 1. Start Local Environment with Docker Compose

```bash
cd ../
docker-compose up -d
```

This starts:
- PostgreSQL database (port 5432)
- Redis cache (port 6379)
- NestJS API (port 3000)
- pgAdmin (port 5050) - Database management UI
- Redis Commander (port 8081) - Redis management UI

#### 2. Access Services

```bash
# API Health Check
curl http://localhost:3000/health

# Database Admin (pgAdmin)
open http://localhost:5050
# Email: admin@example.com, Password: admin

# Redis Admin (Redis Commander)
open http://localhost:8081
```

### Production Deployment

#### 1. Prerequisites

- AWS Account with appropriate permissions
- Terraform >= 1.0
- AWS CLI v2 configured
- GitHub repository with secrets configured

#### 2. Configure Terraform Variables

Create `terraform.tfvars`:

```hcl
environment         = "production"
db_instance_class   = "db.t3.small"
allocated_storage   = 100
db_password         = "complex_password_123"
redis_password      = "redis_password_123"
jwt_secret          = "jwt_secret_min_32_chars_required_here"
jwt_refresh_secret  = "refresh_secret_min_32_chars_required_here"
encryption_key      = "encryption_key_min_32_chars_required_here"
aws_access_key_id   = "AKIAIOSFODNN7EXAMPLE"
aws_secret_access_key = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
openai_api_key      = "sk-..."
anthropic_api_key   = "sk-ant-..."
vpc_id              = "vpc-12345678"
subnet_ids          = ["subnet-123", "subnet-456"]
ecs_security_group_id = "sg-12345678"
ecs_task_role_arn   = "arn:aws:iam::123456789:role/ecsTaskRole"
ecs_cluster_name    = "grading-prod"
ecs_service_name    = "grading-api"
rds_instance_id     = "grading-system-prod"
redis_replication_group_id = "grading-system-redis"
slack_webhook_url   = "https://hooks.slack.com/services/..."
email_alerts        = ["ops@example.com"]
```

#### 3. Initialize and Apply Terraform

```bash
# Initialize Terraform
terraform init

# Plan deployment
terraform plan -out=tfplan

# Apply infrastructure
terraform apply tfplan

# Save outputs
terraform output -json > outputs.json
```

#### 4. Push Docker Image to ECR

```bash
# Get ECR login token
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Build and push image
docker build -t ai-grading-system:latest backend/
docker tag ai-grading-system:latest ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/ai-grading-system:latest
docker push ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/ai-grading-system:latest
```

#### 5. Deploy to ECS

```bash
# Update task definition with latest image
aws ecs register-task-definition \
  --cli-input-json file://infrastructure/ecs-task-definition.json

# Update service
aws ecs update-service \
  --cluster grading-prod \
  --service grading-api \
  --force-new-deployment
```

## Configuration

### Environment Variables

Key environment variables used throughout the system:

```bash
# Application
NODE_ENV=production
APP_PORT=3000
APP_NAME="AI Grading System"
LOG_LEVEL=info

# Database
DB_HOST=grading-system-prod.xxxxx.us-east-1.rds.amazonaws.com
DB_PORT=5432
DB_USERNAME=grading_admin
DB_PASSWORD=<from-secrets-manager>
DB_NAME=grading_system

# Cache
REDIS_HOST=grading-system-redis.xxxxx.ng.0001.use1.cache.amazonaws.com
REDIS_PORT=6379
REDIS_PASSWORD=<from-secrets-manager>

# Authentication
JWT_SECRET=<from-secrets-manager>
JWT_EXPIRATION=3600
JWT_REFRESH_SECRET=<from-secrets-manager>
JWT_REFRESH_EXPIRATION=2592000

# Encryption
ENCRYPTION_KEY=<from-secrets-manager>

# AI Providers
OPENAI_API_KEY=<from-secrets-manager>
ANTHROPIC_API_KEY=<from-secrets-manager>
AWS_REGION=us-east-1

# S3
S3_BUCKET=grading-system-storage-prod
S3_REGION=us-east-1

# CORS
CORS_ORIGIN=https://grading.example.com,https://admin.example.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### Secrets Management

All sensitive credentials are stored in AWS Secrets Manager under the `/grading/production/` namespace:

```bash
/grading/production/db-host
/grading/production/db-password
/grading/production/db-username
/grading/production/redis-password
/grading/production/jwt-secret
/grading/production/jwt-refresh-secret
/grading/production/encryption-key
/grading/production/openai-api-key
/grading/production/anthropic-api-key
/grading/production/aws-access-key-id
/grading/production/aws-secret-access-key
```

To retrieve a secret:

```bash
aws secretsmanager get-secret-value \
  --secret-id /grading/production/db-password \
  --query SecretString \
  --output text
```

## Backup & Recovery

### Automated Backups

Database backups run daily at 2:00 AM UTC:

```bash
# Setup cron job (on EC2 or Lambda)
0 2 * * * /path/to/infrastructure/backup-database.sh
```

Backups are stored in S3 with lifecycle policies:
- Daily: 30 days retention (tiered storage)
- Weekly: 84 days retention (Glacier)

### Restore from Backup

```bash
# List available backups
aws s3 ls s3://grading-system-backups/daily/ --recursive

# Restore to new database
./infrastructure/restore-database.sh grading_system_backup_20240115_020000.sql.gz grading_system_restored

# Verify restore
psql -h localhost -d grading_system_restored -c "SELECT COUNT(*) FROM submissions;"

# Promote to production
psql -U postgres -d postgres -c \
  "ALTER DATABASE grading_system RENAME TO grading_system_old; \
   ALTER DATABASE grading_system_restored RENAME TO grading_system;"
```

See [BACKUP_RECOVERY_PROCEDURES.md](./BACKUP_RECOVERY_PROCEDURES.md) for detailed procedures.

## Monitoring & Alerting

### CloudWatch Dashboards

View system metrics at:
https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=grading-system-main

Key metrics monitored:
- API response time (p50, p95, p99)
- Error rates (4xx, 5xx)
- Database CPU, connections, latency
- Cache hit/miss rates
- ECS task CPU/memory

### Alerts

Critical alerts are sent to:
- **Slack**: For real-time notifications
- **Email**: For backup notifications
- **PagerDuty**: For on-call escalations (optional)

Alert thresholds:
- API error rate > 5%
- Database CPU > 80%
- Database memory < 256MB
- Cache memory > 85%
- Response time > 2 seconds

### Logs

Application logs are streamed to CloudWatch:

```bash
# View recent logs
aws logs tail /ecs/ai-grading-system --follow

# Filter by error
aws logs filter-log-events \
  --log-group-name /ecs/ai-grading-system \
  --filter-pattern "ERROR"

# Export logs for analysis
aws logs create-export-task \
  --log-group-name /ecs/ai-grading-system \
  --from 1609459200000 \
  --to 1609545600000 \
  --destination grading-system-logs \
  --destination-prefix logs/export
```

## CI/CD Pipeline

### GitHub Actions Workflow

The CI/CD pipeline is defined in `.github/workflows/ci-cd.yml` and includes:

1. **Test Stage**
   - Run linter (ESLint)
   - Run unit tests (Jest)
   - Check coverage (>80% required)
   - Run integration tests

2. **Build Stage**
   - Build Docker image (multi-stage)
   - Push to Amazon ECR
   - Tag with git SHA and 'latest'

3. **Deploy Stage**
   - Update ECS task definition
   - Deploy to ECS cluster
   - Wait for service stability

4. **Rollback Stage** (on failure)
   - Revert to previous task definition
   - Send Slack notification

### Required GitHub Secrets

```bash
AWS_ACCOUNT_ID              # AWS Account ID
AWS_ROLE_TO_ASSUME          # GitHub Actions IAM role ARN
SLACK_WEBHOOK               # Slack webhook URL for notifications
SONAR_HOST_URL             # SonarQube host (optional)
SONAR_TOKEN                # SonarQube token (optional)
PAGERDUTY_ROUTING_KEY      # PagerDuty integration key (optional)
```

### Trigger Deployment

Deployments are triggered automatically:
- On merge to `main` branch (deploy to production)
- Manual trigger via GitHub Actions UI

## Troubleshooting

### ECS Task Won't Start

```bash
# Check task logs
aws ecs describe-tasks \
  --cluster grading-prod \
  --tasks arn:aws:ecs:us-east-1:123456789:task/grading-prod/abc123 \
  --query 'tasks[0].[lastStatus,stoppedReason]'

# View container logs
aws logs tail /ecs/ai-grading-system --follow
```

### Database Connection Issues

```bash
# Test RDS connectivity
psql -h grading-system-prod.xxxxx.rds.amazonaws.com \
  -U grading_admin -d grading_system -c "SELECT 1;"

# Check security group rules
aws ec2 describe-security-groups --group-ids sg-12345678
```

### Redis Connection Issues

```bash
# Test ElastiCache connectivity
redis-cli -h grading-system-redis.xxxxx.cache.amazonaws.com \
  -p 6379 -a <password> ping

# Check available memory
redis-cli -h grading-system-redis.xxxxx.cache.amazonaws.com \
  -p 6379 -a <password> INFO memory
```

### Deploy Rollback

```bash
# View deployment history
aws ecs describe-services \
  --cluster grading-prod \
  --services grading-api \
  --query 'services[0].deployments'

# Revert to previous version
aws ecs update-service \
  --cluster grading-prod \
  --service grading-api \
  --task-definition grading-api:123 \
  --force-new-deployment
```

## Performance Tuning

### Database

```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- View slow queries
SELECT query, mean_exec_time FROM pg_stat_statements 
  WHERE mean_exec_time > 1000 
  ORDER BY mean_exec_time DESC LIMIT 10;

-- Analyze query plans
EXPLAIN ANALYZE SELECT * FROM submissions WHERE status = 'GRADED';
```

### Cache

```bash
# Monitor cache hit rate
redis-cli --stat

# Check memory usage
redis-cli INFO memory

# Identify large keys
redis-cli --bigkeys
```

### API

- Use caching headers (Cache-Control, ETag)
- Implement pagination for large result sets
- Compress responses (gzip)
- Connection pooling on database

## Security Best Practices

1. **Secrets Management**
   - Never commit secrets to version control
   - Rotate secrets regularly (30-day policy enabled)
   - Use IAM roles instead of credentials when possible

2. **Network Security**
   - Restrict security group rules to required CIDR blocks
   - Enable VPC encryption in transit (TLS 1.2+)
   - Use private subnets for database and cache

3. **Data Protection**
   - Enable encryption at rest (KMS)
   - Enable encryption in transit (TLS)
   - Enable versioning on S3 buckets
   - Enable MFA delete protection (optional)

4. **Audit & Compliance**
   - Enable CloudTrail for API audit logging
   - Enable CloudWatch logging for all resources
   - Maintain immutable audit logs
   - Regular security assessments

5. **Access Control**
   - Use IAM roles and policies (least privilege)
   - Enable MFA for AWS Console access
   - Implement database RLS policies
   - Restrict Secrets Manager access

## Cost Optimization

### Reserved Instances

Purchase 1-3 year reservations for:
- RDS instances (20-40% savings)
- ElastiCache nodes (15-25% savings)

### Storage Optimization

- Use S3 lifecycle policies to transition old data to Glacier
- Enable compression for backups
- Clean up old log files regularly

### Monitoring Costs

```bash
# Get cost estimate for running resources
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity DAILY \
  --metrics UnblendedCost \
  --group-by Type=DIMENSION,Key=SERVICE
```

## References

- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [AWS RDS Documentation](https://docs.aws.amazon.com/rds/)
- [AWS ElastiCache Documentation](https://docs.aws.amazon.com/elasticache/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest)
- [Docker Documentation](https://docs.docker.com/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

## Support & Escalation

- **Deployment Issues**: Contact DevOps team
- **Performance Issues**: Contact DBA team
- **Security Concerns**: Contact Security team
- **Production Incident**: Page on-call engineer

## Change Log

- 2024-01-15: Initial infrastructure setup
- 2024-01-20: Added monitoring and alerting
- 2024-02-01: Enhanced backup retention policies
