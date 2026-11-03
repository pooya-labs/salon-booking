import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, readdir, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { chromium } from 'playwright'

const distRoot = resolve('dist')
const basePath = '/salon-booking/'
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
    if (url.pathname === '/favicon.ico') {
      response.writeHead(204).end()
      return
    }
    if (url.pathname !== basePath && !url.pathname.startsWith(basePath)) {
      response.writeHead(404).end('Not found')
      return
    }

    const relativePath = decodeURIComponent(url.pathname.slice(basePath.length))
    let filePath = resolve(distRoot, relativePath || 'index.html')
    if (filePath !== distRoot && !filePath.startsWith(distRoot + sep)) {
      response.writeHead(403).end('Forbidden')
      return
    }

    try {
      const fileInfo = await stat(filePath)
      if (!fileInfo.isFile()) filePath = resolve(distRoot, 'index.html')
    } catch {
      if (extname(relativePath)) {
        response.writeHead(404).end('Not found')
        return
      }
      filePath = resolve(distRoot, 'index.html')
    }

    const body = await readFile(filePath)
    response.writeHead(200, {
      'content-type': mimeTypes[extname(filePath)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    })
    response.end(body)
  } catch (error) {
    response.writeHead(500).end(error instanceof Error ? error.message : 'Server error')
  }
})

await new Promise((resolveListen, rejectListen) => {
  server.once('error', rejectListen)
  server.listen(0, '127.0.0.1', resolveListen)
})
const address = server.address()
if (!address || typeof address === 'string') throw new Error('Could not resolve local browser-test server address')
const origin = 'http://127.0.0.1:' + address.port
const homeUrl = origin + basePath

const diagnostics = { pageErrors: [], consoleErrors: [], failedRequests: [], badResponses: [], apiRequests: [], externalRequests: [] }
const watchPage = (page) => {
  page.on('pageerror', error => diagnostics.pageErrors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') diagnostics.consoleErrors.push(message.text())
  })
  page.on('request', request => {
    const requestUrl = new URL(request.url())
    if (requestUrl.origin !== origin) diagnostics.externalRequests.push(request.url())
    if (requestUrl.pathname.includes('/api/')) diagnostics.apiRequests.push(request.url())
  })
  page.on('requestfailed', request => diagnostics.failedRequests.push(request.url() + ' :: ' + (request.failure()?.errorText ?? 'unknown')))
  page.on('response', response => {
    if (response.status() >= 400 && new URL(response.url()).origin === origin) {
      diagnostics.badResponses.push(response.status() + ' ' + response.url())
    }
  })
}

const browser = await chromium.launch({ headless: true })
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: 'fa-IR',
    timezoneId: 'Asia/Tehran',
  })
  const page = await context.newPage()
  watchPage(page)
  await page.goto(homeUrl, { waitUntil: 'networkidle' })
  await page.locator('.site-header').waitFor({ state: 'visible' })

  assert.equal(await page.locator('html').getAttribute('lang'), 'fa', 'document language must be Persian')
  assert.equal(await page.locator('html').getAttribute('dir'), 'rtl', 'document direction must be RTL')
  assert.equal(await page.getByRole('heading', { level: 1 }).count(), 1, 'home page must have one primary heading')

  for (const width of [320, 360, 390, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 960 })
    await page.evaluate(() => window.scrollTo(0, 0))
    const metrics = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    }))
    assert.ok(metrics.document <= metrics.viewport + 1, 'horizontal page overflow at ' + width + 'px: ' + JSON.stringify(metrics))
    assert.ok(metrics.body <= metrics.viewport + 1, 'body overflow at ' + width + 'px: ' + JSON.stringify(metrics))
  }
  console.log('[browser] responsive viewport matrix passed: 320, 360, 390, 430, 768, 1024, 1280, 1440px')

  await page.setViewportSize({ width: 390, height: 844 })
  const menuToggle = page.getByRole('button', { name: 'باز کردن منو' })
  await menuToggle.click()
  assert.ok(await page.locator('.main-nav').evaluate(element => element.classList.contains('is-open')), 'mobile navigation should open')
  assert.ok(await page.getByRole('link', { name: 'خدمات', exact: true }).isVisible(), 'mobile navigation link should be visible')
  await page.getByRole('link', { name: 'خدمات', exact: true }).click()
  assert.ok(!(await page.locator('.main-nav').evaluate(element => element.classList.contains('is-open'))), 'mobile navigation should close after selection')
  console.log('[browser] mobile navigation interaction passed')

  const trigger = page.getByRole('button', { name: /انتخاب زمان و رزرو/ })
  await trigger.click()
  let dialog = page.getByRole('dialog')
  await dialog.waitFor({ state: 'visible' })
  assert.equal(await dialog.getAttribute('aria-modal'), 'true')
  assert.ok(await dialog.getAttribute('aria-labelledby'), 'dialog must have an accessible name')
  assert.ok(await dialog.evaluate(element => element.contains(document.activeElement)), 'initial focus must move into the dialog')
  assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden', 'background scrolling must be locked')

  await page.keyboard.press('Shift+Tab')
  assert.ok(await dialog.evaluate(element => element.contains(document.activeElement)), 'Shift+Tab must remain inside the dialog')
  await page.keyboard.press('Tab')
  assert.ok(await dialog.evaluate(element => element.contains(document.activeElement)), 'Tab must remain inside the dialog')
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'detached' })
  assert.ok(await trigger.evaluate(element => document.activeElement === element), 'focus must return to the control that opened the dialog')
  assert.equal(await page.evaluate(() => document.body.style.overflow), '', 'background scroll lock must be released')
  console.log('[browser] booking dialog naming, focus entry/trap/restore, Escape and scroll lock passed')

  await page.setViewportSize({ width: 1024, height: 900 })
  const manageTrigger = page.locator('.booking-manage-link')
  await manageTrigger.click()
  const manageDialog = page.getByRole('dialog')
  await manageDialog.waitFor({ state: 'visible' })
  assert.ok(await manageDialog.getAttribute('aria-labelledby'), 'customer-management dialog must have an accessible name')
  assert.ok(await manageDialog.evaluate(element => element.contains(document.activeElement)), 'customer-management dialog must receive initial focus')
  await page.keyboard.press('Shift+Tab')
  assert.ok(await manageDialog.evaluate(element => element.contains(document.activeElement)), 'customer-management Shift+Tab must remain inside the dialog')
  await page.keyboard.press('Tab')
  assert.ok(await manageDialog.evaluate(element => element.contains(document.activeElement)), 'customer-management Tab must remain inside the dialog')
  await page.keyboard.press('Escape')
  await manageDialog.waitFor({ state: 'detached' })
  assert.ok(await manageTrigger.evaluate(element => document.activeElement === element), 'customer-management focus must return to its trigger')
  console.log('[browser] customer-management dialog keyboard and focus behavior passed')

  await page.setViewportSize({ width: 390, height: 844 })
  await trigger.click()
  dialog = page.getByRole('dialog')
  await dialog.waitFor({ state: 'visible' })
  await dialog.locator('.booking-service-option').first().click()
  await dialog.getByRole('button', { name: /ادامه/ }).click()
  await dialog.locator('.booking-date-option').first().click()
  assert.equal(await dialog.locator('.booking-date-option').count(), 14, 'booking calendar should show fourteen days')
  assert.match(await dialog.locator('.booking-date-option strong').first().innerText(), /[۰-۹]/, 'calendar day should use Persian numerals')
  await dialog.locator('.booking-time-option:not([disabled])').first().click()
  await dialog.getByRole('button', { name: /ادامه/ }).click()
  await dialog.locator('input[autocomplete="name"]').fill('کاربر آزمایشی')
  await dialog.locator('input[inputmode="tel"]').fill('۰۹۱۲ ۱۲۳-۴۵۶۷')
  await dialog.getByRole('button', { name: /ادامه/ }).click()
  const phoneReview = await dialog.locator('.booking-review-row').filter({ hasText: 'شماره تماس' }).innerText()
  assert.match(phoneReview, /09121234567/, 'phone must be normalized consistently before review')
  assert.ok(await dialog.getByRole('heading', { name: 'همه‌چیز آماده‌ست؟' }).isVisible())
  await dialog.getByRole('button', { name: /پایان پیش‌نمایش/ }).click()
  await dialog.waitFor({ state: 'detached' })
  console.log('[browser] full demo booking journey and phone normalization passed')

  for (const timezoneId of ['Asia/Tehran', 'Europe/Berlin', 'America/Los_Angeles']) {
    const zoneContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: 'fa-IR',
      timezoneId,
    })
    const zonePage = await zoneContext.newPage()
    watchPage(zonePage)
    await zonePage.goto(homeUrl, { waitUntil: 'networkidle' })
    await zonePage.locator('.header-book').click()
    const zoneDialog = zonePage.getByRole('dialog')
    await zoneDialog.waitFor({ state: 'visible' })
    await zoneDialog.locator('.booking-service-option').first().click()
    await zoneDialog.getByRole('button', { name: /ادامه/ }).click()
    const expectedDateKey = await zonePage.evaluate(() => {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(new Date())
      const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
      return values.year + '-' + values.month + '-' + values.day
    })
    const actualDateKey = await zoneDialog.locator('.booking-date-option').first().getAttribute('data-date-key')
    assert.equal(actualDateKey, expectedDateKey, 'first booking date must follow visitor timezone ' + timezoneId)
    const jalaliLabels = await zoneDialog.locator('.booking-date-option strong').allInnerTexts()
    assert.equal(jalaliLabels.length, 14)
    assert.ok(jalaliLabels.every(label => /[۰-۹]/.test(label)), 'all calendar day labels should use Persian digits')
    await zoneContext.close()
  }
  console.log('[browser] Jalali/Persian date labels and local-day boundaries passed in Tehran, Berlin and Los Angeles timezones')

  await page.goto(homeUrl + '?admin=1', { waitUntil: 'networkidle' })
  assert.ok(await page.getByRole('heading', { name: 'پنل مدیریت' }).isVisible(), 'Pages admin route should display the demo notice')
  assert.equal(await page.locator('input[type="password"]').count(), 0, 'static demo must not expose an active admin login form')
  assert.ok((await page.locator('.admin-auth-card').innerText()).includes('پیش‌نمایش GitHub Pages'))
  console.log('[browser] admin demo safety gate passed')

  const assetEntries = await readdir(resolve(distRoot, 'assets'), { withFileTypes: true })
  let jsBytes = 0
  let cssBytes = 0
  for (const entry of assetEntries) {
    if (!entry.isFile()) continue
    const fileBytes = (await stat(resolve(distRoot, 'assets', entry.name))).size
    if (entry.name.endsWith('.js')) jsBytes += fileBytes
    if (entry.name.endsWith('.css')) cssBytes += fileBytes
  }
  assert.ok(jsBytes <= 1024 * 1024, 'JavaScript assets exceed the 1 MiB budget: ' + jsBytes + ' bytes')
  assert.ok(cssBytes <= 256 * 1024, 'CSS assets exceed the 256 KiB budget: ' + cssBytes + ' bytes')

  const timing = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0]
    return navigation ? navigation.domContentLoadedEventEnd : 0
  })
  assert.ok(timing > 0 && timing < 8000, 'static preview DOMContentLoaded should stay under 8 seconds: ' + timing)
  console.log('[browser] asset budget passed: JavaScript ' + jsBytes + ' bytes; CSS ' + cssBytes + ' bytes; DOMContentLoaded ' + Math.round(timing) + 'ms')

  assert.deepEqual(diagnostics.pageErrors, [], 'uncaught browser exceptions')
  assert.deepEqual(diagnostics.consoleErrors, [], 'browser console errors')
  assert.deepEqual(diagnostics.failedRequests, [], 'failed browser requests')
  assert.deepEqual(diagnostics.badResponses, [], 'HTTP error responses')
  assert.deepEqual(diagnostics.apiRequests, [], 'Pages preview must not call production APIs')
  assert.deepEqual(diagnostics.externalRequests, [], 'preview must not request third-party resources')
  console.log('[browser] console/network clean; Pages demo made no API or third-party requests')
  console.log('PASS: autonomous browser QA completed')
} finally {
  await browser.close()
  await new Promise(resolveClose => server.close(resolveClose))
}
