import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import test from 'node:test'

const backend = readFileSync(new URL('../relay/Code.gs', import.meta.url), 'utf8')
const manifest = JSON.parse(readFileSync(new URL('../relay/appsscript.json', import.meta.url), 'utf8'))
const bridge = readFileSync(new URL('../relay/Bridge.html', import.meta.url), 'utf8')
const pushClient = readFileSync(new URL('../src/push-notifications.ts', import.meta.url), 'utf8')
const worker = readFileSync(new URL('../public/firebase-messaging-sw.js', import.meta.url), 'utf8')

test('Apps Script backend parses as V8 JavaScript', () => {
  execFileSync(process.execPath, ['--check'], { input: backend, stdio: ['pipe', 'pipe', 'pipe'] })
})

test('backend avoids APIs missing from Apps Script V8', () => {
  assert.doesNotMatch(backend, /\b(?:URLSearchParams|WORKER_BASE_URL)\b|crypto\.subtle/)
  assert.match(backend, /UrlFetchApp\.fetch\(/)
})

test('Apps Script owns the API and Sheets storage without Cloudflare forwarding', () => {
  for (const route of [
    '/api/public/config', '/api/public/services', '/api/public/availability',
    '/api/public/bookings', '/api/admin/setup-status', '/api/admin/bootstrap',
    '/api/admin/login', '/api/admin/bookings', '/api/admin/availability', '/api/admin/notifications',
    '/api/admin/push-subscriptions', '/api/admin/services', '/api/admin/schedule'
  ]) assert.ok(backend.includes(route), `missing API route ${route}`)
  for (const sheet of ['Settings', 'Services', 'WeeklyHours', 'Exceptions', 'Bookings', 'AdminUsers', 'AdminSessions', 'AuditLog', 'PushSubscriptions']) {
    assert.ok(backend.includes(sheet), `missing Sheets table ${sheet}`)
  }
  assert.match(backend, /LockService\.getScriptLock\(\)/)
  assert.match(backend, /function createManualBooking_\(input, owner\)/)
  assert.match(backend, /!\/\^\(\[01\]\\d\|2\[0-3\]\):\[0-5\]\\d\$\/\.test\(time\)/)
  assert.match(backend, /source: 'phone'/)
  assert.match(backend, /getAvailability_\(date, service, settings, true\)/)
  assert.match(backend, /category: row\.category \|\| 'عمومی'/)
  assert.match(backend, /function sendPushPayload_\(notification\)/)
  assert.match(backend, /ScriptApp\.getOAuthToken\(\)/)
  assert.match(backend, /EMAIL_NOTIFICATIONS_PROPERTY_\) !== 'true'/)
  assert.match(backend, /MailApp\.sendEmail\(/)
  assert.doesNotMatch(backend, /https:\/\/[^\s'"]*workers\.dev|cloudflare/i)
})

test('owner setup and notification settings are editor-guarded', () => {
  assert.match(backend, /function setupSalonDatabase\(\)\s*\{\s*requireOwnerEditor_\(\)/)
  assert.match(backend, /function setSalonNotificationEmail\(email\)\s*\{\s*requireOwnerEditor_\(\)/)
  assert.match(backend, /function proxyRequest\(input\)/)
})

test('manifest deploys an anonymous web app as its deploying owner', () => {
  assert.equal(manifest.runtimeVersion, 'V8')
  assert.equal(manifest.webapp.executeAs, 'USER_DEPLOYING')
  assert.equal(manifest.webapp.access, 'ANYONE_ANONYMOUS')
  assert.ok(manifest.oauthScopes.includes('https://www.googleapis.com/auth/spreadsheets'))
  assert.ok(manifest.oauthScopes.includes('https://www.googleapis.com/auth/script.send_mail'))
  assert.ok(manifest.oauthScopes.includes('https://www.googleapis.com/auth/firebase.messaging'))
  assert.ok(manifest.oauthScopes.includes('https://www.googleapis.com/auth/script.external_request'))
})


test('customer first and last names are normalized into one display name', () => {
  const helpers = runInNewContext(backend + String.fromCharCode(10) + '({ bookingFullName_ })')
  assert.equal(helpers.bookingFullName_({
    firstName: '  Pooya   Ali  ',
    lastName: '  Rezaei   Nouri ',
  }), 'Pooya Ali Rezaei Nouri')
})

test('phone booking email alerts show confirmed status and the booking source', () => {
  assert.ok(backend.includes("booking.source === 'phone' ? 'یک نوبت تلفنی جدید ثبت شد.'"))
  assert.ok(backend.includes("booking.status === 'confirmed' ? 'تأیید شده' : 'در انتظار تأیید'"))
})

test('foreground and background push use the Pages admin route and service-worker notifications', () => {
  assert.ok(pushClient.includes('registration.showNotification'))
  assert.ok(pushClient.includes("new URL('?admin=1'"))
  assert.ok(backend.includes("fcmOptions: { link: 'https://pooya-labs.github.io/salon-booking/?admin=1' }"))
  assert.ok(worker.indexOf("self.addEventListener('notificationclick'") < worker.indexOf('importScripts('))
  assert.doesNotMatch(worker, /onBackgroundMessage/)
})

test('bridge accepts API messages only from the GitHub Pages origin', () => {
  assert.match(bridge, /event\.origin !== PARENT_ORIGIN/)
  assert.match(bridge, /google\.script\.run/)
  assert.match(bridge, /\.proxyRequest\(message\.request\)/)
})
