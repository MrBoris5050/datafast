# Database Setup Scripts

This directory contains automated scripts to help you set up and manage your VPS database.

## Available Scripts

### 1. `vps-db-setup.sh` - Automated Database Setup
**Run this on your VPS** to automatically install and configure PostgreSQL.

**Usage:**
```bash
# Copy script to VPS
scp scripts/vps-db-setup.sh user@your-vps-ip:~/

# SSH into VPS
ssh user@your-vps-ip

# Run the script
sudo bash ~/vps-db-setup.sh
```

**What it does:**
- Detects your OS (Ubuntu/Debian/CentOS)
- Installs PostgreSQL
- Creates database and user
- Configures remote access
- Sets up firewall rules
- Generates connection string

### 2. `vps-db-test-connection.sh` - Test Database Connection
**Run this from your local machine** to test if you can connect to your VPS database.

**Usage:**
```bash
bash scripts/vps-db-test-connection.sh
```

**What it does:**
- Prompts for connection details
- Tests the connection
- Shows database version if successful
- Provides troubleshooting tips if failed

### 3. `vps-db-backup.sh` - Database Backup
**Run this on your VPS** to create automated backups.

**Usage:**
```bash
# Copy to VPS
scp scripts/vps-db-backup.sh user@your-vps-ip:~/

# SSH into VPS
ssh user@your-vps-ip

# Make executable and move to system path
chmod +x ~/vps-db-backup.sh
sudo mv ~/vps-db-backup.sh /usr/local/bin/

# Run backup manually
sudo /usr/local/bin/vps-db-backup.sh

# Or add to crontab for daily backups at 2 AM
sudo crontab -e
# Add this line:
0 2 * * * /usr/local/bin/vps-db-backup.sh
```

**Configuration:**
Set environment variables before running:
```bash
export DB_NAME="inventor"
export DB_USER="postgres"
export BACKUP_DIR="/var/backups/postgresql"
export RETENTION_DAYS=7  # Keep backups for 7 days
```

### 4. `vps-db-restore.sh` - Restore Database from Backup
**Run this on your VPS** to restore a database from a backup file.

**Usage:**
```bash
# Copy to VPS
scp scripts/vps-db-restore.sh user@your-vps-ip:~/

# SSH into VPS
ssh user@your-vps-ip

# Restore from backup
sudo bash ~/vps-db-restore.sh /var/backups/postgresql/inventor_backup_20240101_020000.sql.gz
```

**⚠️ Warning:** This will replace all data in your database!

## Quick Setup Workflow

1. **On your VPS:**
   ```bash
   # Upload and run setup script
   scp scripts/vps-db-setup.sh user@your-vps-ip:~/
   ssh user@your-vps-ip
   sudo bash ~/vps-db-setup.sh
   ```

2. **Copy the connection string** from the script output

3. **On your local machine:**
   ```bash
   # Update .env.local with the connection string
   # Then test the connection
   bash scripts/vps-db-test-connection.sh
   ```

4. **In your project:**
   ```bash
   # Generate Prisma client and push schema
   npm run db:generate
   npm run db:push
   ```

5. **Set up automated backups:**
   ```bash
   # On VPS
   scp scripts/vps-db-backup.sh user@your-vps-ip:~/
   ssh user@your-vps-ip
   chmod +x ~/vps-db-backup.sh
   sudo mv ~/vps-db-backup.sh /usr/local/bin/
   sudo crontab -e
   # Add: 0 2 * * * /usr/local/bin/vps-db-backup.sh
   ```

## Troubleshooting

### Script Permission Denied
```bash
chmod +x script-name.sh
```

### PostgreSQL Not Starting
```bash
# Check logs
sudo journalctl -u postgresql -n 50

# Check status
sudo systemctl status postgresql
```

### Connection Refused
- Verify firewall allows port 5432
- Check `pg_hba.conf` configuration
- Ensure PostgreSQL is listening on all interfaces

### Backup Fails
- Ensure backup directory exists and is writable
- Check disk space: `df -h`
- Verify database name and user are correct

## Security Notes

- **Never commit these scripts with real passwords**
- **Use strong passwords** for database users
- **Restrict IP access** in production (don't allow 0.0.0.0/0)
- **Enable SSL** for production connections
- **Regular backups** are essential - automate them!

## Support

For detailed manual setup instructions, see [VPS_DATABASE_SETUP.md](../docs/VPS_DATABASE_SETUP.md)





