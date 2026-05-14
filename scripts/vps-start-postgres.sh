#!/bin/bash

# Start PostgreSQL Server
# Run this on your VPS
# Usage: sudo bash vps-start-postgres.sh

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
echo "Starting PostgreSQL Server"
echo "=========================================="
echo ""

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    print_error "Cannot detect OS"
    exit 1
fi

# Find PostgreSQL version
PG_VERSION=$(psql --version 2>/dev/null | awk '{print $3}' | cut -d. -f1 || echo "14")

print_info "Detected PostgreSQL version: $PG_VERSION"

# Start the actual PostgreSQL cluster
if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
    # For Ubuntu/Debian, start the specific cluster
    print_info "Starting PostgreSQL cluster..."
    
    # Find the cluster name
    CLUSTER_NAME=$(pg_lsclusters 2>/dev/null | tail -1 | awk '{print $1"/"$2}' || echo "")
    
    if [ -n "$CLUSTER_NAME" ]; then
        print_info "Found cluster: $CLUSTER_NAME"
        pg_ctlcluster $PG_VERSION main start
        print_success "PostgreSQL cluster started"
    else
        # Try starting the service directly
        systemctl start postgresql@$PG_VERSION-main
        print_success "PostgreSQL service started"
    fi
    
    # Also ensure the main service is running
    systemctl start postgresql
    systemctl enable postgresql
    
elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
    systemctl start postgresql
    systemctl enable postgresql
    print_success "PostgreSQL started"
else
    print_error "Unsupported OS"
    exit 1
fi

# Wait a moment for PostgreSQL to start
sleep 2

# Check if PostgreSQL is now running
if systemctl is-active --quiet postgresql; then
    print_success "PostgreSQL service is active"
else
    print_error "PostgreSQL service is still not active"
fi

# Check if port 5432 is listening
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
    print_error "PostgreSQL is still not listening on port 5432"
    echo ""
    echo "Try these commands manually:"
    echo "  sudo systemctl start postgresql@$PG_VERSION-main"
    echo "  sudo pg_ctlcluster $PG_VERSION main start"
    echo "  sudo systemctl status postgresql@$PG_VERSION-main"
fi

echo ""
echo "=========================================="
print_success "Done!"
echo "=========================================="
echo ""
echo "Check status with:"
echo "  sudo systemctl status postgresql"
echo "  sudo netstat -tuln | grep 5432"
echo ""





