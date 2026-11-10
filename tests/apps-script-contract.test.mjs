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
const adminClient = readFileSync(new URL('../src/Admin.tsx', import.meta.url), 'utf8')
const calendarClient = readFileSync(new URL('../src/AdminCalendar.tsx', import.meta.url), 'utf8')
const relayClient = readFileSync(new URL('../src/relay.ts', import.meta.url), 'utf8')

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
    '/api/admin/push-subscriptions', '/api/admin/services', '/api/admin/schedule', '/api/admin/day-schedule', '/api/admin/time-blocks'
  ]) assert.ok(backend.includes(route), `missing API route ${route}`)
  for (const sheet of ['Settings', 'Services', 'WeeklyHours', 'Exceptions', 'Bookings', 'AdminUsers', 'AdminSessions', 'AuditLog', 'PushSubscriptions', 'TimeBlocks']) {
    assert.ok(backend.includes(sheet), `missing Sheets table ${sheet}`)
  }
  assert.match(backend, /LockService\.getScriptLock\(\)/)
  assert.match(backend, /function deleteBooking_\(id, owner\)/)
  assert.match(backend, /bookingDeleteMatch && method === 'DELETE'/)
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


test('owner sessions persist for 30 days, renew on activity, and logout revokes immediately', () => {
  let now = Date.now()
  const store = { session: null, updates: 0, deletes: 0 }
  const cacheEntries = new Map()
  const cache = {
    get(key) { return cacheEntries.get(key)?.value ?? null },
    put(key, value, ttl) { cacheEntries.set(key, { value, ttl }) },
    remove(key) { cacheEntries.delete(key) },
  }
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])) }
    static now() { return now }
  }
  const helpers = runInNewContext(backend + String.fromCharCode(10) + `
    // Replace Apps Script services after evaluating the real backend declarations.
    sha256_ = value => 'digest:' + value;
    findBy_ = (_table, column, value) => store.session?.[column] === value ? { ...store.session } : null;
    appendRecord_ = (_table, record) => { store.session = { ...record } };
    updateRecord_ = (_table, _column, _value, record) => { store.session = { ...record }; store.updates += 1 };
    deleteRecord_ = () => { store.session = null; store.deletes += 1 };
    nowIso_ = () => new Date().toISOString();
    ({ setSession_, getSession_, revokeSession_, SESSION_TTL_, SESSION_CACHE_TTL_ })
  `, {
    Date: FixedDate,
    store,
    CacheService: { getScriptCache: () => cache },
  })

  const sessionId = 'A'.repeat(32)
  const month = 30 * 24 * 60 * 60 * 1000
  helpers.setSession_(sessionId, { id: 'owner-1', username: 'owner' })
  assert.equal(helpers.SESSION_TTL_, 30 * 24 * 60 * 60)
  assert.equal(helpers.SESSION_CACHE_TTL_, 6 * 60 * 60)
  assert.ok(Math.abs(Date.parse(store.session.expiresAt) - (now + month)) < 1000)
  assert.equal([...cacheEntries.values()][0].ttl, 6 * 60 * 60)

  const firstExpiry = Date.parse(store.session.expiresAt)
  now += 7 * 24 * 60 * 60 * 1000
  cacheEntries.clear() // Simulate CacheService expiry; the Sheet row remains.
  const restored = helpers.getSession_(sessionId)
  assert.equal(restored?.username, 'owner')
  assert.equal(store.updates, 1)
  assert.ok(Date.parse(store.session.expiresAt) > firstExpiry)
  assert.ok(Math.abs(Date.parse(store.session.expiresAt) - (now + month)) < 1000)
  assert.equal([...cacheEntries.values()][0].ttl, 6 * 60 * 60)

  now += 31 * 24 * 60 * 60 * 1000
  cacheEntries.clear()
  assert.equal(helpers.getSession_(sessionId), null)
  assert.equal(store.session, null)
  assert.equal(store.deletes, 1)

  helpers.setSession_(sessionId, { id: 'owner-1', username: 'owner' })
  helpers.revokeSession_(sessionId)
  assert.equal(store.session, null)
  assert.equal(cacheEntries.size, 0)
})

test('phone booking email alerts show confirmed status and the booking source', () => {
  assert.ok(backend.includes("booking.source === 'phone' ? 'یک نوبت تلفنی جدید ثبت شد.'"))
  assert.ok(backend.includes("booking.status === 'confirmed' ? 'تأیید شده' : 'در انتظار تأیید'"))
})

test('foreground and background push use data messages, high Web Push urgency and persistent vibration', () => {
  assert.ok(pushClient.includes('registration.showNotification'))
  assert.ok(pushClient.includes("new URL('?admin=1'"))
  assert.ok(pushClient.includes('refreshOwnerPushDeviceRegistration'))
  assert.ok(pushClient.includes('requireInteraction: true'))
  assert.ok(pushClient.includes('vibrate: [0, 450, 180, 450, 180, 750]'))
  assert.doesNotMatch(pushClient, /silent:\s*false/)
  assert.match(backend, /data:\s*\{[\s\S]*?title:[\s\S]*?body:/)
  assert.match(backend, /Urgency:\s*'high'/)
  assert.match(backend, /for \(var attempt = 0; attempt < 3/)
  assert.match(worker, /messaging\.onBackgroundMessage/)
  assert.match(worker, /self\.skipWaiting\(\)/)
  assert.match(worker, /self\.clients\.claim\(\)/)
  assert.match(worker, /requireInteraction: true/)
  assert.doesNotMatch(worker, /silent:\s*false/)
  assert.match(worker, /vibrate: \[0, 450, 180, 450, 180, 750\]/)
  assert.ok(worker.indexOf("self.addEventListener('notificationclick'") < worker.indexOf('importScripts('))
  assert.match(worker, /clientUrl\.pathname\.startsWith\('\/salon-booking\/'\)/)
  assert.doesNotMatch(backend, /notification:\s*\{\s*title:/)
})

test('manager booking views expose customer names and phone numbers as tap-to-call links', () => {
  assert.match(adminClient, /booking\.phone/)
  assert.match(adminClient, /tel:\$\{booking\.phone\}/)
  assert.match(calendarClient, /booking\.phone/)
  assert.match(calendarClient, /tel:\$\{booking\.phone\}/)
  assert.match(backend, /phone: normalizeDigits_\(String\(row\.phone \|\| ''\)\)\.trim\(\)/)
  assert.match(backend, /phone: normalizeDigits_\(String\(item\.row\.phone \|\| ''\)\)\.trim\(\)/)
})

test('Pages relay has bounded, recoverable iframe and request failures', () => {
  assert.match(relayClient, /loadTimeout = window\.setTimeout\([\s\S]*?20000\)/)
  assert.match(relayClient, /frameReady = null/)
  assert.match(relayClient, /pendingRequest\.timeoutId = window\.setTimeout\([\s\S]*?30000\)/)
  assert.match(relayClient, /window\.clearTimeout\(request\.timeoutId\)/)
  assert.match(relayClient, /window\.clearTimeout\(pendingRequest\.timeoutId\)/)
  assert.match(relayClient, /درخواست لغو شد/)
  assert.match(relayClient, /پاسخی از سامانه رزرو دریافت نشد/)
})

test('nested Apps Script bridge accepts only the Pages top window and replies to it', () => {
  assert.match(bridge, /event\.source !== window\.top/)
  assert.match(bridge, /event\.origin !== PARENT_ORIGIN/)
  assert.match(bridge, /window\.top\.postMessage/)
  assert.match(bridge, /google\.script\.run/)
  assert.match(bridge, /\.proxyRequest\(message\.request\)/)
})

test('Pages relay authenticates the nested Apps Script frame and exact response source', () => {
  assert.match(relayClient, /isAppsScriptOrigin/)
  assert.match(relayClient, /isNestedFrameWindow/)
  assert.match(relayClient, /event\.source !== bridgeWindow/)
  assert.match(relayClient, /event\.origin !== bridgeOrigin/)
  assert.match(relayClient, /bridgeWindow\?\.postMessage/)
})


test('daily calendar normalizes date and time values returned as Google Sheets Date cells', () => {
  const result = runInNewContext(backend + String.fromCharCode(10) + `
    var sheetTypedBooking = {
      id: 'sheet-typed-booking',
      date: new Date('2026-11-06T20:30:00.000Z'),
      time: new Date('1899-12-30T05:30:00.000Z'),
      startsAt: new Date('2026-11-07T05:30:00.000Z'),
      endsAt: new Date('2026-11-07T06:15:00.000Z'),
      durationMinutes: '45',
      status: 'confirmed',
      serviceName: 'کوتاهی مو'
    };
    getSettings_ = function () {
      return { timezone: 'Asia/Tehran', slotIntervalMinutes: 15 };
    };
    readTable_ = function (name) {
      return name === 'Bookings' ? [sheetTypedBooking] : [];
    };
    scheduleWindows_ = function () {
      return [{ startsAt: '09:00', endsAt: '17:00' }];
    };
    getAdminDaySchedule_({ get: function () { return '2026-11-07'; } }).payload;
  `, {
    Utilities: {
      formatDate(date, timezone, pattern) {
        if (pattern !== 'HH:mm') throw new Error('Unexpected Apps Script date format: ' + pattern);
        return new Intl.DateTimeFormat('en-GB', {
          timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
        }).format(date);
      },
    },
  });

  assert.equal(result.date, '2026-11-07');
  assert.equal(result.bookings.length, 1);
  assert.deepEqual(
    { time: result.bookings[0].time, endTime: result.bookings[0].endTime, serviceName: result.bookings[0].serviceName },
    { time: '09:00', endTime: '09:45', serviceName: 'کوتاهی مو' },
  );
});

test('booking timestamp overrides a Sheets time-only cell with a historical timezone offset', () => {
  const result = runInNewContext(backend + String.fromCharCode(10) + `
    var row = {
      date: '2026-11-07',
      time: new Date('1899-12-30T05:30:00.000Z'),
      startsAt: new Date('2026-11-07T05:30:00.000Z'),
      durationMinutes: '45'
    };
    rowClock_(row, 'Asia/Tehran');
  `, {
    Utilities: {
      formatDate(date, timezone, pattern) {
        return new Intl.DateTimeFormat('en-GB', {
          timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
        }).format(date);
      },
    },
  });
  assert.equal(result, '09:00');
});

test('date and time Date cells are normalized in the spreadsheet timezone', () => {
  const calls = [];
  const result = runInNewContext(backend + String.fromCharCode(10) + `
    REQUEST_SPREADSHEET_ = { getSpreadsheetTimeZone: function () { return 'Europe/Brussels'; } };
    var value = new Date('2026-11-07T09:00:00.000Z');
    ({
      date: normalizeSheetCell_('date', value),
      time: normalizeSheetCell_('time', value)
    });
  `, {
    Utilities: {
      formatDate(date, timezone, pattern) {
        calls.push({ timezone: timezone, pattern: pattern });
        return timezone + '|' + pattern;
      },
    },
  });
  assert.equal(result.date, 'Europe/Brussels|yyyy-MM-dd');
  assert.equal(result.time, 'Europe/Brussels|HH:mm');
  assert.deepEqual(calls, [
    { timezone: 'Europe/Brussels', pattern: 'yyyy-MM-dd' },
    { timezone: 'Europe/Brussels', pattern: 'HH:mm' },
  ]);
});

test('legacy booking rows without timestamp columns still resolve their date and clock', () => {
  const result = runInNewContext(backend + String.fromCharCode(10) + `
    var legacy = { date: '2026-11-07', time: '09:00', durationMinutes: '45' };
    ({
      start: rowStartMs_(legacy, 'Asia/Tehran'),
      end: rowEndMs_(legacy, 'Asia/Tehran'),
      date: rowDateKey_(legacy, 'Asia/Tehran'),
      time: rowClock_(legacy, 'Asia/Tehran')
    });
  `);
  assert.equal(result.date, '2026-11-07');
  assert.equal(result.time, '09:00');
  assert.ok(Number.isFinite(result.start));
  assert.equal(result.end - result.start, 45 * 60 * 1000);
});

test('Apps Script salon timezone is pinned to Iran', () => {
  assert.ok(backend.includes("var IRAN_TIMEZONE_ = 'Asia/Tehran'"))
  assert.ok(backend.includes("local_timezone: 'Asia/Tehran'"))
  assert.ok(backend.includes('requestedTimezone !== IRAN_TIMEZONE_'))
  assert.ok(backend.includes('var timezone = IRAN_TIMEZONE_'))
  assert.ok(backend.includes("var APP_VERSION_ = '1.5.4'"))
  assert.match(backend, /status: 'confirmed'/)
  assert.match(backend, /REQUEST_TABLE_CACHE_/)
  assert.match(backend, /REQUEST_SPREADSHEET_/)
})


test('manager can block a valid 24-hour clock time', () => {
  class FixedDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [Date.UTC(2026, 10, 5, 5, 0, 0)]))
    }
    static now() { return Date.UTC(2026, 10, 5, 5, 0, 0) }
  }
  const store = { records: [], audits: [] };
  const result = runInNewContext(backend + String.fromCharCode(10) + `
    getSettings_ = () => ({ timezone: 'Asia/Tehran' });
    scheduleWindows_ = () => [{ startsAt: '09:00', endsAt: '17:00' }];
    readTable_ = () => [];
    appendRecord_ = (table, record) => store.records.push({ table, ...record });
    audit_ = (...args) => store.audits.push(args);
    uuid_ = () => '123e4567-e89b-12d3-a456-426614174000';
    nowIso_ = () => '2026-11-05T05:00:00.000Z';
    createTimeBlock_({ date: '2026-11-07', time: '09:00', durationMinutes: 15 }, { id: 'owner-1', username: 'owner' });
  `, {
    Date: FixedDate,
    store,
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  });
  assert.equal(result.status, 201);
  assert.equal(result.payload.block.time, '09:00');
  assert.equal(store.records.at(-1).time, '09:00');
  assert.equal(store.records.at(-1).durationMinutes, '15');
});

test('owner booking deletion removes the selected record under the booking lock and audits it', () => {
  const store = { removed: [], audits: [] };
  const result = runInNewContext(backend + String.fromCharCode(10) + `
    findBy_ = (table, key, value) => table === 'Bookings' && key === 'id' && value === 'booking-1'
      ? { id: value, reference: 'SB-ABCDEFG', date: '2026-11-07', time: '09:00', source: 'online' }
      : null;
    deleteRecord_ = (...args) => { store.removed.push(args); return true; };
    getSettings_ = () => ({ timezone: 'Asia/Tehran' });
    audit_ = (...args) => store.audits.push(args);
    deleteBooking_('booking-1', { id: 'owner-1' });
  `, {
    store,
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  });
  assert.equal(result.status, 200);
  assert.equal(result.payload.deleted, true);
  assert.equal(store.removed[0][0], 'Bookings');
  assert.equal(store.removed[0][1], 'id');
  assert.equal(store.removed[0][2], 'booking-1');
  assert.equal(store.audits[0][0], 'booking.deleted');
  assert.equal(store.audits[0][1], 'owner-1');
});

test('manager time blocks are separate from bookings and participate in availability conflicts', () => {
  assert.ok(backend.includes('function createTimeBlock_(input, owner)'))
  assert.ok(backend.includes('function deleteTimeBlock_(id, owner)'))
  assert.ok(backend.includes("readTable_('TimeBlocks')"))
  assert.ok(backend.includes("audit_('time_block.created'"))
  assert.ok(backend.includes('outside_working_hours'))
  assert.ok(backend.includes('time_already_booked'))
})
