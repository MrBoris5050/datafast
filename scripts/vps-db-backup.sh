#!/bin/bash

# Database Backup Script for VPS
# Run this on your VPS with sudo privileges
# Usage: sudo bash vps-db-backup.sh
# Add to crontab for automated backups: 0 2 * * * /path/to/vps-db-backup.sh

set -e

# Configuration
DB_NAME="${DB_NAME:-inventor}"
DB_USER="${DB_USER:-postgres}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/postgresql}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate backup filename with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_backup_$TIMESTAMP.sql"

echo "Creating backup: $BACKUP_FILE"

# Create backup
if sudo -u postgres pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_FILE"; then
    # Compress backup
    gzip "$BACKUP_FILE"
    echo -e "${GREEN}✓${NC} Backup created: ${BACKUP_FILE}.gz"
    
    # Remove old backups (older than retention days)
    find "$BACKUP_DIR" -name "${DB_NAME}_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete
    echo -e "${GREEN}✓${NC} Old backups cleaned (keeping last $RETENTION_DAYS days)"
else
    echo -e "${RED}✗${NC} Backup failed!"
    exit 1
fi





