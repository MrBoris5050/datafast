#!/bin/bash

# Fix Database Access - Add IP to PostgreSQL allowed list
# Run this on your VPS with sudo privileges
# Usage: sudo bash vps-fix-db-access.sh

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

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root or with sudo"
    exit 1
fi

echo "=========================================="
echo "Fix PostgreSQL Remote Access"
echo "=========================================="
echo ""

# Detect OS and find PostgreSQL config
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    print_error "Cannot detect OS"
    exit 1
fi

# Find PostgreSQL version and config files
if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
    PG_VERSION=$(psql --version 2>/dev/null | awk '{print $3}' | cut -d. -f1 || echo "14")
    PG_HBA="/etc/postgresql/$PG_VERSION/main/pg_hba.conf"
elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
    PG_HBA="/var/lib/pgsql/data/pg_hba.conf"
else
    print_error "Unsupported OS"
    exit 1
fi

if [ ! -f "$PG_HBA" ]; then
    print_error "Could not find pg_hba.conf at $PG_HBA"
    print_info "Please find it manually: sudo find / -name pg_hba.conf 2>/dev/null"
    exit 1
fi

print_info "Found pg_hba.conf at: $PG_HBA"
echo ""

# Prompt for IP address
read -p "Enter IP address to allow (e.g., 143.105.209.189) or 'all' for 0.0.0.0/0: " ALLOW_IP

if [ "$ALLOW_IP" = "all" ] || [ "$ALLOW_IP" = "ALL" ]; then
    ALLOW_IP="0.0.0.0/0"
    print_info "Allowing connections from all IPs (less secure)"
else
    # Validate IP format (basic check)
    if [[ ! $ALLOW_IP =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}(/[0-9]{1,2})?$ ]] && [[ ! $ALLOW_IP =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/32$ ]]; then
        # If no /32, add it
        if [[ $ALLOW_IP =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
            ALLOW_IP="$ALLOW_IP/32"
        else
            print_error "Invalid IP format. Use format: 192.168.1.1 or 192.168.1.1/32"
            exit 1
        fi
    fi
    print_info "Allowing connections from $ALLOW_IP"
fi

# Backup pg_hba.conf
BACKUP_FILE="${PG_HBA}.backup.$(date +%Y%m%d_%H%M%S)"
cp "$PG_HBA" "$BACKUP_FILE"
print_success "Backed up pg_hba.conf to $BACKUP_FILE"

# Check if rule already exists
if grep -q "host.*all.*all.*$ALLOW_IP" "$PG_HBA"; then
    print_info "Access rule for $ALLOW_IP already exists"
    read -p "Do you want to add it anyway? (y/N): " ADD_ANYWAY
    if [ "$ADD_ANYWAY" != "y" ] && [ "$ADD_ANYWAY" != "Y" ]; then
        print_info "Skipping. Rule already exists."
        exit 0
    fi
fi

# Add the rule
echo "" >> "$PG_HBA"
echo "# Added by vps-fix-db-access.sh on $(date)" >> "$PG_HBA"
echo "host    all             all             $ALLOW_IP               md5" >> "$PG_HBA"

print_success "Added access rule for $ALLOW_IP"

# Restart PostgreSQL
print_info "Restarting PostgreSQL..."
systemctl restart postgresql
sleep 2

if systemctl is-active --quiet postgresql; then
    print_success "PostgreSQL restarted successfully"
else
    print_error "PostgreSQL failed to restart. Restoring backup..."
    cp "$BACKUP_FILE" "$PG_HBA"
    systemctl restart postgresql
    exit 1
fi

echo ""
echo "=========================================="
print_success "Access Fixed!"
echo "=========================================="
echo ""
echo "IP $ALLOW_IP is now allowed to connect to PostgreSQL"
echo ""
echo "Test the connection from your local machine:"
echo "  psql -h $(hostname -I | awk '{print $1}') -U your_username -d your_database_name"
echo ""





