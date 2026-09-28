#!/bin/bash

###############################################################################
# AI Grading System - PostgreSQL Database Backup Script
#
# Purpose: Automated backup of PostgreSQL database to AWS S3
# Usage: ./backup-database.sh
# Cron: 0 2 * * * /path/to/backup-database.sh  # Daily at 2 AM UTC
###############################################################################

set -e

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USERNAME="${DB_USERNAME:-grading_user}"
DB_NAME="${DB_NAME:-grading_system}"
S3_BUCKET="${S3_BUCKET:-grading-system-backups}"
AWS_REGION="${AWS_REGION:-us-east-1}"
BACKUP_RETENTION_DAYS_DAILY=30
BACKUP_RETENTION_DAYS_WEEKLY=84
LOG_FILE="/var/log/grading-system/backup.log"

# Create log directory if it doesn't exist
mkdir -p "$(dirname "$LOG_FILE")"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
    log "ERROR: $1"
    exit 1
}

# Export database credentials
export PGPASSWORD="${DB_PASSWORD}"

# Generate backup filename with timestamp
BACKUP_DATE=$(date '+%Y%m%d_%H%M%S')
BACKUP_FILENAME="grading_system_backup_${BACKUP_DATE}.sql.gz"
LOCAL_BACKUP_PATH="/tmp/${BACKUP_FILENAME}"

log "Starting database backup..."
log "Database: $DB_NAME on $DB_HOST:$DB_PORT"

# Create backup
log "Dumping database to $LOCAL_BACKUP_PATH..."
if pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USERNAME" \
    -d "$DB_NAME" \
    --verbose \
    --no-password | gzip > "$LOCAL_BACKUP_PATH" 2>> "$LOG_FILE"; then
    log "Database dump completed successfully"
    
    # Get file size
    FILE_SIZE=$(du -h "$LOCAL_BACKUP_PATH" | cut -f1)
    log "Backup file size: $FILE_SIZE"
    
    # Upload to S3 with daily and weekly prefix
    WEEK_NUMBER=$(date '+%U')
    S3_DAILY_PATH="s3://${S3_BUCKET}/daily/${BACKUP_DATE}/${BACKUP_FILENAME}"
    S3_WEEKLY_PATH="s3://${S3_BUCKET}/weekly/week_${WEEK_NUMBER}/${BACKUP_FILENAME}"
    
    log "Uploading to S3..."
    if aws s3 cp "$LOCAL_BACKUP_PATH" "$S3_DAILY_PATH" \
        --region "$AWS_REGION" \
        --storage-class STANDARD_IA \
        --sse AES256 \
        --metadata "date=$BACKUP_DATE,size=$FILE_SIZE"; then
        log "Daily backup uploaded: $S3_DAILY_PATH"
    else
        error_exit "Failed to upload daily backup to S3"
    fi
    
    # Upload weekly backup (only once per week on Monday)
    if [ "$(date '+%u')" = "1" ]; then
        if aws s3 cp "$LOCAL_BACKUP_PATH" "$S3_WEEKLY_PATH" \
            --region "$AWS_REGION" \
            --storage-class GLACIER \
            --sse AES256 \
            --metadata "date=$BACKUP_DATE,size=$FILE_SIZE"; then
            log "Weekly backup uploaded: $S3_WEEKLY_PATH"
        else
            error_exit "Failed to upload weekly backup to S3"
        fi
    fi
    
    # Clean up local backup
    rm -f "$LOCAL_BACKUP_PATH"
    log "Local backup file deleted"
    
    # Apply S3 lifecycle policy cleanup (managed by AWS Lifecycle Policy)
    log "Backup completed successfully"
    
else
    error_exit "Database dump failed"
fi

# Send completion notification
log "Database backup finished successfully at $(date '+%Y-%m-%d %H:%M:%S')"
