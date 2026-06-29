#!/bin/bash

# PostgreSQL Database Backup Script
# Supports both local development and production (Railway) databases
# Usage: ./backup-database.sh [backup-name] [database-url]

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="${1:-narmir_backup_${TIMESTAMP}}"
DATABASE_URL="${2:-${DATABASE_URL:-}}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

# Validate DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
  log_error "DATABASE_URL is not set and no database URL provided"
  echo "Usage: $0 [backup-name] [database-url]"
  echo "Or set DATABASE_URL environment variable"
  exit 1
fi

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"
log_info "Backup directory: $BACKUP_DIR"

# Normalize postgres:// to postgresql:// for consistent parsing
if [[ "$DATABASE_URL" =~ ^postgres:// ]]; then
  DATABASE_URL="postgresql://${DATABASE_URL#postgres://}"
fi

# Extract database name and connection details from DATABASE_URL
# Format: postgresql://user:password@host:port/database
if [[ $DATABASE_URL =~ postgresql://([^:]+):([^@]+)@([^:/]+):?([0-9]*)/?([^?]*) ]]; then
  DB_USER="${BASH_REMATCH[1]}"
  DB_PASSWORD="${BASH_REMATCH[2]}"
  DB_HOST="${BASH_REMATCH[3]}"
  DB_PORT="${BASH_REMATCH[4]:-5432}"
  DB_NAME="${BASH_REMATCH[5]}"
else
  log_error "Failed to parse DATABASE_URL. Expected format: postgresql://user:password@host:port/database"
  exit 1
fi

log_info "Target database: $DB_NAME@$DB_HOST:$DB_PORT"

# Prepare backup file path
BACKUP_FILE="$BACKUP_DIR/${BACKUP_NAME}.sql.gz"

# Export password for pg_dump (avoid password prompt)
export PGPASSWORD="$DB_PASSWORD"

log_info "Starting database backup..."

# Run pg_dump with compression (stderr redirected to log, stdout to gzip)
if pg_dump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --format=plain \
  "$DB_NAME" 2>/dev/null | gzip > "$BACKUP_FILE"; then

  # Calculate file size
  FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  RECORDS=$(zcat "$BACKUP_FILE" | grep -c "^INSERT INTO" || echo "unknown")

  log_info "✅ Backup completed successfully"
  log_info "Backup file: $BACKUP_FILE"
  log_info "File size: $FILE_SIZE"
  log_info "Estimated records: $RECORDS"

  # Create metadata file
  METADATA_FILE="${BACKUP_FILE%.sql.gz}.metadata.json"
  cat > "$METADATA_FILE" <<EOF
{
  "backup_name": "$BACKUP_NAME",
  "backup_timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "database": "$DB_NAME",
  "host": "$DB_HOST",
  "port": "$DB_PORT",
  "file_path": "$BACKUP_FILE",
  "file_size_bytes": $(stat -f%z "$BACKUP_FILE" 2>/dev/null || stat -c%s "$BACKUP_FILE" 2>/dev/null || echo 0),
  "compressed": true,
  "pg_dump_version": "$(pg_dump --version 2>/dev/null || echo 'unknown')"
}
EOF
  log_info "Metadata file: $METADATA_FILE"

else
  log_error "❌ Backup failed"
  rm -f "$BACKUP_FILE"
  exit 1
fi

# Cleanup
unset PGPASSWORD

log_info "Backup process complete"
exit 0
