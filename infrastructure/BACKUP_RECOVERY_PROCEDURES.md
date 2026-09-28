# Database Backup & Recovery Procedures

## Overview

The AI Grading System implements automated PostgreSQL database backups with AWS S3 storage, featuring a comprehensive backup retention policy and recovery procedures.

## Backup Strategy

### Backup Schedule
- **Daily Backups**: 2:00 AM UTC every day
- **Weekly Backups**: Every Monday at 2:00 AM UTC (separate weekly archive)
- **Retention**:
  - Daily backups: 30 days
  - Weekly backups: 84 days (12 weeks)

### Backup Storage Classes
1. **Daily Backups** (first 7 days)
   - Storage Class: `STANDARD`
   - Cost: Highest, fastest restore
   
2. **Daily Backups** (7-14 days)
   - Storage Class: `STANDARD_IA` (Infrequent Access)
   - Cost: Lower, 30-minute restore time
   
3. **Daily Backups** (14-30 days)
   - Storage Class: `GLACIER`
   - Cost: Lowest, 1-24 hour restore time
   
4. **Weekly Backups** (first 30 days)
   - Storage Class: `STANDARD_IA`
   - Cost: Lower, faster restore option
   
5. **Weekly Backups** (30-84 days)
   - Storage Class: `GLACIER`
   - Cost: Lowest, long-term archive

### S3 Bucket Structure
```
s3://grading-system-backups/
├── daily/
│   └── {DATE}/{FILENAME}.sql.gz
├── weekly/
│   └── week_{WEEK_NUMBER}/{FILENAME}.sql.gz
```

### Backup Retention Policy

| Backup Type | Retention Period | Storage Class | Typical Size | RTO |
|---|---|---|---|---|
| Daily (0-7 days) | 7 days | STANDARD | 100-200 MB | < 5 min |
| Daily (7-14 days) | 7 days | STANDARD_IA | 100-200 MB | 30 min |
| Daily (14-30 days) | 16 days | GLACIER | 100-200 MB | 1-24 hours |
| Weekly | 84 days | GLACIER | 100-200 MB | 1-24 hours |

## Automated Backup Execution

### Setup Cron Job

```bash
# Add to /etc/crontab or use AWS Lambda for scheduled execution
0 2 * * * /path/to/scripts/backup-database.sh
```

### For AWS Environments

Use AWS EventBridge + Lambda or AWS Backup service:

```bash
# Create EventBridge rule
aws events put-rule --name grading-system-backup \
  --schedule-expression "cron(0 2 * * ? *)" \
  --state ENABLED

# Lambda function triggers backup script
```

### Environment Variables Required

```bash
export DB_HOST="prod-rds-instance.abc123.us-east-1.rds.amazonaws.com"
export DB_PORT="5432"
export DB_USERNAME="grading_user"
export DB_PASSWORD="$(aws secretsmanager get-secret-value --secret-id /grading/prod/db-password --query SecretString --output text)"
export DB_NAME="grading_system"
export S3_BUCKET="grading-system-backups"
export AWS_REGION="us-east-1"
```

## Recovery Procedures

### Pre-Recovery Checklist

Before initiating recovery:
- [ ] Verify S3 backup exists: `aws s3 ls s3://grading-system-backups/daily/`
- [ ] Confirm database connectivity
- [ ] Notify stakeholders of maintenance window
- [ ] Create backup of current database (if corrupted data scenario)
- [ ] Document start time for RTO tracking

### Full Database Recovery

**Scenario**: Database corrupted or needs rollback to previous state

1. **Identify Backup to Restore**
   ```bash
   # List available daily backups
   aws s3 ls s3://grading-system-backups/daily/ --recursive
   
   # List available weekly backups
   aws s3 ls s3://grading-system-backups/weekly/ --recursive
   ```

2. **Run Recovery Script**
   ```bash
   # Restore to a new database first
   ./restore-database.sh grading_system_backup_20240115_020000.sql.gz grading_system_restored
   ```

3. **Verify Restored Data**
   ```bash
   # Connect to restored database
   psql -h localhost -p 5432 -U grading_user -d grading_system_restored
   
   # Check table counts
   SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';
   
   # Verify recent data
   SELECT COUNT(*) FROM submissions WHERE created_at > NOW() - INTERVAL '7 days';
   ```

4. **Perform Data Validation**
   ```sql
   -- Check data integrity
   SELECT COUNT(*) FROM institutions;
   SELECT COUNT(*) FROM users;
   SELECT COUNT(*) FROM courses;
   SELECT COUNT(*) FROM assignments;
   SELECT COUNT(*) FROM submissions;
   SELECT COUNT(*) FROM grades;
   
   -- Verify constraints
   SELECT COUNT(*) FROM institutions WHERE tenant_id IS NULL;
   ```

5. **Switch to Restored Database**
   ```bash
   # Option A: If current DB is corrupted, rename restored
   psql -U postgres -d postgres -c \
     "ALTER DATABASE grading_system RENAME TO grading_system_corrupted;"
   psql -U postgres -d postgres -c \
     "ALTER DATABASE grading_system_restored RENAME TO grading_system;"
   
   # Option B: If validation failed, drop restored
   psql -U postgres -d postgres -c "DROP DATABASE grading_system_restored;"
   ```

6. **Restart Application Services**
   ```bash
   # Restart ECS tasks
   aws ecs update-service --cluster grading-prod --service grading-api \
     --force-new-deployment
   
   # Or restart local services
   docker-compose restart api
   ```

7. **Post-Recovery Validation**
   ```bash
   # Check API health
   curl -s http://localhost:3000/health | jq .
   
   # Verify database connection
   psql -h localhost -p 5432 -U grading_user -d grading_system -c "SELECT 1;"
   
   # Check recent submissions
   curl -s -H "Authorization: Bearer $TOKEN" \
     http://localhost:3000/api/v1/institutions/123/submissions?limit=5 | jq .
   ```

### Partial Recovery (Single Table)

**Scenario**: Single table corrupted, need to restore just that table

```bash
# 1. Get specific table from backup
pg_restore -h localhost -p 5432 -U grading_user \
  -d grading_system --table=submissions \
  /tmp/grading_system_backup_20240115_020000.sql.gz

# 2. Verify table restore
psql -U grading_user -d grading_system -c \
  "SELECT COUNT(*) FROM submissions;"
```

### Point-in-Time Recovery (PITR)

**Scenario**: Restore to a specific point in time before data loss

Requires WAL archiving enabled:

```bash
# Configure WAL archiving to S3
# In postgresql.conf:
# wal_level = replica
# archive_mode = on
# archive_command = 'aws s3 cp pg_wal/%f s3://grading-system-backups/wal-archive/%f'

# Restore to point-in-time
pg_basebackup -D /tmp/recovery -h localhost -U grading_user --checkpoint=fast -Xstream

# Edit recovery.conf with recovery_target_time
# recovery_target_time = '2024-01-15 01:30:00'
```

## Recovery Time Objectives (RTO)

| Scenario | Backup Type | Storage Class | RTO | Instructions |
|---|---|---|---|---|
| Recent corruption (< 7 days) | Daily | STANDARD | 5-10 min | Run restore script |
| Medium-term recovery (7-30 days) | Daily | STANDARD_IA/GLACIER | 30-60 min | Request from GLACIER if needed |
| Archival recovery (> 30 days) | Weekly | GLACIER | 24+ hours | Request GLACIER restore |

## Disaster Recovery Runbook

### Major Data Loss Event

1. **Triage (5 minutes)**
   - Identify exact time of data loss
   - Determine which data is affected
   - Estimate recovery timeline

2. **Prepare (10 minutes)**
   - Select appropriate backup
   - Provision temporary database instance if needed
   - Review recovery script prerequisites

3. **Execute Recovery (15-30 minutes)**
   - Run restore script
   - Monitor restoration progress
   - Document backup used and recovery time

4. **Validate (15 minutes)**
   - Check table counts match expectations
   - Spot-check critical data
   - Run integrity checks

5. **Restore Services (5 minutes)**
   - Switch DNS/load balancer if needed
   - Restart application services
   - Monitor application logs

6. **Post-Incident (30 minutes)**
   - Document what happened
   - Verify all services operational
   - Update incident report

### Total Time to Recovery: ~90 minutes (for recent backups)

## Monitoring & Alerting

### CloudWatch Metrics to Monitor
- Backup job success/failure
- Backup file size
- S3 upload time
- Database growth rate

### Alerts to Configure
```bash
# Alert if backup fails
aws cloudwatch put-metric-alarm \
  --alarm-name backup-failure \
  --alarm-description "Alert when database backup fails" \
  --metric-name BackupStatus \
  --namespace AWS/RDS \
  --statistic Average \
  --period 3600 \
  --threshold 1 \
  --comparison-operator LessThanThreshold
```

## Best Practices

1. **Regular Restore Testing**
   - Test restore procedure monthly
   - Document any issues found
   - Update procedures as needed

2. **Backup Verification**
   - Always verify backup file integrity
   - Check S3 bucket versioning enabled
   - Monitor backup storage costs

3. **Access Control**
   - Limit S3 bucket access to authorized users
   - Use IAM roles for backup automation
   - Enable bucket versioning for protection

4. **Documentation**
   - Keep runbooks up-to-date
   - Document any custom procedures
   - Train team on recovery procedures

5. **Compliance**
   - Maintain audit logs of backup operations
   - Ensure backups meet retention requirements
   - Document backup locations and retention

## Troubleshooting

### Backup Upload Fails to S3
```bash
# Check AWS credentials
aws s3 ls s3://grading-system-backups/

# Check IAM permissions
aws iam get-user --user-name backup-service

# Verify S3 bucket exists and is accessible
aws s3api head-bucket --bucket grading-system-backups --region us-east-1
```

### Recovery Fails with Authentication Error
```bash
# Verify database credentials
psql -h $DB_HOST -p $DB_PORT -U $DB_USERNAME -d postgres -c "SELECT 1;"

# Check if user has required permissions
psql -U postgres -d postgres -c "\\l" # list databases
```

### Backup File Too Large to Download from Glacier
```bash
# Check file size
aws s3api head-object --bucket grading-system-backups \
  --key weekly/week_01/grading_system_backup_20240115_020000.sql.gz

# If large, consider parallel restore from S3
aws s3 cp s3://grading-system-backups/weekly/week_01/file.sql.gz - | gunzip | psql ...
```

## Contact & Escalation

- **Backup Failures**: Alert DBA team immediately
- **Recovery Need**: Contact DevOps lead
- **RTO Exceeded**: Escalate to CTO
- **Production Incident**: Page on-call engineer

## References

- [PostgreSQL Backup Documentation](https://www.postgresql.org/docs/current/backup.html)
- [AWS S3 Lifecycle Policies](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html)
- [pg_dump Reference](https://www.postgresql.org/docs/current/app-pgdump.html)
