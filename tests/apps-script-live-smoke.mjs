import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { chromium } from 'playwright'

const relayUrl = String(process.env.SALON_RELAY_URL || process.env.VITE_SALON_RELAY_URL || '').trim()
assert.ok(relayUrl, 'SALON_RELAY_URL must be set for the read-only live relay smoke test')

const deployedUrl = new URL(relayUrl)
assert.equal(deployedUrl.protocol, 'https:', 'Apps Script Web App must use HTTPS')
assert.equal(deployedUrl.hostname, 'script.google.com', 'SALON_RELAY_URL must point to the owner-deployed Apps Script Web App')
assert.match(deployedUrl.pathname, /^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/, 'SALON_RELAY_URL must end in the deployed /exec endpoint')
assert.equal(deployedUrl.search, '', 'Use the stable Apps Script /exec URL without query parameters')
assert.equal(deployedUrl.hash, '', 'Apps Script /exec URL must not contain a fragment')

const distRoot = resolve('dist')
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    let relativePath = decodeURIComponent(url.pathname)
      .replace(/^\/salon-booking\/?/, '')
      .replace(/^\/+/, '')
    if (!relativePath) relativePath = 'index.html'

    let filePath = resolve(distRoot, relativePath)
    if (filePath !== distRoot && !filePath.startsWith(distRoot + sep)) {
      response.writeHead(403).end('Forbidden')
      return
    }

    try {
      const info = await stat(filePath)
      if (!info.isFile()) filePath = resolve(distRoot, 'index.html')
    } catch {
      if (extname(relativePath)) {
        response.writeHead(404).end('Not found')
        return
      }
      filePath = resolve(distRoot, 'index.html')
    }

    response.writeHead(200, {
      'content-type': mimeTypes[extname(filePath)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    })
    response.end(await readFile(filePath))
  } catch (error) {
    response.writeHead(500).end(error instanceof Error ? error.message : 'Server error')
  }
})

await new Promise((resolveListen, reject) => {
  server.once('error', reject)
  server.listen(0, '127.0.0.1', resolveListen)
})
const address = server.address()
if (!address || typeof address === 'string') throw new Error('Could not start Apps Script relay smoke-test server')

const origin = 'http://127.0.0.1:' + address.port
const diagnostics = { pageErrors: [], relayResponses: [] }
const browser = await chromium.launch({ headless: true })

try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: 'fa-IR',
    timezoneId: 'Asia/Tehran',
  })
  const page = await context.newPage()
  page.on('pageerror', error => diagnostics.pageErrors.push(error.message))
  page.on('response', response => {
    const url = new URL(response.url())
    if (url.origin === origin && url.pathname.startsWith('/api/')) {
      diagnostics.relayResponses.push({ path: url.pathname, status: response.status() })
    }
  })

  await page.goto(origin + '/salon-booking/', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.locator('iframe[title="Salon booking API relay"]').waitFor({ state: 'attached', timeout: 30000 })

  const result = await page.evaluate(async () => {
    const read = async (path) => {
      const response = await window.fetch(path, {
        method: 'GET',
        cache: 'no-store',
        headers: { accept: 'application/json' },
      })
      let payload
      try { payload = await response.json() } catch { payload = null }
      return { status: response.status, payload }
    }

    const [health, config, services, setup, owner] = await Promise.all([
      read('/api/health'),
      read('/api/public/config'),
      read('/api/public/services'),
      read('/api/admin/setup-status'),
      read('/api/admin/me'),
    ])

    const relayFrame = document.querySelector('iframe[title="Salon booking API relay"]')
    return {
      frameUrl: relayFrame?.src || '',
      health,
      config,
      services,
      setup,
      owner,
    }
  })

  assert.equal(result.frameUrl, relayUrl, 'the published frontend must load the configured Apps Script /exec URL')
  assert.equal(result.health.status, 200, 'Apps Script /api/health must return HTTP 200: ' + JSON.stringify(result.health))
  assert.equal(result.health.payload?.ok, true, 'Apps Script health response must be successful')
  assert.equal(result.health.payload?.service, 'salon-booking-apps-script', 'the endpoint must run the Apps Script backend, not an old relay')
  assert.equal(result.health.payload?.version, '1.1.0', 'the deployed Apps Script source must be upgraded to the current backend version')

  assert.equal(result.config.status, 200, 'private Sheets settings must be readable through the public config route: ' + JSON.stringify(result.config))
  assert.equal(result.config.payload?.ok, true, 'public config response must be successful')
  assert.equal(typeof result.config.payload?.configured, 'boolean', 'public config must report whether the salon timezone is configured')

  assert.equal(result.services.status, 200, 'public service catalog must be readable: ' + JSON.stringify(result.services))
  assert.equal(result.services.payload?.ok, true, 'public service catalog response must be successful')
  assert.ok(Array.isArray(result.services.payload?.services), 'public service catalog must be an array')

  assert.equal(result.setup.status, 200, 'anonymous owner setup status must be readable: ' + JSON.stringify(result.setup))
  assert.equal(result.setup.payload?.ok, true, 'owner setup status response must be successful')
  assert.equal(typeof result.setup.payload?.initialized, 'boolean', 'owner setup status must report initialization state')

  assert.equal(result.owner.status, 401, 'a fresh anonymous session must not have owner access')
  assert.equal(result.owner.payload?.error, 'unauthorized', 'anonymous owner access must be rejected explicitly')

  assert.deepEqual(diagnostics.pageErrors, [], 'the published frontend must have no uncaught browser exceptions')
  console.log('[apps-script-live] published Pages build loaded the configured Apps Script iframe')
  console.log('[apps-script-live] backend health/version, private Sheets reads, public catalog and owner access boundary passed')
  console.log('[apps-script-live] no booking, customer PII, owner mutation or notification was created')
  console.log('PASS: read-only Apps Script end-to-end relay smoke completed')
  await context.close()
} finally {
  await browser.close()
  await new Promise(resolveClose => server.close(resolveClose))
}
