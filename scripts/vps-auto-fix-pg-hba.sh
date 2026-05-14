#!/bin/bash

# Auto-fix pg_hba.conf Syntax Error
# Run this on your VPS with sudo privileges
# Usage: sudo bash vps-auto-fix-pg-hba.sh

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
echo "Auto-Fix pg_hba.conf Syntax Error"
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

# Show line 136 before fix
echo ""
print_info "Line 136 before fix:"
sed -n '136p' "$PG_HBA" || echo "(line not found)"

# Find and remove malformed lines
print_info "Searching for malformed lines..."

# Remove lines where md5 appears in wrong position (as IP mask)
# Pattern: host ... md5 (where md5 is where IP should be)
sed -i '/^host[[:space:]]*all[[:space:]]*all[[:space:]]*md5[[:space:]]*$/d' "$PG_HBA"

# Remove lines where format is completely wrong
# Look for lines that have md5 but don't have proper IP format before it
sed -i '/^host[[:space:]]*all[[:space:]]*all[[:space:]]*[^0-9\/]*md5/d' "$PG_HBA"

# Also remove any lines added by previous scripts that might be malformed
sed -i '/^host[[:space:]]*all[[:space:]]*all[[:space:]]*[^0-9\.\/].*md5/d' "$PG_HBA"

print_success "Removed malformed lines"

# Show line 136 after cleanup
echo ""
print_info "Line 136 after cleanup:"
sed -n '136p' "$PG_HBA" || echo "(line removed or file shorter now)"

# Get your public IP (the one trying to connect)
read -p "Enter your IP address to allow (e.g., 143.105.209.189) or press Enter for 0.0.0.0/0 (all IPs): " ALLOW_IP

if [ -z "$ALLOW_IP" ]; then
    ALLOW_IP="0.0.0.0/0"
    print_info "Allowing connections from all IPs (less secure)"
else
    # Add /32 if not present
    if [[ ! $ALLOW_IP =~ / ]]; then
        ALLOW_IP="$ALLOW_IP/32"
    fi
    print_info "Allowing connections from $ALLOW_IP"
fi

# Remove any existing rules for this IP to avoid duplicates
sed -i "/^host[[:space:]]*all[[:space:]]*all[[:space:]]*${ALLOW_IP//\//\\/}[[:space:]]*md5$/d" "$PG_HBA"

# Add correct line at the end
echo "" >> "$PG_HBA"
echo "# Remote access - auto-fixed on $(date)" >> "$PG_HBA"
echo "host    all             all             $ALLOW_IP               md5" >> "$PG_HBA"

print_success "Added correct access rule for $ALLOW_IP"

# Validate syntax by checking the file
echo ""
print_info "Validating configuration..."

# Check for obvious syntax errors
ERRORS=0

# Check for lines with md5 in wrong position
if grep -q "^host[[:space:]]*all[[:space:]]*all[[:space:]]*md5" "$PG_HBA"; then
    print_error "Found lines with md5 in wrong position"
    ERRORS=1
fi

# Check for lines missing IP address
if grep -q "^host[[:space:]]*all[[:space:]]*all[[:space:]]*[[:space:]]*md5" "$PG_HBA"; then
    print_error "Found lines missing IP address"
    ERRORS=1
fi

if [ $ERRORS -eq 0 ]; then
    print_success "No obvious syntax errors found"
else
    print_error "Found syntax errors. Please review the file manually."
    echo ""
    echo "Show problematic lines:"
    grep -n "^host.*all.*all" "$PG_HBA" | grep -v "0\.0\.0\.0\|127\.0\.0\.1\|::1\|[0-9]\+\.[0-9]\+\.[0-9]\+\.[0-9]\+"
    exit 1
fi

# Show the remote access rules we added
echo ""
print_info "Remote access rules in pg_hba.conf:"
grep "^host.*all.*all" "$PG_HBA" | tail -3

# Test PostgreSQL configuration
print_info "Testing PostgreSQL configuration syntax..."
if sudo -u postgres /usr/lib/postgresql/16/bin/postgres --config-file=/etc/postgresql/16/main/postgresql.conf -C hba_file 2>&1 | grep -q "syntax error\|FATAL"; then
    print_error "Configuration test failed"
    exit 1
fi

# Restart PostgreSQL
echo ""
print_info "Restarting PostgreSQL..."
systemctl restart postgresql@16-main
sleep 3

# Check if it started successfully
if systemctl is-active --quiet postgresql@16-main; then
    print_success "PostgreSQL started successfully!"
    
    # Check if listening on port 5432
    if netstat -tuln 2>/dev/null | grep -q ":5432 " || ss -tuln 2>/dev/null | grep -q ":5432 "; then
        print_success "PostgreSQL is listening on port 5432"
        
        echo ""
        print_info "PostgreSQL is listening on:"
        if command -v netstat &> /dev/null; then
            netstat -tuln | grep ":5432" || true
        else
            ss -tuln | grep ":5432" || true
        fi
    else
        print_error "PostgreSQL is not listening on port 5432"
    fi
else
    print_error "PostgreSQL failed to start"
    echo ""
    echo "Check logs:"
    echo "  sudo journalctl -xeu postgresql@16-main.service | tail -20"
    echo "  sudo tail -50 /var/log/postgresql/postgresql-16-main.log"
    exit 1
fi

echo ""
echo "=========================================="
print_success "Fixed Successfully!"
echo "=========================================="
echo ""
echo "Your database should now be accessible from: $ALLOW_IP"
echo ""
echo "Test connection from your local machine:"
echo "  psql -h 31.97.154.198 -U dbuser -d inventor"
echo ""
echo "Or update your .env.local with:"
echo "  POSTGRES_PRISMA_URL=\"postgresql://dbuser:YOUR_PASSWORD@31.97.154.198:5432/inventor?schema=public&sslmode=prefer\""
echo ""





