#!/bin/bash
# ============================================================
# datafast VPS — One-time server setup
# Run this ONCE on a fresh Ubuntu 22.04 VPS as root or sudo user
# Usage: sudo bash scripts/vps-app-setup.sh
# ============================================================

set -e

APP_DIR="/var/www/datafast"
APP_USER="www-data"
LOG_DIR="/var/log/pm2"
NODE_VERSION="20"

echo "============================================"
echo " datafast VPS Setup"
echo "============================================"

# ── System update ──────────────────────────────
echo "[1/7] Updating system packages..."
apt-get update -y && apt-get upgrade -y
apt-get install -y curl git unzip nginx certbot python3-certbot-nginx ufw

# ── Node.js 20 LTS via NodeSource ──────────────
echo "[2/7] Installing Node.js $NODE_VERSION LTS..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt-get install -y nodejs
node -v && npm -v

# ── PM2 ────────────────────────────────────────
echo "[3/7] Installing PM2..."
npm install -g pm2
pm2 --version

# ── App directory ──────────────────────────────
echo "[4/7] Creating app directory at $APP_DIR..."
mkdir -p "$APP_DIR"
mkdir -p "$LOG_DIR"
chown -R $USER:$USER "$APP_DIR"
chown -R $USER:$USER "$LOG_DIR"

# ── PM2 startup (auto-restart on reboot) ───────
echo "[5/7] Configuring PM2 startup..."
pm2 startup systemd -u $USER --hp $HOME
echo "  → Run the command printed above to enable PM2 on boot."

# ── Firewall ───────────────────────────────────
echo "[6/7] Configuring UFW firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
ufw status

# ── Nginx ──────────────────────────────────────
echo "[7/7] Enabling Nginx..."
systemctl enable nginx
systemctl start nginx

echo ""
echo "============================================"
echo " Setup complete!"
echo ""
echo " Next steps:"
echo "  1. Copy your project to $APP_DIR"
echo "  2. Create $APP_DIR/.env with production values"
echo "  3. Run: bash scripts/vps-app-deploy.sh"
echo "  4. Copy nginx/datafast.conf to /etc/nginx/sites-available/"
echo "  5. If you have a domain, run: certbot --nginx -d yourdomain.com"
echo "============================================"
