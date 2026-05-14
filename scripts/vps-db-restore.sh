#!/bin/bash

# Database Restore Script for VPS
# Run this on your VPS with sudo privileges
# Usage: sudo bash vps-db-restore.sh [backup_file.sql.gz]

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ -z "$1" ]; then
    echo "Usage: sudo bash vps-db-restore.sh [backup_file.sql.gz]"
    echo ""
    echo "Available backups:"
    ls -lh /var/backups/postgresql/*.sql.gz 2>/dev/null || echo "No backups found"
    exit 1
fi

BACKUP_FILE="$1"
DB_NAME="${DB_NAME:-inventor}"
DB_USER="${DB_USER:-postgres}"

if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}✗${NC} Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo -e "${YELLOW}⚠${NC} WARNING: This will replace all data in database '$DB_NAME'"
read -p "Are you sure? Type 'yes' to continue: " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled"
    exit 0
fi

echo "Restoring from: $BACKUP_FILE"

# Check if file is compressed
if [[ "$BACKUP_FILE" == *.gz ]]; then
    gunzip -c "$BACKUP_FILE" | sudo -u postgres psql -U "$DB_USER" -d "$DB_NAME"
else
    sudo -u postgres psql -U "$DB_USER" -d "$DB_NAME" < "$BACKUP_FILE"
fi

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Restore completed successfully"
else
    echo -e "${RED}✗${NC} Restore failed"
    exit 1
fi





