# Setting Up VPS as Database Server

This guide will help you configure your project to use a PostgreSQL database hosted on a VPS (Virtual Private Server).

## Quick Start (Automated Setup)

**For the easiest setup, use our automated script:**

1. **Copy the setup script to your VPS:**
   ```bash
   # From your local machine, copy the script to your VPS
   scp scripts/vps-db-setup.sh user@your-vps-ip:~/
   ```

2. **SSH into your VPS and run the script:**
   ```bash
   ssh user@your-vps-ip
   sudo bash ~/vps-db-setup.sh
   ```

3. **The script will:**
   - Install PostgreSQL
   - Create your database and user
   - Configure remote access
   - Set up firewall rules
   - Generate your connection string

**For manual setup, continue reading below.**

## Prerequisites

- A VPS with Ubuntu/Debian Linux (or similar)
- SSH access to your VPS
- Root or sudo access on the VPS
- Your VPS IP address or domain name

## Step 1: Install PostgreSQL on Your VPS

### For Ubuntu/Debian:

```bash
# Update package list
sudo apt update

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Check PostgreSQL status
sudo systemctl status postgresql
```

### For CentOS/RHEL:

```bash
# Install PostgreSQL repository
sudo yum install -y postgresql-server postgresql-contrib

# Initialize database
sudo postgresql-setup --initdb

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

## Step 2: Configure PostgreSQL

### 2.1 Create Database and User

```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL prompt, run:
CREATE DATABASE your_database_name;
CREATE USER your_username WITH PASSWORD 'your_secure_password';
ALTER ROLE your_username SET client_encoding TO 'utf8';
ALTER ROLE your_username SET default_transaction_isolation TO 'read committed';
ALTER ROLE your_username SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE your_database_name TO your_username;
\q
```

### 2.2 Configure PostgreSQL to Accept Remote Connections

Edit the PostgreSQL configuration file:

```bash
# Find the postgresql.conf file location
sudo -u postgres psql -c "SHOW config_file;"

# Edit postgresql.conf (usually at /etc/postgresql/[version]/main/postgresql.conf)
sudo nano /etc/postgresql/14/main/postgresql.conf  # Adjust version number

# Find and modify:
listen_addresses = '*'  # Change from 'localhost' to '*' to listen on all interfaces
```

### 2.3 Configure pg_hba.conf for Remote Access

```bash
# Edit pg_hba.conf (usually at /etc/postgresql/[version]/main/pg_hba.conf)
sudo nano /etc/postgresql/14/main/pg_hba.conf  # Adjust version number

# Add this line at the end (replace with your actual IP or use 0.0.0.0/0 for all IPs - less secure):
host    all             all             0.0.0.0/0               md5

# Or for better security, restrict to specific IP:
host    all             all             YOUR_APP_SERVER_IP/32    md5
```

### 2.4 Restart PostgreSQL

```bash
sudo systemctl restart postgresql
```

## Step 3: Configure Firewall

### For UFW (Ubuntu):

```bash
# Allow PostgreSQL port (5432)
sudo ufw allow 5432/tcp

# Or allow from specific IP only (more secure):
sudo ufw allow from YOUR_APP_SERVER_IP to any port 5432

# Check firewall status
sudo ufw status
```

### For firewalld (CentOS/RHEL):

```bash
# Allow PostgreSQL port
sudo firewall-cmd --permanent --add-port=5432/tcp
sudo firewall-cmd --reload
```

## Step 4: Test Remote Connection

From your local machine or application server, test the connection:

```bash
# Install PostgreSQL client if not already installed
# Ubuntu/Debian: sudo apt install postgresql-client
# macOS: brew install postgresql
# Windows: Download from postgresql.org

# Test connection
psql -h YOUR_VPS_IP -U your_username -d your_database_name

# If connection works, you'll be prompted for password
```

## Step 5: Configure Your Application

### 5.1 Update Environment Variables

Create or update your `.env.local` file with your VPS database connection details:

```env
# VPS Database Configuration
POSTGRES_PRISMA_URL="postgresql://your_username:your_password@YOUR_VPS_IP:5432/your_database_name?schema=public&sslmode=require"
POSTGRES_URL="postgresql://your_username:your_password@YOUR_VPS_IP:5432/your_database_name?schema=public&sslmode=require"
POSTGRES_URL_NON_POOLING="postgresql://your_username:your_password@YOUR_VPS_IP:5432/your_database_name?schema=public&sslmode=require"

# Optional: Individual components (if needed)
POSTGRES_USER="your_username"
POSTGRES_PASSWORD="your_password"
POSTGRES_HOST="YOUR_VPS_IP"
POSTGRES_PORT="5432"
POSTGRES_DATABASE="your_database_name"
```

### 5.2 Connection String Format

The connection string format is:
```
postgresql://[username]:[password]@[host]:[port]/[database]?[parameters]
```

**Parameters:**
- `schema=public` - Database schema (usually 'public')
- `sslmode=require` - Require SSL connection (recommended for production)
- `sslmode=prefer` - Prefer SSL but allow non-SSL (for development)
- `sslmode=disable` - Disable SSL (not recommended for production)

### 5.3 For Production (Vercel/Cloud Hosting)

If deploying to Vercel or similar platforms, add these environment variables in your hosting dashboard:

1. Go to your project settings
2. Navigate to Environment Variables
3. Add all the `POSTGRES_*` variables from your `.env.local`

## Step 6: Test Your Connection

You can use the provided test script to verify your connection:

```bash
# From your local machine or application server
bash scripts/vps-db-test-connection.sh
```

Or test manually:
```bash
psql -h YOUR_VPS_IP -U your_username -d your_database_name
```

## Step 7: Run Database Migrations

After configuring the connection, set up your database schema:

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database (creates tables)
npm run db:push

# Or use migrations (recommended for production)
npm run db:migrate

# Seed initial data (optional)
npm run db:seed
```

## Step 8: Enable SSL (Recommended for Production)

### 7.1 Generate SSL Certificates on VPS

```bash
# Create SSL directory
sudo mkdir -p /etc/postgresql/ssl
cd /etc/postgresql/ssl

# Generate self-signed certificate (for development)
sudo openssl req -new -x509 -days 365 -nodes -text -out server.crt -keyout server.key -subj "/CN=your-vps-domain.com"

# Set proper permissions
sudo chmod 600 server.key
sudo chown postgres:postgres server.key server.crt
```

### 7.2 Configure PostgreSQL for SSL

Edit `postgresql.conf`:

```bash
sudo nano /etc/postgresql/14/main/postgresql.conf

# Add or modify:
ssl = on
ssl_cert_file = '/etc/postgresql/ssl/server.crt'
ssl_key_file = '/etc/postgresql/ssl/server.key'
```

Restart PostgreSQL:

```bash
sudo systemctl restart postgresql
```

## Security Best Practices

### 1. Use Strong Passwords
- Use a strong, unique password for your database user
- Consider using a password manager

### 2. Restrict IP Access
- Instead of allowing all IPs (`0.0.0.0/0`), restrict to your application server's IP
- Use `YOUR_APP_SERVER_IP/32` in `pg_hba.conf`

### 3. Use SSL/TLS
- Always use SSL connections in production (`sslmode=require`)
- Consider using Let's Encrypt certificates for production

### 4. Change Default Port (Optional)
- Consider changing PostgreSQL port from default 5432 to a non-standard port
- Update firewall rules accordingly

### 5. Regular Backups

**Option 1: Use the provided backup script**

```bash
# Copy backup script to VPS
scp scripts/vps-db-backup.sh user@your-vps-ip:~/

# Make it executable
ssh user@your-vps-ip
chmod +x ~/vps-db-backup.sh
sudo mv ~/vps-db-backup.sh /usr/local/bin/

# Test backup
sudo /usr/local/bin/vps-db-backup.sh

# Add to crontab for daily backups at 2 AM
sudo crontab -e
# Add: 0 2 * * * /usr/local/bin/vps-db-backup.sh
```

**Option 2: Manual backup script**

```bash
# Create backup script
sudo nano /usr/local/bin/pg_backup.sh

# Add:
#!/bin/bash
BACKUP_DIR="/var/backups/postgresql"
DATE=$(date +%Y%m%d_%H%M%S)
sudo -u postgres pg_dump your_database_name > "$BACKUP_DIR/backup_$DATE.sql"

# Make executable
sudo chmod +x /usr/local/bin/pg_backup.sh

# Add to crontab for daily backups
sudo crontab -e
# Add: 0 2 * * * /usr/local/bin/pg_backup.sh
```

**Restore from backup:**
```bash
# Use the provided restore script
sudo bash scripts/vps-db-restore.sh /var/backups/postgresql/backup_file.sql.gz
```

### 6. Monitor Database
- Set up monitoring for database performance
- Monitor disk space and connection limits
- Review PostgreSQL logs regularly

## Troubleshooting

### Connection Refused
- Check if PostgreSQL is running: `sudo systemctl status postgresql`
- Verify firewall rules: `sudo ufw status`
- Check `listen_addresses` in `postgresql.conf`

### Authentication Failed
- Verify username and password
- Check `pg_hba.conf` configuration
- Ensure user has proper permissions

### SSL Connection Issues
- For development, use `sslmode=prefer` or `sslmode=disable`
- For production, ensure SSL certificates are properly configured
- Check PostgreSQL logs: `sudo tail -f /var/log/postgresql/postgresql-14-main.log`

### Connection Timeout
- Verify VPS firewall allows port 5432
- Check if your hosting provider blocks outbound connections
- Verify network connectivity: `ping YOUR_VPS_IP`

## Testing the Connection

You can test your database connection using Prisma Studio:

```bash
npm run db:studio
```

This will open a web interface where you can browse your database and verify the connection works.

## Alternative: Using Connection Pooling

For better performance with multiple connections, consider using a connection pooler like PgBouncer:

1. Install PgBouncer on your VPS
2. Configure it to connect to PostgreSQL
3. Update your connection string to point to PgBouncer instead

## Support

If you encounter issues:
1. Check PostgreSQL logs: `/var/log/postgresql/postgresql-*-main.log`
2. Verify all configuration files are correct
3. Test connection from command line first
4. Ensure firewall and network settings allow connections

