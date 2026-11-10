import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(path, 'utf8')
const manifest = read('android/app/src/main/AndroidManifest.xml')
const appGradle = read('android/app/build.gradle.kts')
const api = read('android/app/src/main/java/com/pooyalabs/salonmanager/SalonApi.kt')
const vault = read('android/app/src/main/java/com/pooyalabs/salonmanager/SessionVault.kt')
const credentialVault = read('android/app/src/main/java/com/pooyalabs/salonmanager/CredentialVault.kt')
const mainActivity = read('android/app/src/main/java/com/pooyalabs/salonmanager/MainActivity.kt')
const vm = read('android/app/src/main/java/com/pooyalabs/salonmanager/AdminViewModel.kt')
const screens = read('android/app/src/main/java/com/pooyalabs/salonmanager/AdminScreens.kt')
const notifications = read('android/app/src/main/java/com/pooyalabs/salonmanager/Notifications.kt')
const messaging = read('android/app/src/main/java/com/pooyalabs/salonmanager/SalonMessagingService.kt')
const pushSync = read('android/app/src/main/java/com/pooyalabs/salonmanager/PushTokenSync.kt')
const backend = read('relay/Code.gs')

test('Android client uses the existing Apps Script proxy and validates owner sessions', () => {
  assert.match(manifest, /android:label="Shayan Barber Studio"/)
  assert.match(mainActivity, /ورود امن Shayan Barber Studio/)
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

test('saved manager credentials are encrypted with biometric-gated Android Keystore', () => {
  assert.match(credentialVault, /AndroidKeyStore/)
  assert.ok(credentialVault.includes("setUserAuthenticationRequired(true)"))
  assert.ok(credentialVault.includes("AUTH_BIOMETRIC_STRONG"))
  assert.ok(credentialVault.includes("AES/GCM/NoPadding"))
  assert.ok(credentialVault.includes("storeAuthenticated"))
  assert.ok(credentialVault.includes("readAuthenticated"))
  assert.match(manifest, /android:allowBackup="false"/)
  assert.match(manifest, /android.permission.USE_BIOMETRIC/)
  assert.match(screens, /ورود سریع با اثر انگشت/)
})

test('biometric capability probing is fail-safe during startup', () => {
  assert.ok(mainActivity.includes("remember(hasSavedCredentials)"))
  assert.ok(mainActivity.includes("hasSavedCredentials && runCatching { credentialVault.isBiometricAvailable() }"))
  assert.ok(mainActivity.includes("val canSaveWithBiometric = runCatching"))
  assert.match(mainActivity, /runCatching \{ credentialVault\.hasSavedCredentials\(\) \}\.getOrDefault\(false\)/)
})

test('notification permission request uses a FragmentActivity-safe 16-bit request code', () => {
  assert.match(mainActivity, /ActivityCompat\.requestPermissions\([\s\S]*?POST_NOTIFICATIONS[\s\S]*?,\s*1001\s*\)/)
  assert.doesNotMatch(mainActivity, /rememberLauncherForActivityResult\(ActivityResultContracts\.RequestPermission\(\)\)/)
})

test('Shayan Barber Studio launcher mark is scaled inside the Android adaptive-icon safe zone', () => {
  const adaptiveIcon = read('android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml')
  const foreground = read('android/app/src/main/res/drawable/ic_launcher_foreground.xml')
  assert.match(adaptiveIcon, /@drawable\/ic_launcher_foreground/)
  assert.match(foreground, /@drawable\/ic_salon_launcher_mark/)
  assert.match(read('android/app/src/main/res/drawable/ic_salon_launcher_mark.xml'), /#35D9C0/)
  assert.match(foreground, /android:insetLeft="16dp"/)
  assert.match(foreground, /android:insetRight="16dp"/)
  assert.match(read('android/app/src/main/res/drawable/ic_launcher_background.xml'), /#11131A/)
})

test('startup Pooya monogram is placed on a true black tile for contrast', () => {
  const loadingScreen = screens.slice(screens.indexOf('fun LoadingScreen()'), screens.indexOf('@Composable', screens.indexOf('fun LoadingScreen()') + 1))
  assert.match(loadingScreen, /Surface\([\s\S]*?color = Color\(0xFF000000\)/)
  assert.match(loadingScreen, /R\.drawable\.pooya_monogram/)
})

test('Android appearance mode persists and supplies accessible Material 3 day/night palettes', () => {
  assert.match(mainActivity, /getSharedPreferences\("salon_ui_preferences"/)
  assert.match(mainActivity, /getString\("theme_mode", "SYSTEM"\)/)
  assert.match(mainActivity, /putString\("theme_mode", mode\)/)
  assert.match(mainActivity, /"SYSTEM" ->|"LIGHT" ->|"DARK" ->/)
  assert.match(mainActivity, /isSystemInDarkTheme\(\)/)
  assert.match(mainActivity, /lightColorScheme\([\s\S]*?primary = Color\(0xFF087F79\)[\s\S]*?background = Color\(0xFFF4F7FA\)/)
  assert.match(mainActivity, /darkColorScheme\([\s\S]*?primary = Color\(0xFF25E6C8\)[\s\S]*?background = Color\(0xFF080A10\)/)
  assert.match(screens, /"SYSTEM" to "خودکار", "LIGHT" to "روز", "DARK" to "شب"/)
})

test('background FCM data messages are rendered immediately in a native high-importance channel', () => {
  assert.match(manifest, /POST_NOTIFICATIONS/)
  assert.match(manifest, /com\.google\.firebase\.MESSAGING_EVENT/)
  assert.match(messaging, /override fun onMessageReceived/)
  assert.ok(messaging.indexOf('SalonNotifications.show') < messaging.indexOf('override fun onNewToken'))
  assert.match(notifications, /NotificationManager\.IMPORTANCE_HIGH/)
  assert.match(notifications, /setLargeIcon\(BitmapFactory\.decodeResource\(context\.resources, R\.drawable\.pooya_monogram\)\)/)
  assert.match(notifications, /enableVibration\(true\)/)
  assert.match(notifications, /setSound\(Settings\.System\.DEFAULT_NOTIFICATION_URI/)
  assert.match(backend, /android:\s*\{ priority: 'HIGH', ttl: '86400s' \}/)
})

test('FCM token is reconciled after reboot with persistent network retries', () => {
  assert.match(manifest, /RECEIVE_BOOT_COMPLETED/)
  assert.match(manifest, /\.PushBootReceiver/)
  assert.match(pushSync, /Intent\.ACTION_BOOT_COMPLETED/)
  assert.match(pushSync, /NetworkType\.CONNECTED/)
  assert.match(pushSync, /Result\.retry\(\)/)
  assert.match(messaging, /PushTokenSyncWorker\.enqueue\(applicationContext, token\)/)
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
  assert.match(screens, /خط زمانی روز/)
  assert.match(screens, /هفته جاری/)
  assert.match(screens, /لغوشده/)
  assert.match(screens, /عدم مراجعه/)
})


test('manual time blocks are selected with a Jalali calendar and stored as Gregorian ISO dates', () => {
  assert.match(screens, /TimeBlockDialog[\s\S]*?تاریخ انتخاب‌شده/)
  assert.match(screens, /JalaliDate\.toGregorian\(year, month, selectedDay\)/)
  assert.match(screens, /فروردین/)
  assert.match(read('android/app/src/main/java/com/pooyalabs/salonmanager/Models.kt'), /ULocale\("fa_IR@calendar=persian"\)/)
})

test('Firebase Android configuration is injected and never committed', () => {
  assert.match(appGradle, /google-services\.json/)
  assert.match(read('.github/workflows/android-app.yml'), /ANDROID_GOOGLE_SERVICES_JSON_BASE64/)
  assert.match(read('android/.gitignore'), /google-services\.json/)
  assert.equal(existsSync('android/app/google-services.json'), false)
  assert.equal(existsSync('android/app/src/main/res/drawable-nodpi/pooya_monogram.webp'), true)
})
