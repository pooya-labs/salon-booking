import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const backend = readFileSync(new URL('../relay/Code.gs', import.meta.url), 'utf8')
const manifest = JSON.parse(readFileSync(new URL('../relay/appsscript.json', import.meta.url), 'utf8'))
const bridge = readFileSync(new URL('../relay/Bridge.html', import.meta.url), 'utf8')

test('Apps Script backend parses as V8 JavaScript', () => {
  execFileSync(process.execPath, ['--check'], { input: backend, stdio: ['pipe', 'pipe', 'pipe'] })
})

test('backend avoids APIs missing from Apps Script V8', () => {
  assert.doesNotMatch(backend, /\b(?:URLSearchParams|UrlFetchApp|WORKER_BASE_URL)\b|crypto\.subtle/)
})

test('Apps Script owns the API and Sheets storage without Cloudflare forwarding', () => {
  for (const route of [
    '/api/public/config', '/api/public/services', '/api/public/availability',
    '/api/public/bookings', '/api/admin/setup-status', '/api/admin/bootstrap',
    '/api/admin/login', '/api/admin/bookings', '/api/admin/services', '/api/admin/schedule'
  ]) assert.ok(backend.includes(route), `missing API route ${route}`)
  for (const sheet of ['Settings', 'Services', 'WeeklyHours', 'Exceptions', 'Bookings', 'AdminUsers', 'AdminSessions', 'AuditLog']) {
    assert.ok(backend.includes(sheet), `missing Sheets table ${sheet}`)
  }
  assert.match(backend, /LockService\.getScriptLock\(\)/)
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
})

test('bridge accepts API messages only from the GitHub Pages origin', () => {
  assert.match(bridge, /event\.origin !== PARENT_ORIGIN/)
  assert.match(bridge, /google\.script\.run/)
  assert.match(bridge, /\.proxyRequest\(message\.request\)/)
})
