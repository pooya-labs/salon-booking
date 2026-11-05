import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdir, readFile, readdir, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { chromium } from 'playwright'

const distRoot = resolve('dist')
const visualArtifacts = resolve('test-artifacts')
await mkdir(visualArtifacts, { recursive: true })
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

  const contactStrip = page.locator('.contact-strip')
  await contactStrip.waitFor({ state: 'visible' })
  assert.ok((await contactStrip.innerText()).includes('میدان نامجو، خیابان پازوکی، کوچه دهقانی، پلاک ۱۱۸'),
    'customer contact strip should show the full studio address')
  const instagramLink = contactStrip.locator('a[href="https://www.instagram.com/shayan_tatsu/"]')
  assert.equal(await instagramLink.count(), 1, 'Instagram contact must point to the supplied handle')
  assert.equal(await instagramLink.getAttribute('target'), '_blank', 'Instagram should open separately')
  const phoneLink = contactStrip.locator('a[href="tel:+989106841550"]')
  assert.equal(await phoneLink.count(), 1, 'customer contact phone should use a native tel link')
  assert.ok((await phoneLink.innerText()).includes('۰۹۱۰ ۶۸۴ ۱۵۵۰'), 'phone number should be readable in the contact strip')
  console.log('[contact] studio address, Instagram deep link and one-tap phone link passed')

  await page.emulateMedia({ reducedMotion: 'reduce' })
  const reducedMotion = await page.evaluate(() => ({
    scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
    buttonTransition: getComputedStyle(document.querySelector('.header-book')).transitionDuration,
  }))
  assert.equal(reducedMotion.scrollBehavior, 'auto', 'reduced-motion preference should disable smooth scrolling')
  assert.ok(reducedMotion.buttonTransition.split(',').every(value => Number.parseFloat(value) === 0),
    'reduced-motion preference should disable animated button transitions')
  console.log('[browser] reduced-motion preference disables smooth scroll and button transitions')

  await page.keyboard.press('Tab')
  const focusIndicator = await page.evaluate(() => {
    const active = document.activeElement
    return active ? {
      tag: active.tagName,
      outlineStyle: getComputedStyle(active).outlineStyle,
      outlineWidth: getComputedStyle(active).outlineWidth,
      shadow: getComputedStyle(active).boxShadow,
    } : null
  })
  assert.ok(focusIndicator, 'keyboard Tab should place focus on a page control')
  assert.notEqual(focusIndicator.outlineStyle, 'none', 'keyboard-focused controls should expose a visible outline')
  assert.ok(Number.parseFloat(focusIndicator.outlineWidth) >= 3, 'keyboard focus outline should be at least 3px')
  assert.notEqual(focusIndicator.shadow, 'none', 'a contrasting outer focus ring should be present')
  console.log('[browser] keyboard focus indicator is visible with a contrasting dual ring')

  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await assertNoAccessibilityViolations(page, 'public homepage')

  assert.equal(await page.locator('html').getAttribute('lang'), 'fa', 'document language must be Persian')
  assert.equal(await page.locator('html').getAttribute('dir'), 'rtl', 'document direction must be RTL')
  assert.equal(await page.getByRole('heading', { level: 1 }).count(), 1, 'home page must have one primary heading')
  assert.doesNotMatch(await page.locator('.site-shell').innerText(), /FORM STUDIO|Form Studio|\bF\./, 'legacy Form branding must not remain visible')
  assert.equal((await page.locator('.banner-decoration').innerText()).trim(), 'S', 'booking banner should use the Shayan monogram')

  // Desktop-size capture used for Windows/large-screen visual review.
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.screenshot({ path: resolve(visualArtifacts, 'desktop-homepage.png'), fullPage: true })
  for (const width of [1280, 1366, 1440, 1536, 1920]) {
    await page.setViewportSize({ width, height: width <= 1366 ? 768 : 960 })
    const desktopMetrics = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
      footerWidth: document.querySelector('.site-footer')?.getBoundingClientRect().width ?? 0,
      bookingBarDisplay: getComputedStyle(document.querySelector('.mobile-book-bar')).display,
    }))
    assert.ok(desktopMetrics.document <= desktopMetrics.viewport + 1, 'desktop horizontal overflow: ' + JSON.stringify(desktopMetrics))
    assert.ok(desktopMetrics.body <= desktopMetrics.viewport + 1, 'desktop body overflow: ' + JSON.stringify(desktopMetrics))
    assert.equal(desktopMetrics.bookingBarDisplay, 'none', 'mobile booking bar must stay hidden on desktop')
  }
  console.log('[visual] Windows desktop viewport matrix passed: 1280, 1366, 1440, 1536, 1920px')

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
  const footerLayout = await page.evaluate(async () => {
    document.documentElement.style.scrollBehavior = 'auto'
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' })
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const footer = document.querySelector('.site-footer')
    const brandLogo = footer?.querySelector('.footer-brand > img')
    const creatorMark = footer?.querySelector('.footer-pooya-mark')
    const credit = footer?.querySelector('.footer-credit')
    const bookingBar = document.querySelector('.mobile-book-bar')
    if (!footer || !brandLogo || !creatorMark || !credit || !bookingBar) return null
    const footerRect = footer.getBoundingClientRect()
    const barRect = bookingBar.getBoundingClientRect()
    const brandRect = brandLogo.getBoundingClientRect()
    const creatorRect = creatorMark.getBoundingClientRect()
    return {
      brandLogoWidth: brandRect.width,
      brandLogoHeight: brandRect.height,
      creatorLogoWidth: creatorRect.width,
      creatorLogoHeight: creatorRect.height,
      creditFits: credit.scrollWidth <= credit.clientWidth + 1,
      footerAboveBookingBar: footerRect.bottom <= barRect.top - 6,
      footerVisible: footerRect.top < window.innerHeight,
      barVisible: barRect.top < window.innerHeight && barRect.bottom <= window.innerHeight + 1,
      scrollY: Math.round(window.scrollY),
      documentHeight: document.documentElement.scrollHeight,
      footerTop: Math.round(footerRect.top),
      footerBottom: Math.round(footerRect.bottom),
      barTop: Math.round(barRect.top),
      barBottom: Math.round(barRect.bottom),
      siteShellPaddingBottom: getComputedStyle(document.querySelector('.site-shell')).paddingBottom,
    }
  })
  assert.ok(footerLayout, 'mobile footer and booking bar should render')
  assert.ok(footerLayout.brandLogoWidth <= 50 && footerLayout.brandLogoHeight <= 50, 'Shayan footer emblem should remain compact')
  assert.ok(footerLayout.creatorLogoWidth <= 20 && footerLayout.creatorLogoHeight <= 20, 'Pooya Labs mark should remain compact')
  assert.ok(footerLayout.creditFits, 'Pooya Labs credit must fit without text overflow')
  console.log('[visual] mobile footer metrics: ' + JSON.stringify(footerLayout))
  await page.screenshot({ path: resolve(visualArtifacts, 'mobile-footer-viewport.png') })
  await page.screenshot({ path: resolve(visualArtifacts, 'mobile-full-page.png'), fullPage: true })
  assert.ok(footerLayout.footerVisible && footerLayout.barVisible, 'footer and sticky booking bar should both be visible: ' + JSON.stringify(footerLayout))
  assert.ok(footerLayout.footerAboveBookingBar, 'sticky booking bar must not cover the footer at the bottom of the page')
  console.log('[browser] mobile footer logo sizing, creator-credit wrapping and sticky booking-bar clearance passed')

  // Touch-enabled Android-like browser context (Pixel-sized viewport and DPR).
  const androidContext = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    locale: 'fa-IR',
    timezoneId: 'Asia/Tehran',
    userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  })
  const androidPage = await androidContext.newPage()
  watchPage(androidPage)
  await androidPage.goto(homeUrl, { waitUntil: 'networkidle' })
  await androidPage.locator('.site-header').waitFor({ state: 'visible' })
  const androidTopMetrics = await androidPage.evaluate(() => ({
    width: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    menuButtonVisible: getComputedStyle(document.querySelector('.menu-toggle')).display !== 'none',
    stickyBarVisible: getComputedStyle(document.querySelector('.mobile-book-bar')).display !== 'none',
  }))
  assert.ok(androidTopMetrics.document <= androidTopMetrics.width + 1, 'Android page must not overflow horizontally: ' + JSON.stringify(androidTopMetrics))
  assert.ok(androidTopMetrics.body <= androidTopMetrics.width + 1, 'Android body must not overflow horizontally: ' + JSON.stringify(androidTopMetrics))
  assert.ok(androidTopMetrics.menuButtonVisible && androidTopMetrics.stickyBarVisible, 'Android mobile navigation and booking bar should be available')
  const androidHeaderOwnerLink = androidPage.locator('.header-actions > a.owner-link:not(.booking-manage-link)')
  assert.ok(!(await androidHeaderOwnerLink.isVisible()), 'Android homepage header must not show a separate owner-panel entry')

  await androidPage.locator('.menu-toggle').tap()
  assert.ok(await androidPage.locator('.main-nav').evaluate(element => element.classList.contains('is-open')), 'Android touch menu should open')
  const androidOwnerLink = androidPage.locator('.main-nav .nav-owner-link')
  assert.ok(await androidOwnerLink.isVisible(), 'Android menu must expose the owner panel entry')
  assert.equal(await androidOwnerLink.getAttribute('href'), '?admin=1', 'Android owner entry must point to the Pages admin route')
  await androidPage.getByRole('link', { name: 'خدمات', exact: true }).tap()
  assert.ok(!(await androidPage.locator('.main-nav').evaluate(element => element.classList.contains('is-open'))), 'Android menu should close after navigation')

  await androidPage.locator('.header-book').tap()
  const androidDialog = androidPage.getByRole('dialog')
  await androidDialog.waitFor({ state: 'visible' })
  const modalStack = await androidDialog.evaluate(element => ({
    dialog: Number.parseInt(getComputedStyle(element.closest('.booking-flow-backdrop')).zIndex || '0', 10),
    bookingBar: Number.parseInt(getComputedStyle(document.querySelector('.mobile-book-bar')).zIndex || '0', 10),
  }))
  assert.ok(modalStack.dialog > modalStack.bookingBar, 'Android booking dialog must stack above the persistent booking bar: ' + JSON.stringify(modalStack))
  await androidDialog.locator('.booking-service-option').first().tap()
  await androidDialog.getByRole('button', { name: /ادامه/ }).tap()
  await androidDialog.locator('.booking-date-option').first().tap()
  await androidDialog.locator('.booking-time-option:not([disabled])').first().tap()
  await androidDialog.getByRole('button', { name: /ادامه/ }).tap()
  const androidFormMetrics = await androidDialog.evaluate(element => {
    const body = element.querySelector('.booking-flow-body')
    const footer = element.querySelector('.booking-flow-footer')
    const fields = [...element.querySelectorAll('.booking-field input')]
    const bodyRect = body.getBoundingClientRect()
    return {
      columns: getComputedStyle(element.querySelector('.booking-form-two-cols')).gridTemplateColumns.trim().split(' ').length,
      fieldsFit: fields.every(input => {
        const rect = input.getBoundingClientRect()
        return rect.left >= bodyRect.left - 1 && rect.right <= bodyRect.right + 1
      }),
      footerVisible: footer.getBoundingClientRect().bottom <= element.getBoundingClientRect().bottom + 1,
      bodyScrollable: body.scrollHeight >= body.clientHeight,
    }
  })
  assert.equal(androidFormMetrics.columns, 1, 'Android customer name fields should stack')
  assert.ok(androidFormMetrics.fieldsFit, 'Android customer form fields must fit inside the dialog')
  assert.ok(androidFormMetrics.footerVisible, 'Android booking actions must remain visible')
  await androidDialog.screenshot({ path: resolve(visualArtifacts, 'android-booking-details.png') })
  await androidPage.keyboard.press('Escape')
  await androidDialog.waitFor({ state: 'detached' })

  await androidPage.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto'
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' })
  })
  await androidPage.waitForTimeout(120)
  const androidFooterMetrics = await androidPage.evaluate(() => {
    const footer = document.querySelector('.site-footer')
    const logo = footer.querySelector('.footer-brand > img').getBoundingClientRect()
    const creatorMark = footer.querySelector('.footer-pooya-mark').getBoundingClientRect()
    const credit = footer.querySelector('.footer-credit')
    const footerRect = footer.getBoundingClientRect()
    const barRect = document.querySelector('.mobile-book-bar').getBoundingClientRect()
    return {
      width: window.innerWidth,
      document: document.documentElement.scrollWidth,
      footerTop: Math.round(footerRect.top),
      footerBottom: Math.round(footerRect.bottom),
      barTop: Math.round(barRect.top),
      barBottom: Math.round(barRect.bottom),
      logo: { width: logo.width, height: logo.height },
      creator: { width: creatorMark.width, height: creatorMark.height },
      creditFits: credit.scrollWidth <= credit.clientWidth + 1,
      footerAboveBar: footerRect.bottom <= barRect.top - 6,
    }
  })
  console.log('[visual] Android footer metrics: ' + JSON.stringify(androidFooterMetrics))
  await androidPage.screenshot({ path: resolve(visualArtifacts, 'android-footer.png') })
  await androidPage.screenshot({ path: resolve(visualArtifacts, 'android-full-page.png'), fullPage: true })
  assert.ok(androidFooterMetrics.document <= androidFooterMetrics.width + 1, 'Android footer must not overflow horizontally')
  assert.ok(androidFooterMetrics.logo.width <= 50 && androidFooterMetrics.logo.height <= 50, 'Android Shayan emblem must be compact')
  assert.ok(androidFooterMetrics.creator.width <= 20 && androidFooterMetrics.creator.height <= 20, 'Android Pooya Labs mark must be compact')
  assert.ok(androidFooterMetrics.creditFits, 'Android creator credit must fit')
  assert.ok(androidFooterMetrics.footerAboveBar, 'Android sticky booking bar must not cover the footer: ' + JSON.stringify(androidFooterMetrics))
  await androidContext.close()
  console.log('[visual] Android touch navigation, booking form, footer and sticky-bar clearance passed')


  const menuToggle = page.getByRole('button', { name: 'باز کردن منو' })
  await menuToggle.click()
  assert.ok(await page.locator('.main-nav').evaluate(element => element.classList.contains('is-open')), 'mobile navigation should open')
  assert.ok(await page.getByRole('link', { name: 'خدمات', exact: true }).isVisible(), 'mobile navigation link should be visible')
  await page.getByRole('link', { name: 'خدمات', exact: true }).click()
  assert.ok(!(await page.locator('.main-nav').evaluate(element => element.classList.contains('is-open'))), 'mobile navigation should close after selection')
  console.log('[browser] mobile navigation interaction passed')

  const trigger = page.locator('.header-book')
  await trigger.click()
  let dialog = page.getByRole('dialog')
  await dialog.waitFor({ state: 'visible' })
  assert.equal(await dialog.getAttribute('aria-modal'), 'true')
  assert.ok(await dialog.getAttribute('aria-labelledby'), 'dialog must have an accessible name')
  assert.ok(await dialog.evaluate(element => element.contains(document.activeElement)), 'initial focus must move into the dialog')
  await assertNoAccessibilityViolations(page, 'public booking dialog')

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
  await assertNoAccessibilityViolations(page, 'customer-management dialog')
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

  // Verify the customer-details form at desktop width.
  await page.setViewportSize({ width: 1024, height: 900 })
  await trigger.click()
  const desktopBookingDialog = page.getByRole('dialog')
  await desktopBookingDialog.waitFor({ state: 'visible' })
  await desktopBookingDialog.locator('.booking-service-option').first().click()
  await desktopBookingDialog.getByRole('button', { name: /ادامه/ }).click()
  await desktopBookingDialog.locator('.booking-date-option').first().click()
  await desktopBookingDialog.locator('.booking-time-option:not([disabled])').first().click()
  await desktopBookingDialog.getByRole('button', { name: /ادامه/ }).click()
  const desktopFormLayout = await desktopBookingDialog.evaluate(element => {
    const grid = element.querySelector('.booking-form-two-cols')
    const body = element.querySelector('.booking-flow-body')
    const footer = element.querySelector('.booking-flow-footer')
    if (!grid || !body || !footer) return null
    const bodyRect = body.getBoundingClientRect()
    const fields = [...grid.querySelectorAll('input')]
    return {
      columns: getComputedStyle(grid).gridTemplateColumns.trim().split(' ').length,
      gridFits: grid.scrollWidth <= grid.clientWidth + 1,
      fieldsFit: fields.every(input => {
        const rect = input.getBoundingClientRect()
        return rect.left >= bodyRect.left - 1 && rect.right <= bodyRect.right + 1
      }),
      footerVisible: footer.getBoundingClientRect().bottom <= element.getBoundingClientRect().bottom + 1,
    }
  })
  assert.ok(desktopFormLayout, 'desktop booking details form should render')
  assert.equal(desktopFormLayout.columns, 2, 'desktop name fields should share a two-column row')
  assert.ok(desktopFormLayout.gridFits && desktopFormLayout.fieldsFit, 'desktop booking fields must fit without clipping')
  assert.ok(desktopFormLayout.footerVisible, 'desktop booking footer must remain within the dialog')
  await page.keyboard.press('Escape')
  await desktopBookingDialog.waitFor({ state: 'detached' })
  console.log('[browser] desktop booking details form layout passed')

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
  await dialog.locator('input[autocomplete="given-name"]').fill('کاربر')
  await dialog.locator('input[autocomplete="family-name"]').fill('آزمایشی')
  await dialog.locator('input[inputmode="tel"]').fill('۰۹۱۲ ۱۲۳-۴۵۶۷')
  const mobileFormLayout = await dialog.evaluate(element => {
    const grid = element.querySelector('.booking-form-two-cols')
    const body = element.querySelector('.booking-flow-body')
    const footer = element.querySelector('.booking-flow-footer')
    if (!grid || !body || !footer) return null
    const bodyRect = body.getBoundingClientRect()
    const fields = [...element.querySelectorAll('.booking-field input')]
    return {
      columns: getComputedStyle(grid).gridTemplateColumns.trim().split(' ').length,
      gridFits: grid.scrollWidth <= grid.clientWidth + 1,
      fieldsFit: fields.every(input => {
        const rect = input.getBoundingClientRect()
        return rect.left >= bodyRect.left - 1 && rect.right <= bodyRect.right + 1
      }),
      footerVisible: footer.getBoundingClientRect().bottom <= element.getBoundingClientRect().bottom + 1,
    }
  })
  assert.ok(mobileFormLayout, 'mobile booking details form should render')
  assert.equal(mobileFormLayout.columns, 1, 'mobile name fields should stack in one column')
  assert.ok(mobileFormLayout.gridFits && mobileFormLayout.fieldsFit, 'mobile booking fields must fit without clipping')
  assert.ok(mobileFormLayout.footerVisible, 'mobile booking footer must remain visible')
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
