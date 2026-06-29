#!/bin/bash

# PostgreSQL Database Restore Script
# Restores a backup created by backup-database.sh
# Usage: ./restore-database.sh <backup-file> [target-database-url]

set -euo pipefail

# Configuration
BACKUP_FILE="${1:-}"
TARGET_DATABASE_URL="${2:-${DATABASE_URL:-}}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

log_prompt() {
  echo -e "${BLUE}[PROMPT]${NC} $1"
}

# Validate inputs
if [ -z "$BACKUP_FILE" ]; then
  log_error "Backup file path is required"
  echo "Usage: $0 <backup-file> [target-database-url]"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  log_error "Backup file not found: $BACKUP_FILE"
  exit 1
fi

if [ -z "$TARGET_DATABASE_URL" ]; then
  log_error "TARGET_DATABASE_URL is not set and no database URL provided"
  echo "Usage: $0 <backup-file> [target-database-url]"
  echo "Or set DATABASE_URL environment variable"
  exit 1
fi

# Extract database name and connection details from DATABASE_URL
if [[ $TARGET_DATABASE_URL =~ postgresql://([^:]+):([^@]+)@([^:/]+):?([0-9]*)/?([^?]*) ]]; then
  DB_USER="${BASH_REMATCH[1]}"
  DB_PASSWORD="${BASH_REMATCH[2]}"
  DB_HOST="${BASH_REMATCH[3]}"
  DB_PORT="${BASH_REMATCH[4]:-5432}"
  DB_NAME="${BASH_REMATCH[5]}"
else
  log_error "Failed to parse target DATABASE_URL. Expected format: postgresql://user:password@host:port/database"
  exit 1
fi

log_info "Backup file: $BACKUP_FILE"
log_info "Target database: $DB_NAME@$DB_HOST:$DB_PORT"

# Check backup file format
if [[ "$BACKUP_FILE" == *.sql.gz ]]; then
  log_info "Detected gzip-compressed SQL backup"
  USE_GUNZIP=true
elif [[ "$BACKUP_FILE" == *.sql ]]; then
  log_info "Detected plain SQL backup"
  USE_GUNZIP=false
else
  log_warn "Unknown backup file format (expected .sql or .sql.gz)"
  USE_GUNZIP=false
fi

# Confirmation prompt
log_warn "⚠️  This will RESTORE data from: $BACKUP_FILE"
log_warn "⚠️  This will OVERWRITE data in database: $DB_NAME"
log_warn "⚠️  Current data will be PERMANENTLY LOST if not backed up"
log_prompt "Type 'RESTORE' to proceed: "
read -r CONFIRMATION

if [ "$CONFIRMATION" != "RESTORE" ]; then
  log_info "Restore cancelled"
  exit 0
fi

# Create backup of current database before restoring (safety measure)
log_info "Creating safety backup of current database..."
SAFETY_BACKUP_DIR="./backups"
mkdir -p "$SAFETY_BACKUP_DIR"
SAFETY_BACKUP_FILE="$SAFETY_BACKUP_DIR/pre_restore_${DB_NAME}_$(date +%Y%m%d_%H%M%S).sql.gz"

export PGPASSWORD="$DB_PASSWORD"

if pg_dump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --format=plain \
  "$DB_NAME" 2>/dev/null | gzip > "$SAFETY_BACKUP_FILE"; then
  log_info "Safety backup created: $SAFETY_BACKUP_FILE"
else
  log_warn "⚠️  Could not create safety backup (database may not exist yet)"
fi

# Drop all active connections to the target database
log_info "Terminating active connections to $DB_NAME..."
psql \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  -d postgres \
  --command="SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid != pg_backend_pid();" \
  2>/dev/null || true

# Drop and recreate the database
log_info "Dropping existing database $DB_NAME..."
dropdb \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --force \
  "$DB_NAME" 2>/dev/null || log_warn "Database did not exist or could not be dropped"

log_info "Creating new database $DB_NAME..."
createdb \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  "$DB_NAME"

# Restore from backup
log_info "Restoring data from backup..."

if [ "$USE_GUNZIP" = true ]; then
  if zcat "$BACKUP_FILE" | psql \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USER" \
    --dbname="$DB_NAME" 2>&1; then
    log_info "✅ Restore completed successfully"
  else
    log_error "❌ Restore failed"
    unset PGPASSWORD
    exit 1
  fi
else
  if psql \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USER" \
    --dbname="$DB_NAME" \
    --file="$BACKUP_FILE" 2>&1; then
    log_info "✅ Restore completed successfully"
  else
    log_error "❌ Restore failed"
    unset PGPASSWORD
    exit 1
  fi
fi

# Cleanup
unset PGPASSWORD

# Verify restore
log_info "Verifying restore integrity..."
export PGPASSWORD="$DB_PASSWORD"

TABLE_COUNT=$(psql \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname="$DB_NAME" \
  --tuples-only \
  --command="SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null | tr -d ' ' || echo "0")

unset PGPASSWORD

log_info "Restored tables: $TABLE_COUNT"
log_info "Restore verification complete"

log_info "✅ Database restore process complete"
log_info "Safety backup location: $SAFETY_BACKUP_FILE"
exit 0
