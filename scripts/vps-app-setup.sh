#!/bin/bash
# ============================================================
# datafast VPS — One-time server setup
# Run this ONCE on a fresh Ubuntu 22.04 VPS as root or sudo user
# Usage: sudo bash scripts/vps-app-setup.sh
# ============================================================

set -e

APP_DIR="/var/www/datafast"
LOG_DIR="/var/log/pm2"
NODE_VERSION="20"
DOMAIN="datafastbyte.com"

echo "============================================"
echo " datafast VPS Setup"
echo " App dir: $APP_DIR"
echo " Domain:  $DOMAIN"
echo "============================================"

# ── System update ──────────────────────────────
echo "[1/7] Updating system packages..."
apt-get update -y && apt-get upgrade -y
apt-get install -y curl git unzip nginx certbot python3-certbot-nginx ufw

# ── Node.js 20 LTS via NodeSource ──────────────
if ! command -v node >/dev/null 2>&1; then
  echo "[2/7] Installing Node.js $NODE_VERSION LTS..."
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt-get install -y nodejs
else
  echo "[2/7] Node.js already installed: $(node -v)"
fi
node -v && npm -v

# ── PM2 ────────────────────────────────────────
if ! command -v pm2 >/dev/null 2>&1; then
  echo "[3/7] Installing PM2..."
  npm install -g pm2
else
  echo "[3/7] PM2 already installed: $(pm2 --version)"
fi

# ── App + log directories ──────────────────────
echo "[4/7] Creating $APP_DIR and $LOG_DIR ..."
mkdir -p "$APP_DIR"
mkdir -p "$LOG_DIR"
touch /var/log/datafast-deploy.log
touch /var/log/datafast-cron.log
chown -R "$USER:$USER" "$APP_DIR"
chown -R "$USER:$USER" "$LOG_DIR"

# ── PM2 startup (auto-restart on reboot) ───────
echo "[5/7] Configuring PM2 startup (run the printed command if shown)..."
pm2 startup systemd -u "$USER" --hp "$HOME" || true

# ── Firewall ───────────────────────────────────
echo "[6/7] Configuring UFW firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
ufw status

# ── Nginx + (optional) install datafast site ───
echo "[7/7] Enabling Nginx..."
systemctl enable nginx
systemctl start nginx

if [ -f "$APP_DIR/nginx/datafast.conf" ]; then
  echo "  → Installing nginx/datafast.conf to /etc/nginx/sites-available/datafast"
  cp "$APP_DIR/nginx/datafast.conf" /etc/nginx/sites-available/datafast
  ln -sf /etc/nginx/sites-available/datafast /etc/nginx/sites-enabled/datafast
  nginx -t && systemctl reload nginx
  echo "  → Nginx reloaded."
else
  echo "  → $APP_DIR/nginx/datafast.conf not found; copy it after deploying code."
fi

echo ""
echo "============================================"
echo " Setup complete!"
echo ""
echo " Next steps:"
echo "  1. Make sure DNS for $DOMAIN points to this VPS."
echo "  2. Clone the repo into $APP_DIR (or git pull if already cloned)."
echo "  3. Copy your production .env into $APP_DIR/.env"
echo "  4. Run: bash $APP_DIR/scripts/vps-app-deploy.sh"
echo "  5. Issue SSL: sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo "============================================"
