/**
 * GitHub Webhook listener — runs on the VPS (port 9001)
 * Triggered by a GitHub push event → pulls + rebuilds + reloads PM2
 *
 * Set WEBHOOK_SECRET in .env to match the secret you set in GitHub.
 */

const http = require('http')
const crypto = require('crypto')
const { execSync } = require('child_process')
const fs = require('fs')

const PORT = 9001
const APP_DIR = '/var/www/datafast'
const LOG_FILE = '/var/log/datafast-deploy.log'
const BRANCH = process.env.DEPLOY_BRANCH || 'main'
const SECRET = process.env.WEBHOOK_SECRET || ''

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  process.stdout.write(line)
  fs.appendFileSync(LOG_FILE, line)
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
    `pm2 reload datafast--update-env`,
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
