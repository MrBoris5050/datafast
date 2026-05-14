#!/bin/bash

# Fix pg_hba.conf Syntax Error
# Run this on your VPS with sudo privileges
# Usage: sudo bash vps-fix-pg-hba.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

echo "=========================================="
echo "Fix pg_hba.conf Syntax Error"
echo "=========================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root or with sudo"
    exit 1
fi

PG_HBA="/etc/postgresql/16/main/pg_hba.conf"

if [ ! -f "$PG_HBA" ]; then
    print_error "Could not find pg_hba.conf at $PG_HBA"
    exit 1
fi

print_info "Found pg_hba.conf at: $PG_HBA"

# Backup
BACKUP_FILE="${PG_HBA}.backup.$(date +%Y%m%d_%H%M%S)"
cp "$PG_HBA" "$BACKUP_FILE"
print_success "Backed up to $BACKUP_FILE"

# Show line 136 and surrounding lines
echo ""
print_info "Checking line 136 (the problematic line):"
sed -n '130,140p' "$PG_HBA" | cat -n

echo ""
print_info "Looking for malformed lines..."

# Find and fix common issues
# Issue 1: Lines where md5 is in the wrong position
# Correct format: host    all    all    IP/MASK    md5
# Wrong format might be: host    all    all    md5    ...

# Check for lines with "md5" that might be malformed
MALFORMED=$(grep -n "host.*all.*all.*md5" "$PG_HBA" | grep -v "0\.0\.0\.0\|127\.0\.0\.1\|::1" || true)

if [ -n "$MALFORMED" ]; then
    print_error "Found potentially malformed lines:"
    echo "$MALFORMED"
    echo ""
    
    # Remove malformed lines (we'll add correct ones)
    print_info "Removing malformed lines..."
    sed -i '/^host.*all.*all.*md5$/d' "$PG_HBA"
    # Also remove lines where md5 appears before IP
    sed -i '/^host.*all.*all.*[^0-9\/]md5/d' "$PG_HBA"
    print_success "Removed malformed lines"
fi

# Show the file around line 136 again
echo ""
print_info "Current state around line 136:"
sed -n '130,140p' "$PG_HBA" | cat -n

echo ""
read -p "Enter IP address to allow (e.g., 143.105.209.189) or 'all' for 0.0.0.0/0: " ALLOW_IP

if [ "$ALLOW_IP" = "all" ] || [ "$ALLOW_IP" = "ALL" ]; then
    ALLOW_IP="0.0.0.0/0"
else
    # Add /32 if not present
    if [[ ! $ALLOW_IP =~ / ]]; then
        ALLOW_IP="$ALLOW_IP/32"
    fi
fi

# Add correct line at the end
echo "" >> "$PG_HBA"
echo "# Remote access - added by fix script on $(date)" >> "$PG_HBA"
echo "host    all             all             $ALLOW_IP               md5" >> "$PG_HBA"

print_success "Added correct access rule for $ALLOW_IP"

# Validate the file syntax (basic check)
echo ""
print_info "Validating pg_hba.conf format..."

# Check for common syntax errors
if grep -q "^host.*all.*all.*md5$" "$PG_HBA"; then
    print_error "Found lines with md5 in wrong position (no IP specified)"
    echo "Please check the file manually"
else
    print_success "No obvious syntax errors found"
fi

echo ""
print_info "Final pg_hba.conf remote access rules:"
grep "^host.*all.*all" "$PG_HBA" | tail -5

echo ""
read -p "Does this look correct? (y/N): " CONFIRM

if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    print_info "Restoring backup..."
    cp "$BACKUP_FILE" "$PG_HBA"
    print_info "Backup restored. Please fix manually."
    exit 1
fi

# Try to start PostgreSQL to test
print_info "Testing PostgreSQL configuration..."
if sudo -u postgres /usr/lib/postgresql/16/bin/postgres --config-file=/etc/postgresql/16/main/postgresql.conf --check 2>&1 | grep -q "syntax error\|FATAL"; then
    print_error "Configuration still has errors. Check manually."
    exit 1
else
    print_success "Configuration syntax appears valid"
fi

# Restart PostgreSQL
print_info "Restarting PostgreSQL..."
systemctl restart postgresql@16-main
sleep 2

if systemctl is-active --quiet postgresql@16-main; then
    print_success "PostgreSQL started successfully!"
    
    # Check if listening
    if netstat -tuln 2>/dev/null | grep -q ":5432 " || ss -tuln 2>/dev/null | grep -q ":5432 "; then
        print_success "PostgreSQL is listening on port 5432"
    fi
else
    print_error "PostgreSQL failed to start"
    echo ""
    echo "Check logs:"
    echo "  sudo journalctl -xeu postgresql@16-main.service"
    echo "  sudo tail -50 /var/log/postgresql/postgresql-16-main.log"
    exit 1
fi

echo ""
echo "=========================================="
print_success "Fixed!"
echo "=========================================="
echo ""





