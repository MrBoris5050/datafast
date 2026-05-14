#!/bin/bash
# ============================================================
# datafast VPS — Deploy / Update the app
# Run from inside /var/www/datafaston the VPS, or pass path
# Usage: bash scripts/vps-app-deploy.sh [/path/to/app]
# ============================================================

set -e

APP_DIR="${1:-/var/www/datafast}"
APP_NAME="datafast"

echo "============================================"
echo " datafast Deploy"
echo " Directory: $APP_DIR"
echo "============================================"

cd "$APP_DIR"

# ── Verify .env exists ─────────────────────────
if [ ! -f ".env" ]; then
  echo "[ERROR] .env file not found in $APP_DIR"
  echo "  Create it from .env.production.example before deploying."
  exit 1
fi

# ── Install dependencies ───────────────────────
echo "[1/4] Installing dependencies..."
npm ci --prefer-offline

# ── Build ─────────────────────────────────────
echo "[2/4] Building Next.js app..."
npm run build

# ── Start or restart via PM2 ──────────────────
echo "[3/4] Starting / restarting PM2 process..."
if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
  pm2 reload "$APP_NAME" --update-env
  echo "  → Reloaded existing PM2 process."
else
  pm2 start ecosystem.config.js --env production
  pm2 save
  echo "  → Started new PM2 process and saved."
fi

# ── Cron job for stuck orders ─────────────────
echo "[4/4] Setting up cron job for stuck-orders check..."

CRON_SECRET=$(grep -oP '(?<=CRON_SECRET=)[^\s]+' .env | head -1)
APP_URL=$(grep -oP '(?<=NEXTAUTH_URL=)[^\s]+' .env | head -1)

if [ -z "$APP_URL" ]; then
  echo "  [WARN] NEXTAUTH_URL not found in .env — skipping cron setup."
else
  CRON_CMD="*/20 * * * * curl -s -X GET \"${APP_URL}/api/cron/stuck-orders\" -H \"Authorization: Bearer ${CRON_SECRET}\" >> /var/log/datafast-cron.log 2>&1"

  # Remove old entry if any, then add fresh
  (crontab -l 2>/dev/null | grep -v "stuck-orders"; echo "$CRON_CMD") | crontab -
  echo "  → Cron job installed: runs every 20 minutes."
fi

echo ""
echo "============================================"
echo " Deploy complete!"
echo ""
pm2 status "$APP_NAME"
echo ""
echo " App logs:  pm2 logs $APP_NAME"
echo " App status: pm2 status"
echo "============================================"
