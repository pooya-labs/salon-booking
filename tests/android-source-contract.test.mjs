import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(path, 'utf8')
const manifest = read('android/app/src/main/AndroidManifest.xml')
const appGradle = read('android/app/build.gradle.kts')
const api = read('android/app/src/main/java/com/pooyalabs/salonmanager/SalonApi.kt')
const vault = read('android/app/src/main/java/com/pooyalabs/salonmanager/SessionVault.kt')
const vm = read('android/app/src/main/java/com/pooyalabs/salonmanager/AdminViewModel.kt')
const screens = read('android/app/src/main/java/com/pooyalabs/salonmanager/AdminScreens.kt')
const notifications = read('android/app/src/main/java/com/pooyalabs/salonmanager/Notifications.kt')
const messaging = read('android/app/src/main/java/com/pooyalabs/salonmanager/SalonMessagingService.kt')
const backend = read('relay/Code.gs')

test('Android client uses the existing Apps Script proxy and validates owner sessions', () => {
  assert.match(manifest, /android\.permission\.INTERNET/)
  assert.match(api, /\.post\(envelope\.toString\(\)\.toRequestBody/)
  assert.match(api, /\.put\("path", path\)/)
  assert.match(api, /\.put\("sessionId", sessionId\)/)
  assert.match(backend, /function doPost\(e\)[\s\S]*?proxyRequest\(request\)/)
  assert.match(backend, /function proxyRequest\(input\)[\s\S]*?sessionId = String\(input\.sessionId \|\| ''\)/)
  assert.match(backend, /if \(path\.indexOf\('\/api\/admin\/'\) === 0\) return dispatchAdmin_/)
})

test('manager session is encrypted with a non-exportable Android Keystore key', () => {
  assert.match(vault, /AndroidKeyStore/)
  assert.match(vault, /AES\/GCM\/NoPadding/)
  assert.match(vault, /GCMParameterSpec/)
  assert.match(vault, /preferences\.edit\(\)\.putString\("session", encrypt\(sessionId\)\)/)
})

test('background FCM data messages are rendered immediately in a native high-importance channel', () => {
  assert.match(manifest, /POST_NOTIFICATIONS/)
  assert.match(manifest, /com\.google\.firebase\.MESSAGING_EVENT/)
  assert.match(messaging, /override fun onMessageReceived/)
  assert.ok(messaging.indexOf('SalonNotifications.show') < messaging.indexOf('override fun onNewToken'))
  assert.match(notifications, /NotificationManager\.IMPORTANCE_HIGH/)
  assert.match(notifications, /enableVibration\(true\)/)
  assert.match(notifications, /setSound\(Settings\.System\.DEFAULT_NOTIFICATION_URI/)
  assert.match(backend, /android:\s*\{ priority: 'HIGH', ttl: '86400s' \}/)
})

test('the native manager covers booking, calendar, manual appointments, services, schedule and notifications', () => {
  for (const route of [
    '/api/admin/login', '/api/admin/bookings', '/api/admin/day-schedule',
    '/api/admin/time-blocks', '/api/admin/services', '/api/admin/schedule',
    '/api/admin/settings', '/api/admin/schedule/exceptions', '/api/admin/notifications',
    '/api/admin/notifications/test', '/api/admin/push-subscriptions',
  ]) assert.ok(vm.includes(route), 'Missing manager API route: ' + route)
  assert.match(vm, /createManualBooking/)
  assert.match(screens, /ثبت نوبت تلفنی یا حضوری/)
  assert.match(screens, /شماره تماس/)
  assert.match(screens, /لغوشده/)
  assert.match(screens, /عدم مراجعه/)
})

test('Firebase Android configuration is injected and never committed', () => {
  assert.match(appGradle, /google-services\.json/)
  assert.match(read('.github/workflows/android-app.yml'), /ANDROID_GOOGLE_SERVICES_JSON_BASE64/)
  assert.match(read('android/.gitignore'), /google-services\.json/)
  assert.equal(existsSync('android/app/google-services.json'), false)
})
