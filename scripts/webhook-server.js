/**
 * GitHub Webhook listener — runs on the VPS
 * Triggered by a GitHub push event → pulls + rebuilds + reloads PM2
 *
 * Default port: 9011 (override with WEBHOOK_PORT env var)
 * Set WEBHOOK_SECRET in .env to match the secret you set in GitHub.
 */

const http = require('http')
const crypto = require('crypto')
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

// Load .env so SECRET / DEPLOY_BRANCH / WEBHOOK_PORT are picked up when run via PM2
try {
  const envPath = path.join(__dirname, '..', '.env')
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n')
    for (const raw of lines) {
      const line = raw.trim()
      if (!line || line.startsWith('#')) continue
      const eq = line.indexOf('=')
      if (eq === -1) continue
      const key = line.slice(0, eq).trim()
      let value = line.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!(key in process.env)) process.env[key] = value
    }
  }
} catch (_) {
  // best-effort .env load — ignore failures
}

const PORT = Number(process.env.WEBHOOK_PORT || 9011)
const APP_DIR = process.env.APP_DIR || '/var/www/datafast'
const LOG_FILE = process.env.WEBHOOK_LOG || '/var/log/datafast-deploy.log'
const BRANCH = process.env.DEPLOY_BRANCH || 'main'
const SECRET = process.env.WEBHOOK_SECRET || ''

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  process.stdout.write(line)
  try {
    fs.appendFileSync(LOG_FILE, line)
  } catch (_) {
    // log file might not be writable yet; stdout is enough
  }
}

function verifySignature(body, signature) {
  if (!SECRET) return true // skip verification if no secret set (not recommended)
  const hmac = crypto.createHmac('sha256', SECRET)
  hmac.update(body)
  const expected = `sha256=${hmac.digest('hex')}`
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

function runDeploy() {
  log('=== Deploy started ===')
  const steps = [
    `cd ${APP_DIR} && git pull origin ${BRANCH}`,
    `cd ${APP_DIR} && npm ci --prefer-offline`,
    `cd ${APP_DIR} && npm run build`,
    `pm2 reload datafast --update-env`,
    `pm2 save`,
  ]

  for (const cmd of steps) {
    log(`Running: ${cmd}`)
    try {
      const out = execSync(cmd, { encoding: 'utf8', timeout: 300_000 })
      log(out.trim())
    } catch (err) {
      log(`ERROR: ${err.message}`)
      log('=== Deploy FAILED ===')
      return false
    }
  }

  log('=== Deploy SUCCESS ===')
  return true
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/deploy-hook') {
    res.writeHead(404)
    res.end('Not found')
    return
  }

  let body = ''
  req.on('data', chunk => { body += chunk })
  req.on('end', () => {
    const sig = req.headers['x-hub-signature-256'] || ''

    if (!verifySignature(body, sig)) {
      log('Webhook rejected: invalid signature')
      res.writeHead(401)
      res.end('Unauthorized')
      return
    }

    let payload
    try { payload = JSON.parse(body) } catch { payload = {} }

    const ref = payload.ref || ''
    if (ref && ref !== `refs/heads/${BRANCH}`) {
      log(`Ignored push to ${ref} (watching ${BRANCH})`)
      res.writeHead(200)
      res.end('Ignored — wrong branch')
      return
    }

    log(`Webhook received. Ref: ${ref}`)
    res.writeHead(200)
    res.end('Deploy triggered')

    // Run deploy async so we don't block the HTTP response
    setImmediate(() => runDeploy())
  })
})

server.listen(PORT, '127.0.0.1', () => {
  log(`Webhook server listening on 127.0.0.1:${PORT}`)
})
