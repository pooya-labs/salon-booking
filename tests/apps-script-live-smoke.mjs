import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const relayUrl = String(process.env.SALON_RELAY_URL || '').trim()
const pagesUrl = String(process.env.SALON_BOOKING_PAGES_URL || 'https://pooya-labs.github.io/salon-booking/').trim()
assert.ok(relayUrl, 'SALON_RELAY_URL must be set for the read-only live relay smoke test')

const deployedUrl = new URL(relayUrl)
assert.equal(deployedUrl.protocol, 'https:', 'Apps Script Web App must use HTTPS')
assert.equal(deployedUrl.hostname, 'script.google.com', 'SALON_RELAY_URL must point to the owner-deployed Apps Script Web App')
assert.match(deployedUrl.pathname, /^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/, 'SALON_RELAY_URL must end in the deployed /exec endpoint')
assert.equal(deployedUrl.search, '', 'Use the stable Apps Script /exec URL without query parameters')
assert.equal(deployedUrl.hash, '', 'Apps Script /exec URL must not contain a fragment')
assert.equal(new URL(pagesUrl).origin, 'https://pooya-labs.github.io', 'Live smoke must run from the origin allowed by the Apps Script bridge')

const diagnostics = { pageErrors: [] }
const browser = await chromium.launch({ headless: true })

try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: 'fa-IR',
    timezoneId: 'Asia/Tehran',
  })
  const page = await context.newPage()
  page.on('pageerror', error => diagnostics.pageErrors.push(error.message))
  await page.addInitScript(() => {
    window.__salonRelayMessages = []
    window.addEventListener('message', (event) => {
      const type = event.data?.type
      if (typeof type === 'string' && type.indexOf('SALON_RELAY_') === 0) {
        window.__salonRelayMessages.push({ type, origin: event.origin })
      }
    })
  })

  await page.goto(pagesUrl, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.locator('iframe[title="Salon booking API relay"]').waitFor({ state: 'attached', timeout: 30000 })

  const relayFrame = page.frames().find(frame => frame.parentFrame() === page.mainFrame())
  assert.ok(relayFrame, 'Apps Script relay iframe must create a child browsing context')
  await relayFrame.waitForLoadState('load', { timeout: 30000 })

  let bridgeFrame = null
  const bridgeDeadline = Date.now() + 25000
  while (!bridgeFrame && Date.now() < bridgeDeadline) {
    for (const candidate of page.frames()) {
      if (candidate === page.mainFrame()) continue
      try {
        const hasGoogleRun = await candidate.evaluate(() =>
          typeof google !== 'undefined' && Boolean(google.script && google.script.run)
        )
        if (hasGoogleRun) {
          bridgeFrame = candidate
          break
        }
      } catch {}
    }
    if (!bridgeFrame) await page.waitForTimeout(500)
  }

  const frameSnapshots = await Promise.all(page.frames().filter(frame => frame !== page.mainFrame()).map(async frame => {
    try {
      return await frame.evaluate(() => {
        const scriptText = Array.from(document.scripts).map(script => script.textContent || '').join('\n')
        const expectedOrigin = /PARENT_ORIGIN\s*=\s*['"]([^'"]+)['"]/.exec(scriptText)?.[1] || ''
        return {
          url: location.href,
          origin: location.origin,
          title: document.title,
          readyState: document.readyState,
          expectedParentOrigin: expectedOrigin,
          googleScriptRunAvailable: typeof google !== 'undefined' && Boolean(google.script && google.script.run),
          bodyText: (document.body?.innerText || '').slice(0, 700),
          scriptSources: Array.from(document.scripts).map(script => script.src).filter(Boolean).slice(0, 8),
          childFrames: Array.from(document.querySelectorAll('iframe')).map(iframe => iframe.src).slice(0, 8),
        }
      })
    } catch (error) {
      return { url: frame.url(), snapshotError: String(error) }
    }
  }))
  console.log('[apps-script-live] all frame snapshots: ' + JSON.stringify(frameSnapshots))

  const frameDiagnostics = bridgeFrame ? await bridgeFrame.evaluate(() => {
    const scriptText = Array.from(document.scripts).map(script => script.textContent || '').join('\n')
    const expectedOrigin = /PARENT_ORIGIN\s*=\s*['"]([^'"]+)['"]/.exec(scriptText)?.[1] || ''
    return {
      readyState: document.readyState,
      origin: location.origin,
      expectedParentOrigin: expectedOrigin,
      googleScriptRunAvailable: typeof google !== 'undefined' && Boolean(google.script && google.script.run),
    }
  }) : {
    readyState: '',
    origin: '',
    expectedParentOrigin: '',
    googleScriptRunAvailable: false,
  }
  if (!bridgeFrame) {
    throw new Error('No Apps Script HtmlService frame exposed google.script.run. Frame diagnostics: ' + JSON.stringify(frameSnapshots))
  }
  const bridgeMessages = await page.evaluate(() => window.__salonRelayMessages)
  console.log('[apps-script-live] iframe diagnostics: ' + JSON.stringify({
    readyState: frameDiagnostics.readyState,
    origin: frameDiagnostics.origin,
    expectedParentOrigin: frameDiagnostics.expectedParentOrigin,
    googleScriptRunAvailable: frameDiagnostics.googleScriptRunAvailable,
    readyMessageReceived: bridgeMessages.some(message => message.type === 'SALON_RELAY_READY'),
  }))

  const directHealth = await bridgeFrame.evaluate(() => new Promise(resolve => {
    let settled = false
    const finish = value => {
      if (settled) return
      settled = true
      window.clearTimeout(timeoutId)
      resolve(value)
    }
    const timeoutId = window.setTimeout(() => finish({ kind: 'timeout' }), 20000)
    try {
      google.script.run
        .withSuccessHandler(result => finish({ kind: 'success', result }))
        .withFailureHandler(error => finish({ kind: 'failure', message: String(error?.message || error) }))
        .proxyRequest({
          path: '/api/health',
          method: 'GET',
          headers: { accept: 'application/json' },
          body: null,
          sessionId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        })
    } catch (error) {
      finish({ kind: 'failure', message: String(error?.message || error) })
    }
  }))
  console.log('[apps-script-live] direct Apps Script health diagnostic: ' + JSON.stringify(directHealth))
  assert.equal(directHealth.kind, 'success', 'google.script.run must invoke proxyRequest: ' + JSON.stringify({ frameDiagnostics, bridgeMessages, directHealth }))
  assert.equal(directHealth.result?.status, 200, 'direct Apps Script health must respond with HTTP 200: ' + JSON.stringify(directHealth))
  const directHealthPayload = JSON.parse(directHealth.result?.body || '{}')
  assert.equal(directHealthPayload.service, 'salon-booking-apps-script', 'deployed Apps Script must expose the current backend health contract')
  const readyMessage = bridgeMessages.find(message => message.type === 'SALON_RELAY_READY')
  const readyHost = readyMessage ? new URL(readyMessage.origin).hostname : ''
  assert.ok(
    readyMessage && (readyHost === 'script.googleusercontent.com' || /^[a-z0-9-]+-script\.googleusercontent\.com$/i.test(readyHost)),
    'Bridge.html must announce readiness from the nested Apps Script origin to the Pages top window: ' +
      JSON.stringify({ frameDiagnostics, bridgeMessages }),
  )

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

    const currentRelayFrame = document.querySelector('iframe[title="Salon booking API relay"]')
    return {
      frameUrl: currentRelayFrame?.src || '',
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
  console.log('[apps-script-live] published GitHub Pages site loaded the configured Apps Script iframe')
  console.log('[apps-script-live] backend version 1.1.0 and private Sheets read routes passed')
  console.log('[apps-script-live] public services: ' + result.services.payload.services.length)
  console.log('[apps-script-live] salon timezone configured: ' + result.config.payload.configured)
  console.log('[apps-script-live] owner account initialized: ' + result.setup.payload.initialized)
  console.log('[apps-script-live] anonymous owner access correctly rejected')
  console.log('[apps-script-live] no booking, customer PII, owner mutation or notification was created')
  console.log('PASS: read-only Apps Script end-to-end relay smoke completed')
  await context.close()
} finally {
  await browser.close()
}
