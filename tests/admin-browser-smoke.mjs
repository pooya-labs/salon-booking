import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdir, readFile, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { chromium } from 'playwright'

const distRoot = resolve('dist')
const visualArtifacts = resolve('test-artifacts')
await mkdir(visualArtifacts, { recursive: true })
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

const assertNoAccessibilityViolations = async (page, label) => {
  await page.addScriptTag({ path: resolve('node_modules/axe-core/axe.min.js') })
  const violations = await page.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
      },
    })
    return result.violations.map(violation => ({
      id: violation.id,
      impact: violation.impact,
      description: violation.description,
      nodes: violation.nodes.map(node => ({
        target: node.target,
        summary: node.failureSummary,
      })),
    }))
  })
  assert.deepEqual(violations, [], label + ' WCAG 2.2 AA accessibility violations: ' + JSON.stringify(violations))
  console.log('[a11y] ' + label + ' passed WCAG 2.2 AA automated axe scan')
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
const statusUpdates = []
const timeBlockRequests = []
let mockTimeBlocks = [{ id: 'qa-time-block', time: '12:00', endTime: '12:15', durationMinutes: 15 }]
let forceLoginView = false
const qaBookings = [
  {
    id: 'qa-pending',
    reference: 'SB-ABCDEFG',
    name: 'QA Client Pending',
    phone: '+491234567890',
    startsAt: '2026-11-03T06:00:00.000Z',
    endsAt: '2026-11-03T06:45:00.000Z',
    status: 'pending',
    note: '',
    service: 'QA haircut',
    durationMinutes: 45,
  },
  {
    id: 'qa-confirmed-noshow',
    reference: 'SB-HJKLMNP',
    name: 'QA Client No-show',
    phone: '+491234567891',
    startsAt: '2026-11-03T07:00:00.000Z',
    endsAt: '2026-11-03T07:45:00.000Z',
    status: 'confirmed',
    note: '',
    service: 'QA haircut',
    durationMinutes: 45,
  },
  {
    id: 'qa-confirmed-complete',
    reference: 'SB-QRSTUV2',
    name: 'QA Client Complete',
    phone: '+491234567892',
    startsAt: '2026-11-03T08:00:00.000Z',
    endsAt: '2026-11-03T08:45:00.000Z',
    status: 'confirmed',
    note: '',
    service: 'QA haircut',
    durationMinutes: 45,
  },
]
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
      if (forceLoginView) {
        await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'unauthorized' }) })
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
          ok: true, user: { id: 'qa-owner', username: 'QA Owner' },
        }) })
      }
      return
    }
    if (path === '/api/admin/setup-status') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        ok: true, initialized: true, bootstrapAvailable: false,
      }) })
      return
    }
    if (path === '/api/admin/bookings' && route.request().method() === 'GET') {
      const from = url.searchParams.get('from') ?? '2026-11-03'
      const to = url.searchParams.get('to') ?? '2026-11-09'
      const status = url.searchParams.get('status') ?? 'all'
      apiCalls.push({ from, to, status })
      const bookings = qaBookings.filter(booking => status === 'all' || booking.status === status)
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        ok: true, timezone: 'Asia/Tehran', from, to, bookings,
      }) })
      return
    }
    if (path.startsWith('/api/admin/bookings/') && path.endsWith('/status') && route.request().method() === 'PATCH') {
      const bookingId = path.split('/').slice(-2)[0]
      const body = route.request().postDataJSON()
      const booking = qaBookings.find(item => item.id === bookingId)
      if (!booking || !['confirmed', 'cancelled', 'completed', 'no_show'].includes(body.status)) {
        await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ ok: false, message: 'invalid status update' }) })
        return
      }
      booking.status = body.status
      statusUpdates.push({ bookingId, status: body.status })
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, status: body.status }) })
      return
    }
    if (path === '/api/admin/day-schedule' && request.method() === 'GET') {
      const requestedDate = new URL(request.url()).searchParams.get('date')
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        ok: true, date: requestedDate, timezone: 'Asia/Tehran', slotIntervalMinutes: 15,
        workingIntervals: [{ startsAt: '09:00', endsAt: '17:00' }],
        bookings: [{
          id: 'qa-day-booking', date: requestedDate, time: '10:00', endTime: '10:45',
          serviceName: 'کوتاهی مو', durationMinutes: 45, status: 'confirmed',
        }],
        blocks: mockTimeBlocks,
      }) })
      return
    }
    if (path === '/api/admin/time-blocks' && request.method() === 'POST') {
      const body = request.postDataJSON()
      timeBlockRequests.push(body)
      const [hour, minute] = body.time.split(':').map(Number)
      const end = hour * 60 + minute + body.durationMinutes
      const endTime = String(Math.floor(end / 60)).padStart(2, '0') + ':' + String(end % 60).padStart(2, '0')
      mockTimeBlocks.push({ id: 'qa-created-block', time: body.time, endTime, durationMinutes: body.durationMinutes })
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
      return
    }
    const timeBlockMatch = /^\/api\/admin\/time-blocks\/([^/]+)$/.exec(path)
    if (timeBlockMatch && request.method() === 'DELETE') {
      mockTimeBlocks = mockTimeBlocks.filter(block => block.id !== timeBlockMatch[1])
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
      return
    }
    if (path === '/api/admin/services') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        ok: true, services: [],
      }) })
      return
    }
    if (path === '/api/admin/notifications') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        ok: true, emailEnabled: false, firebaseProjectId: '', pushDeviceCount: 0, pushReady: false,
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
        weeklyHours: Array.from({ length: 7 }, (_, weekday) => ({
          weekday,
          name: ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'][weekday],
          intervals: [{ startsAt: '09:00', endsAt: '17:00' }],
          isClosed: false,
          configured: true,
        })),
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
  await page.screenshot({ path: resolve(visualArtifacts, 'admin-desktop-dashboard.png'), fullPage: true })

  await assertNoAccessibilityViolations(page, 'owner dashboard')

  await page.getByRole('button', { name: 'خدمت جدید' }).click()
  await page.locator('.admin-manage-form').waitFor({ state: 'visible' })
  await page.screenshot({ path: resolve(visualArtifacts, 'admin-service-editor-desktop.png'), fullPage: true })
  await assertNoAccessibilityViolations(page, 'owner service editor')

  await page.getByRole('button', { name: 'برنامه کاری' }).click()
  await page.locator('.admin-weekly-list').waitFor({ state: 'visible' })
  await page.screenshot({ path: resolve(visualArtifacts, 'admin-schedule-desktop.png'), fullPage: true })
  await assertNoAccessibilityViolations(page, 'owner schedule management tab')
  await page.getByRole('button', { name: 'تقویم روز' }).click()
  await page.locator('.admin-calendar').waitFor({ state: 'visible' })
  await assertNoAccessibilityViolations(page, 'owner daily visual booking calendar')
  await page.screenshot({ path: resolve(visualArtifacts, 'admin-daily-calendar-desktop.png'), fullPage: true })
  await page.getByRole('button', { name: 'روز بعد' }).click()
  await page.waitForResponse(response => new URL(response.url()).pathname === '/api/admin/day-schedule' && response.status() === 200)
  await page.locator('.admin-day-slot.is-free').filter({ hasText: '11:00' }).click()
  await page.locator('.admin-block-confirm').waitFor({ state: 'visible' })
  await assertNoAccessibilityViolations(page, 'manager one-touch time block confirmation')
  await page.getByRole('button', { name: 'تأیید و مسدود کردن زمان' }).click()
  await page.waitForResponse(response => new URL(response.url()).pathname === '/api/admin/time-blocks' && response.request().method() === 'POST' && response.status() === 201)
  assert.deepEqual(timeBlockRequests[0], { date: timeBlockRequests[0].date, time: '11:00', durationMinutes: 60 })
  assert.deepEqual(Object.keys(timeBlockRequests[0]).sort(), ['date', 'durationMinutes', 'time'])
  await page.locator('.admin-calendar-list-panel').filter({ hasText: 'زمان‌های مسدودشده' }).getByRole('button', { name: 'رفع مسدودی 11:00' }).click()
  await page.getByRole('button', { name: 'تأیید', exact: true }).click()
  await page.waitForResponse(response => new URL(response.url()).pathname === '/api/admin/time-blocks/qa-created-block' && response.request().method() === 'DELETE' && response.status() === 200)
  await page.screenshot({ path: resolve(visualArtifacts, 'admin-daily-calendar-after-unblock.png'), fullPage: true })
  await page.getByRole('button', { name: 'اعلان‌ها' }).click()
  await page.locator('.admin-notification-layout').waitFor({ state: 'visible' })
  await assertNoAccessibilityViolations(page, 'owner notification settings tab')
  await page.getByRole('button', { name: 'خدمات' }).click()

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

  await page.locator('.admin-filter select').selectOption('all')
  await page.waitForFunction(() => Array.from(document.querySelectorAll('.admin-filter select')).some(select => select.value === 'all'))

  const pendingCard = page.locator('.admin-booking-card').filter({ hasText: 'QA Client Pending' })
  await pendingCard.getByRole('button', { name: 'لغو', exact: true }).click()
  let confirmation = pendingCard.getByRole('group', { name: 'تأیید تغییر وضعیت' })
  await confirmation.waitFor({ state: 'visible' })
  await assertNoAccessibilityViolations(page, 'owner cancellation confirmation')
  assert.equal(statusUpdates.length, 0, 'requesting cancellation must not mutate booking status')
  await confirmation.getByRole('button', { name: 'انصراف' }).click()
  assert.equal(statusUpdates.length, 0, 'cancelling the confirmation must not mutate booking status')

  await pendingCard.getByRole('button', { name: 'لغو', exact: true }).click()
  confirmation = pendingCard.getByRole('group', { name: 'تأیید تغییر وضعیت' })
  await confirmation.getByRole('button', { name: 'تأیید لغو نوبت' }).click()
  await page.waitForFunction(() => document.querySelector('.admin-booking-card')?.innerText.includes('لغو شده'))
  assert.deepEqual(statusUpdates[0], { bookingId: 'qa-pending', status: 'cancelled' })

  const noShowCard = page.locator('.admin-booking-card').filter({ hasText: 'QA Client No-show' })
  await noShowCard.getByRole('button', { name: 'عدم مراجعه', exact: true }).click()
  confirmation = noShowCard.getByRole('group', { name: 'تأیید تغییر وضعیت' })
  await confirmation.getByRole('button', { name: 'تأیید عدم مراجعه' }).click()
  await page.waitForFunction(() => document.querySelectorAll('.admin-booking-card').length > 0)
  assert.deepEqual(statusUpdates[1], { bookingId: 'qa-confirmed-noshow', status: 'no_show' })

  const completeCard = page.locator('.admin-booking-card').filter({ hasText: 'QA Client Complete' })
  await completeCard.getByRole('button', { name: 'انجام شد', exact: true }).click()
  confirmation = completeCard.getByRole('group', { name: 'تأیید تغییر وضعیت' })
  await confirmation.getByRole('button', { name: 'تأیید انجام نوبت' }).click()
  assert.deepEqual(statusUpdates[2], { bookingId: 'qa-confirmed-complete', status: 'completed' })
  console.log('[admin-browser] cancellation, completion and no-show actions require explicit confirmation')
  console.log('[admin-browser] cancelling a confirmation does not send a status mutation')

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
  forceLoginView = true
  await page.goto(origin + '/admin', { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'خوش برگشتید.' }).waitFor({ state: 'visible' })
  await assertNoAccessibilityViolations(page, 'owner login page')
  forceLoginView = false
  await page.goto(origin + '/admin', { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'سلام، QA Owner.' }).waitFor({ state: 'visible' })
  await page.locator('.admin-manage-tabs').waitFor({ state: 'visible' })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  const mobileAdminMetrics = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    tabs: document.querySelector('.admin-manage-tabs')?.getBoundingClientRect().width ?? 0,
    management: document.querySelector('.admin-management')?.getBoundingClientRect().width ?? 0,
  }))
  assert.ok(mobileAdminMetrics.document <= mobileAdminMetrics.viewport + 1, 'mobile owner dashboard must not overflow horizontally: ' + JSON.stringify(mobileAdminMetrics))
  assert.ok(mobileAdminMetrics.body <= mobileAdminMetrics.viewport + 1, 'mobile owner dashboard body must not overflow: ' + JSON.stringify(mobileAdminMetrics))
  const mobileHeaderMetrics = await page.evaluate(async () => {
    await new Promise(resolveFrame => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)))
    const topbar = document.querySelector('.admin-topbar')
    const brand = topbar?.querySelector('.admin-brand')
    const actions = topbar?.querySelector('.admin-topbar-actions')
    const subtitle = topbar?.querySelector('.admin-brand-copy small')
    if (!topbar || !brand || !actions || !subtitle) return null
    const brandRect = brand.getBoundingClientRect()
    const actionsRect = actions.getBoundingClientRect()
    const subtitleRect = subtitle.getBoundingClientRect()
    return {
      brandBottom: Math.round(brandRect.bottom),
      actionsTop: Math.round(actionsRect.top),
      headerBottom: Math.round(topbar.getBoundingClientRect().bottom),
      subtitleBottom: Math.round(subtitleRect.bottom),
      subtitleFits: subtitle.scrollWidth <= subtitle.clientWidth + 1,
      noOverlap: brandRect.bottom <= actionsRect.top + 1,
    }
  })
  assert.ok(mobileHeaderMetrics, 'mobile owner header should render')
  assert.ok(mobileHeaderMetrics.noOverlap, 'mobile owner brand and account actions must occupy separate rows: ' + JSON.stringify(mobileHeaderMetrics))
  assert.ok(mobileHeaderMetrics.subtitleFits, 'mobile owner subtitle must wrap inside its own width')
  assert.ok(mobileHeaderMetrics.subtitleBottom <= mobileHeaderMetrics.headerBottom + 1, 'mobile owner subtitle must remain inside header')
  await page.screenshot({ path: resolve(visualArtifacts, 'admin-mobile-dashboard.png'), fullPage: true })
  await page.getByRole('button', { name: 'تقویم روز' }).click()
  await page.locator('.admin-calendar').waitFor({ state: 'visible' })
  await page.screenshot({ path: resolve(visualArtifacts, 'admin-mobile-daily-calendar.png'), fullPage: true })
  await page.getByRole('button', { name: 'اعلان‌ها' }).click()
  await page.locator('.admin-notification-layout').waitFor({ state: 'visible' })
  await page.screenshot({ path: resolve(visualArtifacts, 'admin-mobile-notifications.png'), fullPage: true })

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
