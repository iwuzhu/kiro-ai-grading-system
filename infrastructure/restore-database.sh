#!/bin/bash

###############################################################################
# AI Grading System - PostgreSQL Database Restore Script
#
# Purpose: Restore PostgreSQL database from AWS S3 backup
# Usage: ./restore-database.sh <backup-filename> [target-database]
# Example: ./restore-database.sh grading_system_backup_20240115_020000.sql.gz grading_system_restored
###############################################################################

set -e

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USERNAME="${DB_USERNAME:-grading_user}"
DB_NAME="${DB_NAME:-grading_system}"
S3_BUCKET="${S3_BUCKET:-grading-system-backups}"
AWS_REGION="${AWS_REGION:-us-east-1}"
LOG_FILE="/var/log/grading-system/restore.log"

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

# Check arguments
if [ $# -lt 1 ]; then
    error_exit "Usage: $0 <backup-filename> [target-database]"
fi

BACKUP_FILENAME="$1"
TARGET_DB="${2:-${DB_NAME}_restored}"

# Export database credentials
export PGPASSWORD="${DB_PASSWORD}"

log "Starting database restore..."
log "Backup file: $BACKUP_FILENAME"
log "Target database: $TARGET_DB"
log "Source database: $DB_HOST:$DB_PORT"

# Create temporary directory for download
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

LOCAL_BACKUP_PATH="${TEMP_DIR}/${BACKUP_FILENAME}"

# Download backup from S3 (try daily first, then weekly)
log "Downloading backup from S3..."

if aws s3 cp "s3://${S3_BUCKET}/daily/${BACKUP_FILENAME}" "$LOCAL_BACKUP_PATH" \
    --region "$AWS_REGION" 2>/dev/null || \
   aws s3 cp "s3://${S3_BUCKET}/weekly/${BACKUP_FILENAME}" "$LOCAL_BACKUP_PATH" \
    --region "$AWS_REGION" 2>/dev/null; then
    log "Backup downloaded successfully"
else
    error_exit "Could not find backup file in S3"
fi

# Verify backup file
if [ ! -f "$LOCAL_BACKUP_PATH" ]; then
    error_exit "Backup file not found after download"
fi

FILE_SIZE=$(du -h "$LOCAL_BACKUP_PATH" | cut -f1)
log "Backup file size: $FILE_SIZE"

# Check if target database exists
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -tc \
    "SELECT 1 FROM pg_database WHERE datname = '${TARGET_DB}'" | grep -q 1; then
    log "WARNING: Target database '$TARGET_DB' already exists"
    read -p "Drop existing database? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log "Dropping existing database '$TARGET_DB'..."
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -tc \
            "DROP DATABASE IF EXISTS \"${TARGET_DB}\";"
    else
        error_exit "Aborting restore"
    fi
fi

# Create target database
log "Creating target database '$TARGET_DB'..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -tc \
    "CREATE DATABASE \"${TARGET_DB}\" WITH ENCODING utf8 LOCALE 'en_US.UTF-8';"

# Restore database
log "Restoring database from backup..."
if gunzip -c "$LOCAL_BACKUP_PATH" | \
   psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$TARGET_DB" \
   --no-password 2>&1 | tail -20 >> "$LOG_FILE"; then
    log "Database restore completed successfully"
else
    error_exit "Database restore failed"
fi

# Verify restore
log "Verifying restored database..."
TABLE_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$TARGET_DB" -tc \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')

if [ "$TABLE_COUNT" -gt 0 ]; then
    log "Restore verification successful. Tables restored: $TABLE_COUNT"
else
    log "WARNING: No tables found in restored database"
fi

log "Database restore finished successfully at $(date '+%Y-%m-%d %H:%M:%S')"
log "Target database available as: $TARGET_DB"
log ""
log "NEXT STEPS:"
log "1. Verify data integrity: psql -h $DB_HOST -p $DB_PORT -U $DB_USERNAME -d $TARGET_DB"
log "2. If restore is good, rename: ALTER DATABASE $TARGET_DB RENAME TO $DB_NAME;"
log "3. If restore failed, drop: DROP DATABASE $TARGET_DB;"
