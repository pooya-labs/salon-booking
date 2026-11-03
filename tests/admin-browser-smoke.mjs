import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { chromium } from 'playwright'

const distRoot = resolve('dist')
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
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
    const relativePath = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
    let filePath = resolve(distRoot, relativePath || 'index.html')
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
if (!address || typeof address === 'string') throw new Error('Could not start owner UI test server')
const origin = 'http://127.0.0.1:' + address.port
const apiCalls = []
const diagnostics = { pageErrors: [], consoleErrors: [], failedRequests: [], badResponses: [], externalRequests: [] }

const browser = await chromium.launch({ headless: true })
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 960 },
    locale: 'fa-IR',
    timezoneId: 'Asia/Tehran',
  })
  const page = await context.newPage()
  page.on('pageerror', error => diagnostics.pageErrors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') diagnostics.consoleErrors.push(message.text())
  })
  page.on('request', request => {
    if (new URL(request.url()).origin !== origin) diagnostics.externalRequests.push(request.url())
  })
  page.on('requestfailed', request => diagnostics.failedRequests.push(request.url()))
  page.on('response', response => {
    if (response.status() >= 400 && new URL(response.url()).origin === origin) {
      diagnostics.badResponses.push(response.status() + ' ' + response.url())
    }
  })

  await page.route('**/api/admin/**', async route => {
    const url = new URL(route.request().url())
    const path = url.pathname
    if (path === '/api/admin/me') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        ok: true, user: { id: 'qa-owner', username: 'QA Owner' },
      }) })
      return
    }
    if (path === '/api/admin/bookings') {
      const from = url.searchParams.get('from') ?? '2026-11-03'
      const to = url.searchParams.get('to') ?? '2026-11-09'
      const status = url.searchParams.get('status') ?? 'all'
      apiCalls.push({ from, to, status })
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        ok: true, timezone: 'Asia/Tehran', from, to, bookings: [],
      }) })
      return
    }
    if (path === '/api/admin/services') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        ok: true, services: [],
      }) })
      return
    }
    if (path === '/api/admin/schedule') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        ok: true,
        settings: {
          timezone: 'Asia/Tehran',
          slotIntervalMinutes: 15,
          minBookingNoticeMinutes: 120,
          bookingWindowDays: 30,
          bufferMinutes: 0,
        },
        weeklyHours: [],
        exceptions: [],
      }) })
      return
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({
      ok: false, error: 'not_found',
    }) })
  })

  await page.goto(origin + '/admin', { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'سلام، QA Owner.' }).waitFor({ state: 'visible' })
  await page.locator('.admin-date-navigation [role="status"]').waitFor({ state: 'visible' })
  await page.locator('.admin-manage-tabs').waitFor({ state: 'visible' })

  assert.ok(apiCalls.some(call => call.from === '2026-11-03' && call.to === '2026-11-09' && call.status === 'all'),
    'initial dashboard request should use the API default seven-day range')

  const next = page.getByRole('button', { name: 'هفت روز بعد' })
  const previous = page.getByRole('button', { name: 'هفت روز قبل' })
  const rangeLabel = page.locator('.admin-date-navigation [role="status"]')

  let responsePromise = page.waitForResponse(response => {
    const url = new URL(response.url())
    return url.pathname === '/api/admin/bookings'
      && url.searchParams.get('from') === '2026-11-10'
      && url.searchParams.get('to') === '2026-11-16'
      && response.status() === 200
  })
  await next.click()
  await responsePromise
  await page.waitForFunction(() => !document.querySelector('button[aria-label="هفت روز بعد"]')?.disabled)
  assert.ok((await rangeLabel.innerText()).includes('تا'), 'range label should display both localized Jalali dates')

  responsePromise = page.waitForResponse(response => {
    const url = new URL(response.url())
    return url.pathname === '/api/admin/bookings'
      && url.searchParams.get('from') === '2026-11-03'
      && url.searchParams.get('to') === '2026-11-09'
      && response.status() === 200
  })
  await previous.click()
  await responsePromise
  await page.waitForFunction(() => !document.querySelector('button[aria-label="هفت روز قبل"]')?.disabled)

  await page.locator('.admin-filter select').selectOption('pending')
  await page.waitForFunction(() => Array.from(document.querySelectorAll('.admin-filter select')).some(select => select.value === 'pending'))
  assert.ok(apiCalls.some(call => call.from === '2026-11-03' && call.to === '2026-11-09' && call.status === 'pending'),
    'status filter should preserve the selected date range')

  responsePromise = page.waitForResponse(response => {
    const url = new URL(response.url())
    return url.pathname === '/api/admin/bookings'
      && !url.searchParams.has('from')
      && !url.searchParams.has('to')
      && url.searchParams.get('status') === 'pending'
      && response.status() === 200
  })
  await page.getByRole('button', { name: 'هفت روز آینده' }).click()
  await responsePromise
  await page.waitForFunction(() => !document.querySelector('button[aria-label="هفت روز بعد"]')?.disabled)
  assert.ok(apiCalls.some(call => call.from === '2026-11-03' && call.to === '2026-11-09' && call.status === 'pending'),
    'reset should restore the API default seven-day range and preserve the status filter')

  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    const metrics = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    }))
    assert.ok(metrics.document <= metrics.viewport + 1, 'owner dashboard horizontal overflow at ' + width + 'px: ' + JSON.stringify(metrics))
    assert.ok(metrics.body <= metrics.viewport + 1, 'owner dashboard body overflow at ' + width + 'px: ' + JSON.stringify(metrics))
  }

  assert.deepEqual(diagnostics.pageErrors, [], 'uncaught owner dashboard exceptions')
  assert.deepEqual(diagnostics.consoleErrors, [], 'owner dashboard console errors')
  assert.deepEqual(diagnostics.failedRequests, [], 'failed owner dashboard requests')
  assert.deepEqual(diagnostics.badResponses, [], 'owner dashboard HTTP errors')
  assert.deepEqual(diagnostics.externalRequests, [], 'owner dashboard should not load third-party resources')
  console.log('[admin-browser] seven-day range navigation forward/back/reset passed')
  console.log('[admin-browser] status filter preserves selected range')
  console.log('[admin-browser] responsive owner dashboard matrix passed: 360, 390, 768, 1024, 1440px')
  console.log('[admin-browser] no uncaught exceptions, console/network errors or third-party requests')
  console.log('PASS: autonomous owner dashboard browser QA completed')
} finally {
  await browser.close()
  await new Promise(resolveClose => server.close(resolveClose))
}
