#!/bin/bash

# Check PostgreSQL Status on VPS
# Run this on your VPS
# Usage: bash vps-check-db-status.sh

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
echo "PostgreSQL Status Check"
echo "=========================================="
echo ""

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    print_error "PostgreSQL is not installed"
    echo ""
    echo "Run the setup script first:"
    echo "  sudo bash ~/vps-db-setup.sh"
    exit 1
fi

print_success "PostgreSQL is installed"

# Check if PostgreSQL service is running
if systemctl is-active --quiet postgresql; then
    print_success "PostgreSQL service is running"
else
    print_error "PostgreSQL service is NOT running"
    echo ""
    echo "Start it with:"
    echo "  sudo systemctl start postgresql"
    echo "  sudo systemctl enable postgresql"
    exit 1
fi

# Check if PostgreSQL is listening on port 5432
if netstat -tuln 2>/dev/null | grep -q ":5432 " || ss -tuln 2>/dev/null | grep -q ":5432 "; then
    print_success "PostgreSQL is listening on port 5432"
    
    # Show what interfaces it's listening on
    echo ""
    print_info "PostgreSQL is listening on:"
    if command -v netstat &> /dev/null; then
        netstat -tuln | grep ":5432" || true
    else
        ss -tuln | grep ":5432" || true
    fi
else
    print_error "PostgreSQL is NOT listening on port 5432"
    echo ""
    echo "Check postgresql.conf:"
    echo "  sudo grep listen_addresses /etc/postgresql/*/main/postgresql.conf"
fi

# Check firewall
echo ""
print_info "Checking firewall..."

if command -v ufw &> /dev/null; then
    if ufw status | grep -q "5432/tcp"; then
        print_success "UFW firewall allows port 5432"
    else
        print_error "UFW firewall does NOT allow port 5432"
        echo "  Fix with: sudo ufw allow 5432/tcp"
    fi
elif command -v firewall-cmd &> /dev/null; then
    if firewall-cmd --list-ports 2>/dev/null | grep -q "5432/tcp"; then
        print_success "firewalld allows port 5432"
    else
        print_error "firewalld does NOT allow port 5432"
        echo "  Fix with: sudo firewall-cmd --permanent --add-port=5432/tcp && sudo firewall-cmd --reload"
    fi
else
    print_info "No firewall detected (or using iptables directly)"
fi

# Get VPS IP
VPS_IP=$(hostname -I | awk '{print $1}')
echo ""
print_info "VPS IP address: $VPS_IP"

# Check PostgreSQL version
PG_VERSION=$(psql --version 2>/dev/null | awk '{print $3}' || echo "unknown")
print_info "PostgreSQL version: $PG_VERSION"

# Check pg_hba.conf
echo ""
print_info "Checking pg_hba.conf for remote access rules..."

if [ -f /etc/postgresql/*/main/pg_hba.conf ]; then
    PG_HBA=$(ls /etc/postgresql/*/main/pg_hba.conf | head -1)
elif [ -f /var/lib/pgsql/data/pg_hba.conf ]; then
    PG_HBA="/var/lib/pgsql/data/pg_hba.conf"
else
    print_error "Could not find pg_hba.conf"
    exit 1
fi

print_info "Found pg_hba.conf at: $PG_HBA"

if grep -q "host.*all.*all" "$PG_HBA"; then
    print_success "Remote access rules found in pg_hba.conf:"
    grep "host.*all.*all" "$PG_HBA" | sed 's/^/  /'
else
    print_error "No remote access rules found in pg_hba.conf"
    echo ""
    echo "Add remote access with:"
    echo "  sudo bash ~/vps-fix-db-access.sh"
fi

echo ""
echo "=========================================="
echo "Summary"
echo "=========================================="
echo ""
echo "To test connection from your local machine:"
echo "  psql -h $VPS_IP -U your_username -d your_database_name"
echo ""
echo "If connection fails, check:"
echo "  1. PostgreSQL is running: sudo systemctl status postgresql"
echo "  2. Firewall allows port 5432"
echo "  3. pg_hba.conf allows your IP"
echo "  4. PostgreSQL is listening on all interfaces (not just localhost)"
echo ""





