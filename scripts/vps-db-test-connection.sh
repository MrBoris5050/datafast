#!/bin/bash

# Test Database Connection Script
# Run this from your local machine or application server
# Usage: bash vps-db-test-connection.sh

set -e

echo "=========================================="
echo "Database Connection Test"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Prompt for connection details
read -p "Enter VPS IP address or hostname: " VPS_HOST
read -p "Enter database port (default: 5432): " DB_PORT
DB_PORT=${DB_PORT:-5432}
read -p "Enter database name: " DB_NAME
read -p "Enter username: " DB_USER
read -sp "Enter password: " DB_PASSWORD
echo ""

echo ""
echo "Testing connection..."

# Check if psql is installed
if ! command -v psql &> /dev/null; then
    echo -e "${RED}✗${NC} psql is not installed"
    echo "Install it with:"
    echo "  Ubuntu/Debian: sudo apt install postgresql-client"
    echo "  macOS: brew install postgresql"
    echo "  Windows: Download from postgresql.org"
    exit 1
fi

# Test connection
export PGPASSWORD="$DB_PASSWORD"
if psql -h "$VPS_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT version();" &> /dev/null; then
    echo -e "${GREEN}✓${NC} Connection successful!"
    echo ""
    echo "Database version:"
    psql -h "$VPS_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT version();"
    echo ""
    echo "Connection string for .env.local:"
    echo "POSTGRES_PRISMA_URL=\"postgresql://$DB_USER:$DB_PASSWORD@$VPS_HOST:$DB_PORT/$DB_NAME?schema=public&sslmode=prefer\""
else
    echo -e "${RED}✗${NC} Connection failed!"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check if PostgreSQL is running on VPS: sudo systemctl status postgresql"
    echo "  2. Verify firewall allows port $DB_PORT"
    echo "  3. Check pg_hba.conf allows connections from your IP"
    echo "  4. Verify username, password, and database name"
    exit 1
fi

unset PGPASSWORD





