#!/bin/bash

# VPS PostgreSQL Database Setup Script
# Run this script on your VPS with sudo privileges
# Usage: sudo bash vps-db-setup.sh

set -e  # Exit on error

echo "=========================================="
echo "VPS PostgreSQL Database Setup"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root or with sudo"
    exit 1
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    OS_VERSION=$VERSION_ID
else
    print_error "Cannot detect OS. Please run on Ubuntu/Debian or CentOS/RHEL"
    exit 1
fi

print_info "Detected OS: $OS $OS_VERSION"
echo ""

# Prompt for database configuration
read -p "Enter database name (default: inventor): " DB_NAME
DB_NAME=${DB_NAME:-inventor}

read -p "Enter database username (default: dbuser): " DB_USER
DB_USER=${DB_USER:-dbuser}

read -sp "Enter database password: " DB_PASSWORD
echo ""

read -p "Enter PostgreSQL port (default: 5432): " DB_PORT
DB_PORT=${DB_PORT:-5432}

read -p "Allow connections from all IPs? (y/N) - For production, use 'N' and configure specific IPs: " ALLOW_ALL
ALLOW_ALL=${ALLOW_ALL:-N}

if [ "$ALLOW_ALL" = "y" ] || [ "$ALLOW_ALL" = "Y" ]; then
    ALLOW_IP="0.0.0.0/0"
    print_info "Allowing connections from all IPs (less secure)"
else
    read -p "Enter your application server IP (e.g., 192.168.1.100): " APP_IP
    ALLOW_IP="$APP_IP/32"
    print_info "Allowing connections only from $APP_IP"
fi

echo ""
print_info "Starting PostgreSQL installation..."

# Install PostgreSQL based on OS
if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
    print_info "Updating package list..."
    apt update -qq
    
    print_info "Installing PostgreSQL..."
    apt install -y postgresql postgresql-contrib
    
    PG_VERSION=$(psql --version | awk '{print $3}' | cut -d. -f1)
    PG_CONF="/etc/postgresql/$PG_VERSION/main/postgresql.conf"
    PG_HBA="/etc/postgresql/$PG_VERSION/main/pg_hba.conf"
    
elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
    print_info "Installing PostgreSQL repository..."
    yum install -y postgresql-server postgresql-contrib
    
    print_info "Initializing PostgreSQL database..."
    postgresql-setup --initdb
    
    PG_CONF="/var/lib/pgsql/data/postgresql.conf"
    PG_HBA="/var/lib/pgsql/data/pg_hba.conf"
    
    # Start PostgreSQL
    systemctl start postgresql
    systemctl enable postgresql
else
    print_error "Unsupported OS. Please install PostgreSQL manually."
    exit 1
fi

print_success "PostgreSQL installed"

# Start and enable PostgreSQL
if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
    systemctl start postgresql
    systemctl enable postgresql
fi

# Create database and user
print_info "Creating database and user..."
sudo -u postgres psql <<EOF
-- Create database
CREATE DATABASE $DB_NAME;

-- Create user
CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';

-- Set user permissions
ALTER ROLE $DB_USER SET client_encoding TO 'utf8';
ALTER ROLE $DB_USER SET default_transaction_isolation TO 'read committed';
ALTER ROLE $DB_USER SET timezone TO 'UTC';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;

-- For PostgreSQL 15+, also grant schema privileges
\c $DB_NAME
GRANT ALL ON SCHEMA public TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;
EOF

print_success "Database and user created"

# Configure PostgreSQL for remote connections
print_info "Configuring PostgreSQL for remote connections..."

# Update postgresql.conf
if [ -f "$PG_CONF" ]; then
    # Enable listening on all addresses
    sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/g" "$PG_CONF"
    sed -i "s/listen_addresses = 'localhost'/listen_addresses = '*'/g" "$PG_CONF"
    
    print_success "Updated postgresql.conf"
else
    print_error "Could not find postgresql.conf at $PG_CONF"
fi

# Update pg_hba.conf
if [ -f "$PG_HBA" ]; then
    # Add remote connection rule if it doesn't exist
    if ! grep -q "host.*all.*all.*$ALLOW_IP" "$PG_HBA"; then
        echo "host    all             all             $ALLOW_IP               md5" >> "$PG_HBA"
        print_success "Added remote access rule to pg_hba.conf"
    else
        print_info "Remote access rule already exists"
    fi
else
    print_error "Could not find pg_hba.conf at $PG_HBA"
fi

# Restart PostgreSQL
print_info "Restarting PostgreSQL..."
systemctl restart postgresql
sleep 2

# Check if PostgreSQL is running
if systemctl is-active --quiet postgresql; then
    print_success "PostgreSQL is running"
else
    print_error "PostgreSQL failed to start. Check logs: journalctl -u postgresql"
    exit 1
fi

# Configure firewall
print_info "Configuring firewall..."

if command -v ufw &> /dev/null; then
    # UFW (Ubuntu/Debian)
    ufw allow $DB_PORT/tcp
    print_success "UFW firewall configured"
elif command -v firewall-cmd &> /dev/null; then
    # firewalld (CentOS/RHEL)
    firewall-cmd --permanent --add-port=$DB_PORT/tcp
    firewall-cmd --reload
    print_success "firewalld configured"
else
    print_info "No firewall detected. Please configure manually if needed."
fi

# Get VPS IP address
VPS_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "=========================================="
print_success "Setup Complete!"
echo "=========================================="
echo ""
echo "Database Configuration:"
echo "  Database Name: $DB_NAME"
echo "  Username: $DB_USER"
echo "  Password: [hidden]"
echo "  Host: $VPS_IP"
echo "  Port: $DB_PORT"
echo ""
echo "Connection String for .env.local:"
echo "  POSTGRES_PRISMA_URL=\"postgresql://$DB_USER:$DB_PASSWORD@$VPS_IP:$DB_PORT/$DB_NAME?schema=public&sslmode=prefer\""
echo ""
echo "Next Steps:"
echo "  1. Update your .env.local file with the connection string above"
echo "  2. Run 'npm run db:generate' in your project"
echo "  3. Run 'npm run db:push' to create tables"
echo "  4. Test connection with 'npm run db:studio'"
echo ""
print_info "For production, consider enabling SSL (see VPS_DATABASE_SETUP.md)"
echo ""





