# datafast — VPS Deployment Runbook

End-to-end guide for getting **datafastbyte.com** live on the VPS at `31.97.154.198`.

| Resource | Value |
|---|---|
| Domain | `datafastbyte.com` (+ `www.datafastbyte.com` redirect) |
| App dir | `/var/www/datafast` |
| Next.js app port | `127.0.0.1:3011` (PM2 process **`datafast`**) |
| Deploy webhook port | `127.0.0.1:9011` (PM2 process **`datafast-webhook`**) |
| Public webhook URL | `https://datafastbyte.com/deploy-hook` |
| Postgres | `31.97.154.198:5432` (already running on VPS, see `.env`) |
| Existing neighbours on the box | datalite (3000, 9001), other Next apps on 3002–3007, projects on 9000/9002/9003 |

> If anything below references a port already in use, double-check with `sudo ss -tlnp` first.

---

## 0. DNS — point the domain at the VPS

In your domain registrar, set:

| Type | Name | Value |
|---|---|---|
| A | `@` | `31.97.154.198` |
| A | `www` | `31.97.154.198` |

Verify before continuing:

```bash
dig +short datafastbyte.com       # should print 31.97.154.198
dig +short www.datafastbyte.com   # same
```

---

## 1. One-time VPS bootstrap (skip if you've done it before)

SSH into the VPS:

```bash
ssh root@31.97.154.198
```

Clone the repo and run the setup script:

```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/<your-org>/datafast.git datafast
cd /var/www/datafast
sudo bash scripts/vps-app-setup.sh
```

What this does:

- Installs Node.js 20 LTS, PM2, Nginx, Certbot, UFW
- Creates `/var/www/datafast` and `/var/log/pm2`
- Configures PM2 to start on boot
- Opens UFW (SSH + Nginx Full)
- Copies `nginx/datafast.conf` to `/etc/nginx/sites-available/datafast` and enables it

> ⚠️ The setup also runs `pm2 startup systemd …`. If it prints a command starting with `sudo env PATH=…`, **copy + run that command** — that's what makes PM2 actually survive reboots.

---

## 2. Create the production `.env`

```bash
nano /var/www/datafast/.env
```

Paste the contents from your local `.env`. Make sure these are correct for production:

```env
NEXTAUTH_URL=https://datafastbyte.com
WEBHOOK_SECRET=...                # same value you'll put in GitHub
DEPLOY_BRANCH=main
```

Lock it down:

```bash
chmod 600 /var/www/datafast/.env
```

---

## 3. First deploy

```bash
cd /var/www/datafast
bash scripts/vps-app-deploy.sh
```

This does: `npm ci` → `npm run build` → `pm2 start ecosystem.config.js --env production` → `pm2 save` → installs the `/api/cron/stuck-orders` cron job.

Verify both PM2 processes are running:

```bash
pm2 status
# Expect:
#  datafast           online   port 3011
#  datafast-webhook   online   port 9011
```

Quick smoke test of the app directly (bypassing nginx):

```bash
curl -I http://127.0.0.1:3011
# HTTP/1.1 200 OK   (or 307/308 redirect — both fine)
```

---

## 4. Issue the SSL certificate

```bash
sudo certbot --nginx -d datafastbyte.com -d www.datafastbyte.com
```

Pick the redirect option (force HTTPS). Certbot will rewrite `/etc/nginx/sites-available/datafast` to add the `:443` server blocks.

Auto-renewal is already wired by the `certbot` package. Sanity check:

```bash
sudo certbot renew --dry-run
```

---

## 5. Verify

```bash
curl -I https://datafastbyte.com           # 200 OK
curl -I https://www.datafastbyte.com       # 301 → https://datafastbyte.com
```

Open the site in a browser. Sign in works → you're done with the manual part.

---

## 6. Wire up GitHub auto-deploy (optional but recommended)

The webhook listener is already running on `127.0.0.1:9011` and exposed publicly via nginx at `https://datafastbyte.com/deploy-hook`.

In your GitHub repo:

1. **Settings → Webhooks → Add webhook**
2. **Payload URL:** `https://datafastbyte.com/deploy-hook`
3. **Content type:** `application/json`
4. **Secret:** the value of `WEBHOOK_SECRET` from `/var/www/datafast/.env`
5. **Events:** *Just the push event*
6. **Active:** ✅

Push a small commit to `main` and watch:

```bash
tail -f /var/log/datafast-deploy.log
```

You should see the webhook fire → git pull → npm ci → build → `pm2 reload datafast --update-env`.

---

## 7. Day-2 commands

```bash
# Live logs
pm2 logs datafast
pm2 logs datafast-webhook

# Status
pm2 status

# Manual reload after editing .env
cd /var/www/datafast && pm2 reload datafast --update-env

# Manual full deploy (same as the webhook does)
bash /var/www/datafast/scripts/vps-app-deploy.sh

# Nginx
sudo nginx -t
sudo systemctl reload nginx
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

---

## 8. Troubleshooting

**Site loads but says "502 Bad Gateway"**
→ App not running on 3011. Check `pm2 status` and `pm2 logs datafast`.

**`NEXTAUTH_URL` mismatch / sign-in loops**
→ Make sure `/var/www/datafast/.env` has `NEXTAUTH_URL=https://datafastbyte.com` (no trailing slash) and `pm2 reload datafast --update-env`.

**Webhook fires but deploy fails**
→ `tail -f /var/log/datafast-deploy.log`. Most common cause: the deploy user can't `git pull` (set up an SSH deploy key on the VPS) or can't write to `/var/www/datafast` (`chown` it).

**Port collision after a reboot**
→ Check `sudo ss -tlnp | grep -E ':(3011|9011) '` — if something else grabbed it, edit `ecosystem.config.js` and `nginx/datafast.conf` to a new free port and `pm2 reload datafast`.

**Certificate didn't renew**
→ `sudo certbot renew --dry-run` and read the error. Usually a port-80 nginx misconfig.
