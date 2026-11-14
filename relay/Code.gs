/**
 * Salon Booking — Google Apps Script backend.
 *
 * GitHub Pages remains the static frontend. Its hidden HtmlService iframe calls
 * proxyRequest() with google.script.run; this script handles the API locally
 * and stores all application data in a private Google Spreadsheet.
 *
 * Initial setup:
 *   1. Run setupSalonDatabase() from the Apps Script editor.
 *   2. Copy the bootstrap token printed in the execution log.
 *   3. Deploy as a Web app: execute as you, access: anyone.
 */
var APP_VERSION_ = '1.5.5';
var DB_PROPERTY_ = 'SALON_DB_ID';
var BOOTSTRAP_PROPERTY_ = 'ADMIN_BOOTSTRAP_TOKEN';
var NOTIFICATION_PROPERTY_ = 'NOTIFICATION_EMAIL';
var EMAIL_NOTIFICATIONS_PROPERTY_ = 'EMAIL_NOTIFICATIONS_ENABLED';
var FIREBASE_PROJECT_PROPERTY_ = 'FIREBASE_PROJECT_ID';
var SESSION_TTL_ = 30 * 24 * 60 * 60; // Rolling owner-session lifetime: 30 days.
var SESSION_CACHE_TTL_ = 6 * 60 * 60; // CacheService remains a six-hour accelerator.
var SESSION_RENEWAL_WINDOW_ = SESSION_TTL_ - 24 * 60 * 60; // Renew on authenticated activity at least daily.
var IRAN_TIMEZONE_ = 'Asia/Tehran';
// Per-execution memoization avoids reopening Sheets and rereading the same table repeatedly.
var REQUEST_SPREADSHEET_ = null;
var REQUEST_TABLE_CACHE_ = {};

var TABLES_ = {
  Settings: ['key', 'value'],
  Services: ['id', 'name', 'description', 'durationMinutes', 'priceAmount', 'priceCurrency', 'isActive', 'sortOrder', 'createdAt', 'updatedAt', 'category'],
  WeeklyHours: ['weekday', 'isClosed', 'intervalsJson', 'configured'],
  Exceptions: ['id', 'date', 'isClosed', 'intervalsJson', 'note', 'createdAt'],
  Bookings: ['id', 'reference', 'serviceId', 'serviceName', 'durationMinutes', 'name', 'phone', 'date', 'time', 'startsAt', 'endsAt', 'status', 'note', 'manageTokenHash', 'idempotencyKeyHash', 'requestHash', 'createdAt', 'updatedAt', 'source'],
  TimeBlocks: ['id', 'date', 'time', 'startsAt', 'endsAt', 'durationMinutes', 'createdAt', 'createdBy'],
  PushSubscriptions: ['token', 'device', 'isActive', 'createdAt', 'updatedAt'],
  AdminUsers: ['id', 'username', 'salt', 'passwordHash', 'isActive', 'createdAt'],
  AdminSessions: ['sessionIdHash', 'userId', 'username', 'expiresAt', 'createdAt'],
  AuditLog: ['id', 'actorId', 'action', 'entityType', 'entityId', 'detailsJson', 'createdAt']
};

var DEFAULT_SETTINGS_ = {
  local_timezone: 'Asia/Tehran',
  slot_interval_minutes: '15',
  min_booking_notice_minutes: '120',
  booking_window_days: '30',
  buffer_minutes: '0'
};

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Bridge')
    .setTitle('Salon Booking Relay')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function proxyRequest(input) {
  try {
    if (!input || typeof input !== 'object') {
      return { status: 400, body: JSON.stringify({ ok: false, error: 'invalid_envelope', message: 'ساختار درخواست نامعتبر است.' }) };
    }
    var path = String(input.path || '').trim();
    var method = String(input.method || 'GET').toUpperCase();
    var headers = input.headers && typeof input.headers === 'object' ? input.headers : {};
    var sessionId = typeof input.sessionId === 'string' ? input.sessionId : '';
    var body = null;
    if (input.body !== undefined && input.body !== null) {
      body = typeof input.body === 'string' ? (input.body ? JSON.parse(input.body) : null) : input.body;
    }
    var response = dispatch_(path, method, headers, body, sessionId);
    return {
      status: response.status || 200,
      body: JSON.stringify(response.payload || {}),
      sessionId: response.sessionId || sessionId || undefined
    };
  } catch (error) {
    return {
      status: 500,
      body: JSON.stringify({ ok: false, error: 'internal_error', message: error && error.message ? error.message : String(error) })
    };
  }
}

function setupSalonDatabase() {
  requireOwnerEditor_();
  var props = PropertiesService.getScriptProperties();
  var spreadsheetId = props.getProperty(DB_PROPERTY_);
  var spreadsheet;
  if (spreadsheetId) {
    spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  } else {
    spreadsheet = SpreadsheetApp.create('Salon Booking Database');
    props.setProperty(DB_PROPERTY_, spreadsheet.getId());
  }

  Object.keys(TABLES_).forEach(function (name) {
    var sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
    var headers = TABLES_[name];
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, Math.max(sheet.getMaxRows(), 1), headers.length).setNumberFormat('@');
    } else {
      var lastColumn = Math.max(sheet.getLastColumn(), 1);
      var existingHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(String);
      var missingHeaders = headers.filter(function (header) { return existingHeaders.indexOf(header) === -1; });
      if (missingHeaders.length) sheet.getRange(1, lastColumn + 1, 1, missingHeaders.length).setValues([missingHeaders]);
    }
  });

  var settings = getSheet_('Settings');
  if (settings.getLastRow() < 2) {
    var defaults = Object.keys(DEFAULT_SETTINGS_).map(function (key) {
      return [key, DEFAULT_SETTINGS_[key]];
    });
    settings.getRange(2, 1, defaults.length, 2).setValues(defaults);
  }

  var servicesSheet = getSheet_('Services');
  if (servicesSheet.getLastRow() < 2) {
    var now = nowIso_();
    var defaultServices = [
      ['srv-hair-01', 'اصلاح و استایل مو', 'کوتاهی ژورنالی، فرم‌دهی و استایل متناسب با آناتومی چهره', '45', '350000', 'IRR', 'true', '1', now, now, 'مو'],
      ['srv-beard-02', 'اصلاح و فرم‌دهی ریش', 'طراحی خط ریش، اصلاح کلاسیک و رسیدگی به پوست صورت', '30', '250000', 'IRR', 'true', '2', now, now, 'اصلاح'],
      ['srv-facial-03', 'پاکسازی و مراقبت پوست', 'فیشیال تخصصی، لایه‌برداری ملایم، ماسک آبرسان و ماساژ آرامش‌بخش', '60', '450000', 'IRR', 'true', '3', now, now, 'پوست'],
      ['srv-vip-04', 'پکیج VIP آرایشگاه شایان', 'اصلاح کامل مو و ریش، فیشیال، شستشو و استایل نهایی به همراه پذیرایی VIP', '90', '950000', 'IRR', 'true', '4', now, now, 'پکیج']
    ];
    servicesSheet.getRange(2, 1, defaultServices.length, defaultServices[0].length).setValues(defaultServices);
  }

  var weekly = getSheet_('WeeklyHours');
  if (weekly.getLastRow() < 2) {
    var weekdays = [];
    for (var day = 0; day < 7; day += 1) weekdays.push([String(day), 'true', '[]', 'false']);
    weekly.getRange(2, 1, weekdays.length, 4).setValues(weekdays);
  }

  var bootstrap = props.getProperty(BOOTSTRAP_PROPERTY_);
  if (!bootstrap) {
    bootstrap = randomHex_();
    props.setProperty(BOOTSTRAP_PROPERTY_, bootstrap);
  }

  var effectiveEmail = '';
  try {
    effectiveEmail = Session.getEffectiveUser().getEmail() || '';
  } catch (ignored) {}
  if (effectiveEmail && !props.getProperty(NOTIFICATION_PROPERTY_)) {
    props.setProperty(NOTIFICATION_PROPERTY_, effectiveEmail);
  }
  if (props.getProperty(EMAIL_NOTIFICATIONS_PROPERTY_) === null) props.setProperty(EMAIL_NOTIFICATIONS_PROPERTY_, 'false');

  try { MailApp.getRemainingDailyQuota(); } catch (mailError) {
    Logger.log('Mail authorization can be completed later: ' + String(mailError));
  }

  Logger.log('Database URL: ' + spreadsheet.getUrl());
  Logger.log('One-time admin bootstrap token: ' + bootstrap);
  Logger.log('Notification recipient: ' + (props.getProperty(NOTIFICATION_PROPERTY_) || 'not configured'));
  Logger.log('Setup complete. Keep the bootstrap token private and use it once in the owner setup screen.');
  return {
    ok: true,
    databaseUrl: spreadsheet.getUrl(),
    notificationRecipient: props.getProperty(NOTIFICATION_PROPERTY_) || '',
    bootstrapTokenPrintedToLog: true
  };
}

function setSalonNotificationEmail(email) {
  requireOwnerEditor_();
  var value = String(email || '').trim();
  if (value && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
    throw new Error('Enter a valid email address.');
  }
  PropertiesService.getScriptProperties().setProperty(NOTIFICATION_PROPERTY_, value);
  if (value) MailApp.getRemainingDailyQuota();
}

function dispatch_(rawPath, method, headers, body, sessionId) {
  var path = rawPath || '/';
  var query = {};
  var queryAt = path.indexOf('?');
  if (queryAt !== -1) {
    var queryString = path.slice(queryAt + 1);
    path = path.slice(0, queryAt);
    queryString.split('&').forEach(function (pair) {
      if (!pair) return;
      var eq = pair.indexOf('=');
      var key = decodeURIComponent(eq === -1 ? pair : pair.slice(0, eq));
      var value = eq === -1 ? '' : decodeURIComponent(pair.slice(eq + 1));
      query[key] = value;
    });
  }

  if (path === '/api/health' && method === 'GET') return { status: 200, payload: { ok: true, service: 'salon-booking-apps-script', version: APP_VERSION_ } };

  if (path === '/api/public/config' && method === 'GET') {
    var cache = CacheService.getScriptCache();
    var cached = cache.get('CACHE_PUBLIC_CONFIG');
    if (cached) {
      try { return { status: 200, payload: JSON.parse(cached) }; } catch (e) {}
    }
    var settings = getSettings_();
    var payload = {
      ok: true,
      configured: settings.timezone !== 'unset',
      timezone: settings.timezone === 'unset' ? null : settings.timezone,
      bookingWindowDays: settings.bookingWindowDays,
      slotIntervalMinutes: settings.slotIntervalMinutes
    };
    try { cache.put('CACHE_PUBLIC_CONFIG', JSON.stringify(payload), 21600); } catch (e) {}
    return { status: 200, payload: payload };
  }

  if (path === '/api/public/services' && method === 'GET') {
    var cache = CacheService.getScriptCache();
    var cached = cache.get('CACHE_PUBLIC_SERVICES');
    if (cached) {
      try { return { status: 200, payload: JSON.parse(cached) }; } catch (e) {}
    }
    var publicServices = readTable_('Services').filter(function (row) { return bool_(row.isActive); });
    publicServices.sort(serviceSort_);
    var payload = { ok: true, services: publicServices.map(servicePayload_) };
    try { cache.put('CACHE_PUBLIC_SERVICES', JSON.stringify(payload), 21600); } catch (e) {}
    return { status: 200, payload: payload };
  }

  if (path === '/api/public/availability' && method === 'GET') {
    var date = String(query.date || '').trim();
    var serviceId = String(query.serviceId || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return error_(400, 'invalid_date', 'تاریخ نامعتبر است.');
    var service = serviceId ? findBy_('Services', 'id', serviceId) : null;
    if (!service || !bool_(service.isActive)) return error_(404, 'service_not_found', 'خدمت انتخاب‌شده یافت نشد یا غیرفعال است.');
    return {
      status: 200,
      payload: {
        ok: true,
        date: date,
        slots: getAvailability_(date, service, getSettings_(), false)
      }
    };
  }

  if (path === '/api/public/bookings' && method === 'POST') {
    var ip = clientIp_(headers);
    return createCustomerBooking_(body || {}, ip);
  }

  if (path === '/api/public/bookings/lookup' && method === 'POST') {
    var lookupIp = clientIp_(headers);
    return lookupCustomerBookings_(body || {}, lookupIp);
  }

  if (path === '/api/public/bookings/cancel' && method === 'POST') {
    var cancelIp = clientIp_(headers);
    return cancelCustomerBooking_(body || {}, cancelIp);
  }

  if (path.indexOf('/api/admin/') === 0) return dispatchAdmin_(path, method, query, headers, body, sessionId);

  return error_(404, 'not_found', 'این مسیر پیدا نشد.');
}

function dispatchAdmin_(path, method, query, headers, body, sessionId) {
  var props = PropertiesService.getScriptProperties();
  var hasUsers = readTable_('AdminUsers').some(function (user) { return bool_(user.isActive); });

  if (path === '/api/admin/setup-status' && method === 'GET') {
    return {
      status: 200,
      payload: {
        ok: true,
        setupRequired: !hasUsers,
        adminUserExists: hasUsers
      }
    };
  }

  if (path === '/api/admin/bootstrap' && method === 'POST') {
    if (hasUsers) return error_(409, 'bootstrap_already_completed', 'مدیر ارشد سامانه قبلاً ثبت شده است.');
    var token = String((body && body.bootstrapToken) || '').trim();
    var expectedToken = String(props.getProperty(BOOTSTRAP_PROPERTY_) || '').trim();
    if (!expectedToken || token !== expectedToken) return error_(401, 'invalid_bootstrap_token', 'توکن راه‌اندازی اولیه نادرست است.');
    var username = normalizeUsername_((body && body.username) || '');
    var password = String((body && body.password) || '');
    if (!isValidUsername_(username)) return error_(400, 'invalid_username', 'نام کاربری باید بین ۳ تا ۳۲ کاراکتر و از حروف، اعداد، خط تیره یا زیرخط باشد.');
    if (password.length < 10) return error_(400, 'weak_password', 'رمز عبور باید حداقل ۱۰ کاراکتر باشد.');
    var user = createUser_(username, password);
    props.deleteProperty(BOOTSTRAP_PROPERTY_);
    audit_('admin.bootstrapped', user.id, 'admin_user', user.id, { username: user.username });
    var createdSession = createSession_(user);
    return {
      status: 201,
      payload: { ok: true, user: { id: user.id, username: user.username } },
      sessionId: createdSession.sessionId
    };
  }

  if (path === '/api/admin/login' && method === 'POST') {
    var loginUsername = normalizeUsername_((body && body.username) || '');
    var loginPassword = String((body && body.password) || '');
    var userRecord = findBy_('AdminUsers', 'username', loginUsername);
    if (!userRecord || !bool_(userRecord.isActive) || !verifyPassword_(loginPassword, userRecord.salt, userRecord.passwordHash)) {
      audit_('admin.login_failed', null, 'admin_user', loginUsername, { ip: clientIp_(headers) });
      return error_(401, 'invalid_credentials', 'نام کاربری یا رمز عبور اشتباه است.');
    }
    var session = createSession_(userRecord);
    audit_('admin.login_succeeded', userRecord.id, 'admin_user', userRecord.id, {});
    return { status: 200, payload: { ok: true, user: { id: userRecord.id, username: userRecord.username } }, sessionId: session.sessionId };
  }

  if (path === '/api/admin/logout' && method === 'POST') {
    var sessionHash = hashSessionId_(sessionId);
    deleteRecord_('AdminSessions', 'sessionIdHash', sessionHash);
    try { CacheService.getScriptCache().remove('sess_' + sessionHash); } catch (ignored) {}
    audit_('admin.logged_out', null, 'admin_session', sessionHash, {});
    return { status: 200, payload: { ok: true }};
  }

  var owner = authenticateOwner_(sessionId);
  if (!owner) {
    if (path === '/api/admin/me' && method === 'GET') return error_(401, 'unauthorized', 'برای ادامه وارد پنل مدیریت شوید.');
    if (path === '/api/admin/setup-status') return error_(405, 'method_not_allowed', 'روش درخواست پشتیبانی نمی‌شود.');
    return error_(401, 'unauthorized', 'برای ادامه وارد پنل مدیریت شوید.');
  }

  if (path === '/api/admin/me' && method === 'GET') {
    return { status: 200, payload: { ok: true, user: { id: owner.id, username: owner.username } }};
  }
  if (path === '/api/admin/bookings' && method === 'GET') return getAdminBookings_(query, owner);
  var bookingDeleteMatch = /^\/api\/admin\/bookings\/([A-Za-z0-9-]{36})$/.exec(path);
  if (bookingDeleteMatch && method === 'DELETE') return deleteBooking_(bookingDeleteMatch[1], owner);
  if (path === '/api/admin/availability' && method === 'GET') return getAdminAvailability_(query);
  if (path === '/api/admin/day-schedule' && method === 'GET') return getAdminDaySchedule_(query);
  if (path === '/api/admin/time-blocks' && method === 'POST') return createTimeBlock_(body, owner);
  var timeBlockMatch = /^\/api\/admin\/time-blocks\/([A-Za-z0-9-]{36})$/.exec(path);
  if (timeBlockMatch && method === 'DELETE') return deleteTimeBlock_(timeBlockMatch[1], owner);
  if (path === '/api/admin/bookings' && method === 'POST') return createManualBooking_(body, owner);
  if (path === '/api/admin/notifications' && method === 'GET') return getNotificationSettings_();
  if (path === '/api/admin/notifications' && method === 'PUT') return saveNotificationSettings_(body, owner);
  if (path === '/api/admin/notifications/test' && method === 'POST') return sendTestPush_(owner);
  if (path === '/api/admin/push-subscriptions' && method === 'POST') return savePushSubscription_(body, owner);
  if (path === '/api/admin/push-subscriptions' && method === 'DELETE') return removePushSubscription_(body, owner);
  if (path === '/api/admin/services' && method === 'GET') {
    var services = readTable_('Services').sort(serviceSort_);
    return { status: 200, payload: { ok: true, services: services.map(servicePayload_) }};
  }
  if (path === '/api/admin/services' && method === 'POST') return saveService_(body, owner, null);

  var serviceMatch = /^\/api\/admin\/services\/([A-Za-z0-9-]{36})$/.exec(path);
  if (serviceMatch && method === 'PATCH') return saveService_(body, owner, serviceMatch[1]);

  if (path === '/api/admin/schedule' && method === 'GET') return getAdminSchedule_();
  if (path === '/api/admin/settings' && method === 'PUT') return saveSettings_(body, owner);

  var weekdayMatch = /^\/api\/admin\/schedule\/weekly\/([0-6])$/.exec(path);
  if (weekdayMatch && method === 'PUT') return saveWeeklyHours_(Number(weekdayMatch[1]), body, owner);

  if (path === '/api/admin/schedule/exceptions' && method === 'POST') return saveException_(body, owner);
  var exceptionMatch = /^\/api\/admin\/schedule\/exceptions\/([A-Za-z0-9-]{36})$/.exec(path);
  if (exceptionMatch && method === 'DELETE') return deleteException_(exceptionMatch[1], owner);

  var statusMatch = /^\/api\/admin\/bookings\/([A-Za-z0-9-]{36})\/status$/.exec(path);
  if (statusMatch && method === 'PATCH') return updateBookingStatus_(statusMatch[1], body, owner);

  return error_(404, 'not_found', 'این مسیر پیدا نشد.');
}

function createCustomerBooking_(input, ip) {
  var serviceId = String(input.serviceId || '').trim();
  var date = String(input.date || '').trim();
  var time = String(input.time || '').trim();
  var firstName = String(input.firstName || '').trim();
  var lastName = String(input.lastName || '').trim();
  var phone = normalizePhone_(input.phone);
  var note = String(input.note || '').trim();
  var fullName = bookingFullName_({ firstName: firstName, lastName: lastName });

  if (!serviceId || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ||
      !firstName || !lastName || !phone || !isValidPhone_(phone) || note.length > 500) {
    return error_(400, 'invalid_booking', 'اطلاعات نوبت معتبر نیست. لطفاً تمام فیلدها را به درستی تکمیل فرمایید.');
  }

  var service = findBy_('Services', 'id', serviceId);
  if (!service || !bool_(service.isActive)) return error_(404, 'service_not_found', 'خدمت انتخاب‌شده یافت نشد یا غیرفعال است.');

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return error_(503, 'busy', 'سامانه رزرو در حال حاضر مشغول است. لطفاً چند لحظه بعد دوباره تلاش فرمایید.');

  try {
    var settings = getSettings_();
    var available = getAvailability_(date, service, settings, false);
    if (available.indexOf(time) === -1) {
      return error_(409, 'slot_unavailable', 'ساعت انتخاب‌شده پر شده است یا در ساعات کاری سالن نیست.');
    }

    var reference = generateReference_();
    var manageToken = randomHex_();
    var duration = Number(service.durationMinutes);
    var startMs = parseSlotDateTime_(date, time, settings.timezone);
    var endMs = startMs + duration * 60 * 1000;
    var now = nowIso_();

    var booking = {
      id: uuid_(),
      reference: reference,
      serviceId: service.id,
      serviceName: service.name,
      durationMinutes: String(duration),
      name: fullName,
      phone: phone,
      date: date,
      time: time,
      startsAt: new Date(startMs).toISOString(),
      endsAt: new Date(endMs).toISOString(),
      status: 'confirmed',
      note: note,
      manageTokenHash: sha256_(manageToken),
      idempotencyKeyHash: '',
      requestHash: sha256_(ip + '|' + service.id + '|' + date + '|' + time),
      createdAt: now,
      updatedAt: now,
      source: 'online'
    };

    appendRecord_('Bookings', booking);
    audit_('booking.created_public', null, 'booking', booking.id, { reference: reference, date: date, time: time });

    sendBookingNotifications_(booking, service);

    return {
      status: 201,
      payload: {
        ok: true,
        reference: reference,
        manageToken: manageToken,
        booking: {
          reference: reference,
          serviceName: service.name,
          date: date,
          time: time,
          durationMinutes: duration,
          name: fullName,
          status: 'confirmed'
        }
      }
    };
  } finally {
    lock.releaseLock();
  }
}

function lookupCustomerBookings_(input, ip) {
  var phone = normalizePhone_(input.phone);
  var reference = String(input.reference || '').trim().toUpperCase();
  if (!phone || !isValidPhone_(phone) || !reference) {
    return error_(400, 'invalid_lookup', 'شماره موبایل و کد رهگیری معتبر الزامی است.');
  }

  var bookings = readTable_('Bookings').filter(function (row) {
    return normalizePhone_(row.phone) === phone && String(row.reference || '').toUpperCase() === reference;
  });

  return {
    status: 200,
    payload: {
      ok: true,
      bookings: bookings.map(function (row) {
        return {
          id: row.id,
          reference: row.reference,
          serviceName: row.serviceName,
          date: row.date,
          time: row.time,
          durationMinutes: Number(row.durationMinutes),
          name: row.name,
          status: row.status,
          createdAt: row.createdAt
        };
      })
    }
  };
}

function cancelCustomerBooking_(input, ip) {
  var reference = String(input.reference || '').trim().toUpperCase();
  var manageToken = String(input.manageToken || '').trim();
  if (!reference || !manageToken) return error_(400, 'invalid_request', 'کد رهگیری و کد لغو الزامی است.');

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return error_(503, 'busy', 'سامانه مشغول است. لطفاً مجدداً تلاش فرمایید.');

  try {
    var booking = findBy_('Bookings', 'reference', reference);
    if (!booking) return error_(404, 'booking_not_found', 'نوبتی با این مشخصات یافت نشد.');
    if (sha256_(manageToken) !== booking.manageTokenHash) return error_(403, 'unauthorized', 'کد لغو نامعتبر است.');
    if (booking.status === 'cancelled') return error_(400, 'already_cancelled', 'این نوبت قبلاً لغو شده است.');

    var record = Object.assign({}, booking, { status: 'cancelled', updatedAt: nowIso_() });
    updateRecord_('Bookings', 'id', booking.id, record);
    audit_('booking.cancelled_public', null, 'booking', booking.id, { reference: reference });

    return { status: 200, payload: { ok: true, message: 'نوبت شما با موفقیت لغو شد.' }};
  } finally {
    lock.releaseLock();
  }
}

function createManualBooking_(input, owner) {
  var serviceId = String(input.serviceId || '').trim();
  var date = String(input.date || '').trim();
  var time = String(input.time || '').trim();
  var name = String(input.name || '').trim();
  var phone = normalizePhone_(input.phone);
  var note = String(input.note || '').trim();

  if (!serviceId || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ||
      name.length < 2 || !phone || !isValidPhone_(phone)) {
    return error_(400, 'invalid_booking', 'مشخصات نوبت دستی معتبر نیست.');
  }

  var service = findBy_('Services', 'id', serviceId);
  if (!service) return error_(404, 'service_not_found', 'خدمت یافت نشد.');

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return error_(503, 'busy', 'سامانه مشغول است.');

  try {
    var settings = getSettings_();
    var available = getAvailability_(date, service, settings, true);
    if (available.indexOf(time) === -1) {
      return error_(409, 'slot_conflict', 'ساعت انتخابی با نوبت دیگری تداخل دارد.');
    }

    var reference = generateReference_();
    var duration = Number(service.durationMinutes);
    var startMs = parseSlotDateTime_(date, time, settings.timezone);
    var endMs = startMs + duration * 60 * 1000;
    var now = nowIso_();

    var booking = {
      id: uuid_(),
      reference: reference,
      serviceId: service.id,
      serviceName: service.name,
      durationMinutes: String(duration),
      name: name,
      phone: phone,
      date: date,
      time: time,
      startsAt: new Date(startMs).toISOString(),
      endsAt: new Date(endMs).toISOString(),
      status: 'confirmed',
      note: note,
      manageTokenHash: '',
      idempotencyKeyHash: '',
      requestHash: '',
      createdAt: now,
      updatedAt: now,
      source: 'phone'
    };

    appendRecord_('Bookings', booking);
    audit_('booking.created_manual', owner.id, 'booking', booking.id, { reference: reference });
    return { status: 201, payload: { ok: true, booking: booking }};
  } finally {
    lock.releaseLock();
  }
}

function deleteBooking_(id, owner) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return error_(503, 'busy', 'سامانه مشغول است.');

  try {
    var booking = findBy_('Bookings', 'id', id);
    if (!booking) return error_(404, 'booking_not_found', 'نوبت پیدا نشد.');
    deleteRecord_('Bookings', 'id', id);
    audit_('booking.deleted', owner.id, 'booking', id, { reference: booking.reference });
    return { status: 200, payload: { ok: true, deleted: true }};
  } finally {
    lock.releaseLock();
  }
}

function updateBookingStatus_(id, input, owner) {
  var status = String(input.status || '').toLowerCase().trim();
  if (['confirmed', 'completed', 'cancelled'].indexOf(status) === -1) {
    return error_(400, 'invalid_status', 'وضعیت نامعتبر است.');
  }

  var booking = findBy_('Bookings', 'id', id);
  if (!booking) return error_(404, 'booking_not_found', 'نوبت پیدا نشد.');

  var record = Object.assign({}, booking, { status: status, updatedAt: nowIso_() });
  updateRecord_('Bookings', 'id', id, record);
  audit_('booking.status_updated', owner.id, 'booking', id, { status: status });
  return { status: 200, payload: { ok: true, booking: record }};
}

function createTimeBlock_(input, owner) {
  var date = String(input.date || '').trim();
  var time = String(input.time || '').trim();
  var duration = Number(input.durationMinutes || 15);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || duration < 5 || duration > 480) {
    return error_(400, 'invalid_block', 'اطلاعات بازه مسدود نامعتبر است.');
  }

  var settings = getSettings_();
  var startMs = parseSlotDateTime_(date, time, settings.timezone);
  var endMs = startMs + duration * 60 * 1000;

  var block = {
    id: uuid_(),
    date: date,
    time: time,
    startsAt: new Date(startMs).toISOString(),
    endsAt: new Date(endMs).toISOString(),
    durationMinutes: String(duration),
    createdAt: nowIso_(),
    createdBy: owner.id
  };

  appendRecord_('TimeBlocks', block);
  audit_('time_block.created', owner.id, 'time_block', block.id, { date: date, time: time, duration: duration });
  return { status: 201, payload: { ok: true, block: block }};
}

function deleteTimeBlock_(id, owner) {
  var block = findBy_('TimeBlocks', 'id', id);
  if (!block) return error_(404, 'block_not_found', 'بازه پیدا نشد.');
  deleteRecord_('TimeBlocks', 'id', id);
  audit_('time_block.deleted', owner.id, 'time_block', id, {});
  return { status: 200, payload: { ok: true }};
}

function saveService_(input, owner, id) {
  var current = id ? findBy_('Services', 'id', id) : null;
  if (id && !current) return error_(404, 'service_not_found', 'خدمت پیدا نشد.');
  var name = input.name === undefined && current ? current.name : input.name;
  var description = input.description === undefined && current ? current.description : input.description;
  var category = input.category === undefined && current ? (current.category || 'عمومی') : input.category;
  var duration = input.durationMinutes === undefined && current ? Number(current.durationMinutes) : Number(input.durationMinutes);
  var price = input.priceAmount === undefined && current ? Number(current.priceAmount) : Number(input.priceAmount);
  var currency = input.priceCurrency === undefined && current ? current.priceCurrency : input.priceCurrency;
  var active = input.isActive === undefined && current ? bool_(current.isActive) : input.isActive;
  var order = input.sortOrder === undefined && current ? Number(current.sortOrder) : Number(input.sortOrder || 0);
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80 ||
      typeof description !== 'string' || description.length > 300 ||
      typeof category !== 'string' || category.trim().length < 1 || category.trim().length > 40 ||
      !Number.isInteger(duration) || duration < 5 || duration > 480 ||
      !Number.isSafeInteger(price) || price < 0 || price > 2000000000 ||
      typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency) ||
      typeof active !== 'boolean' || !Number.isInteger(order) || order < 0 || order > 10000) {
    return error_(400, 'invalid_service', 'نام، توضیحات، مدت، قیمت یا واحد پول خدمت معتبر نیست.');
  }
  var now = nowIso_();
  var record = {
    id: id || uuid_(), name: name.trim(), description: description.trim(), category: category.trim(),
    durationMinutes: String(duration), priceAmount: String(price), priceCurrency: currency,
    isActive: String(active), sortOrder: String(order),
    createdAt: current ? current.createdAt : now, updatedAt: now
  };
  if (current) updateRecord_('Services', 'id', id, record);
  else appendRecord_('Services', record);
  try { CacheService.getScriptCache().remove('CACHE_PUBLIC_SERVICES'); } catch (e) {}
  audit_(current ? 'service.updated' : 'service.created', owner.id, 'service', record.id, { name: record.name, isActive: active });
  return { status: current ? 200 : 201, payload: { ok: true, id: record.id }};
}

function serviceSort_(a, b) {
  if (bool_(a.isActive) !== bool_(b.isActive)) return bool_(a.isActive) ? -1 : 1;
  var diff = Number(a.sortOrder) - Number(b.sortOrder);
  return diff || String(a.name).localeCompare(String(b.name));
}

function servicePayload_(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    category: row.category || 'عمومی',
    durationMinutes: Number(row.durationMinutes),
    priceAmount: Number(row.priceAmount),
    priceCurrency: row.priceCurrency || 'IRR',
    isActive: bool_(row.isActive),
    sortOrder: Number(row.sortOrder || 0)
  };
}

function saveSettings_(input, owner) {
  var current = getSettings_();
  var requestedTimezone = input.timezone === undefined ? IRAN_TIMEZONE_ : input.timezone;
  var timezone = IRAN_TIMEZONE_;
  var interval = input.slotIntervalMinutes === undefined ? current.slotIntervalMinutes : Number(input.slotIntervalMinutes);
  var notice = input.minBookingNoticeMinutes === undefined ? current.minBookingNoticeMinutes : Number(input.minBookingNoticeMinutes);
  var horizon = input.bookingWindowDays === undefined ? current.bookingWindowDays : Number(input.bookingWindowDays);
  var buffer = input.bufferMinutes === undefined ? current.bufferMinutes : Number(input.bufferMinutes);
  if (requestedTimezone !== IRAN_TIMEZONE_) return error_(400, 'invalid_timezone', 'منطقه زمانی این سامانه روی Asia/Tehran ثابت است.');
  if (!Number.isInteger(interval) || interval < 5 || interval > 120) return error_(400, 'invalid_slot_interval', 'فاصله زمانی نوبت‌ها باید بین ۵ تا ۱۲۰ دقیقه باشد.');
  if (!Number.isInteger(notice) || notice < 0 || notice > 10080) return error_(400, 'invalid_notice', 'حداقل فاصله رزرو باید بین صفر تا ۷ روز باشد.');
  if (!Number.isInteger(horizon) || horizon < 1 || horizon > 365) return error_(400, 'invalid_horizon', 'بازه رزرو باید بین ۱ تا ۳۶۵ روز باشد.');
  if (!Number.isInteger(buffer) || buffer < 0 || buffer > 240) return error_(400, 'invalid_buffer', 'زمان فاصله بین نوبت‌ها باید بین صفر تا ۲۴۰ دقیقه باشد.');
  if (timezone !== current.timezone && readTable_('Bookings').some(function (row) {
    return ['pending', 'confirmed'].indexOf(String(row.status || '').toLowerCase()) !== -1 && rowStartMs_(row, current.timezone) >= Date.now();
  })) return error_(409, 'timezone_has_bookings', 'تا زمانی که نوبت فعال آینده وجود دارد، تغییر منطقه زمانی مجاز نیست.');
  var values = {
    local_timezone: timezone, slot_interval_minutes: String(interval),
    min_booking_notice_minutes: String(notice), booking_window_days: String(horizon),
    buffer_minutes: String(buffer)
  };
  Object.keys(values).forEach(function (key) { saveSetting_(key, values[key]); });
  try { CacheService.getScriptCache().remove('CACHE_PUBLIC_CONFIG'); } catch (e) {}
  audit_('salon.settings_updated', owner.id, 'salon', 'settings', values);
  return { status: 200, payload: { ok: true, settings: getSettings_() }};
}

function saveWeeklyHours_(weekday, input, owner) {
  if (typeof input.isClosed !== 'boolean') return error_(400, 'invalid_request', 'وضعیت روز کاری معتبر نیست.');
  var intervals = input.isClosed ? [] : normalizeIntervals_(input.intervals || [
    { startsAt: input.opensAt, endsAt: input.closesAt }
  ]);
  var record = {
    weekday: String(weekday),
    isClosed: String(input.isClosed),
    intervalsJson: JSON.stringify(intervals),
    configured: 'true'
  };
  updateRecord_('WeeklyHours', 'weekday', String(weekday), record);
  audit_('schedule.weekly_updated', owner.id, 'weekly_hours', String(weekday), record);
  return { status: 200, payload: { ok: true }};
}

function saveException_(input, owner) {
  var date = String(input.date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return error_(400, 'invalid_date', 'تاریخ نامعتبر است.');
  var isClosed = Boolean(input.isClosed);
  var intervals = isClosed ? [] : normalizeIntervals_(input.intervals || []);
  var note = String(input.note || '').trim();

  var record = {
    id: uuid_(),
    date: date,
    isClosed: String(isClosed),
    intervalsJson: JSON.stringify(intervals),
    note: note,
    createdAt: nowIso_()
  };
  appendRecord_('Exceptions', record);
  audit_('schedule.exception_created', owner.id, 'exception', record.id, record);
  return { status: 201, payload: { ok: true, exception: record }};
}

function deleteException_(id, owner) {
  var exception = findBy_('Exceptions', 'id', id);
  if (!exception) return error_(404, 'exception_not_found', 'استثنا پیدا نشد.');
  deleteRecord_('Exceptions', 'id', id);
  audit_('schedule.exception_deleted', owner.id, 'exception', id, {});
  return { status: 200, payload: { ok: true }};
}

function getSettings_() {
  var map = Object.assign({}, DEFAULT_SETTINGS_);
  readTable_('Settings').forEach(function (row) { map[row.key] = row.value; });
  return {
    timezone: map.local_timezone || IRAN_TIMEZONE_,
    slotIntervalMinutes: Number(map.slot_interval_minutes || 15),
    minBookingNoticeMinutes: Number(map.min_booking_notice_minutes || 120),
    bookingWindowDays: Number(map.booking_window_days || 30),
    bufferMinutes: Number(map.buffer_minutes || 0)
  };
}

function saveSetting_(key, value) {
  var current = findBy_('Settings', 'key', key);
  var record = { key: key, value: String(value) };
  if (current) updateRecord_('Settings', 'key', key, record);
  else appendRecord_('Settings', record);
}

function getAdminSchedule_() {
  var weekly = readTable_('WeeklyHours');
  var exceptions = readTable_('Exceptions');
  var settings = getSettings_();
  return {
    status: 200,
    payload: {
      ok: true,
      settings: settings,
      weekly: weekly.map(function (row) {
        return {
          weekday: Number(row.weekday),
          isClosed: bool_(row.isClosed),
          intervals: JSON.parse(row.intervalsJson || '[]'),
          configured: bool_(row.configured)
        };
      }),
      exceptions: exceptions.map(function (row) {
        return {
          id: row.id,
          date: row.date,
          isClosed: bool_(row.isClosed),
          intervals: JSON.parse(row.intervalsJson || '[]'),
          note: row.note || ''
        };
      })
    }
  };
}

function getAdminBookings_(query, owner) {
  var bookings = readTable_('Bookings').map(function (row) {
    return {
      id: row.id,
      reference: row.reference,
      serviceId: row.serviceId,
      serviceName: row.serviceName,
      durationMinutes: Number(row.durationMinutes),
      name: row.name,
      phone: row.phone,
      date: row.date,
      time: row.time,
      status: row.status,
      note: row.note || '',
      source: row.source || 'online',
      createdAt: row.createdAt
    };
  });
  return { status: 200, payload: { ok: true, bookings: bookings }};
}

function getAdminAvailability_(query) {
  var date = String(query.date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return error_(400, 'invalid_date', 'تاریخ معتبر الزامی است.');
  var dummyService = { durationMinutes: 15 };
  return {
    status: 200,
    payload: {
      ok: true,
      date: date,
      slots: getAvailability_(date, dummyService, getSettings_(), true)
    }
  };
}

function getAdminDaySchedule_(query) {
  var date = String(query.date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return error_(400, 'invalid_date', 'تاریخ نامعتبر است.');
  var bookings = readTable_('Bookings').filter(function (row) {
    return row.date === date && row.status !== 'cancelled';
  });
  var blocks = readTable_('TimeBlocks').filter(function (row) { return row.date === date; });
  return {
    status: 200,
    payload: {
      ok: true,
      date: date,
      bookings: bookings,
      blocks: blocks
    }
  };
}

function getAvailability_(date, service, settings, isAdmin) {
  var duration = Number(service.durationMinutes);
  var intervals = scheduleWindows_(date, settings);
  if (!intervals.length) return [];

  var intervalMinutes = settings.slotIntervalMinutes || 15;
  var minNoticeMs = (settings.minBookingNoticeMinutes || 0) * 60 * 1000;
  var nowMs = Date.now();

  var bookings = readTable_('Bookings').filter(function (row) {
    return row.date === date && ['pending', 'confirmed'].indexOf(String(row.status || '').toLowerCase()) !== -1;
  });
  var blocks = readTable_('TimeBlocks').filter(function (row) { return row.date === date; });

  var slots = [];
  intervals.forEach(function (window) {
    var windowStart = parseSlotDateTime_(date, window.startsAt, settings.timezone);
    var windowEnd = parseSlotDateTime_(date, window.endsAt, settings.timezone);

    for (var current = windowStart; current + duration * 60 * 1000 <= windowEnd; current += intervalMinutes * 60 * 1000) {
      if (!isAdmin && current < nowMs + minNoticeMs) continue;

      var slotEnd = current + duration * 60 * 1000;
      var hasConflict = bookings.some(function (b) {
        var bStart = parseSlotDateTime_(b.date, b.time, settings.timezone);
        var bEnd = bStart + Number(b.durationMinutes) * 60 * 1000;
        return current < bEnd && slotEnd > bStart;
      }) || blocks.some(function (blk) {
        var blkStart = parseSlotDateTime_(blk.date, blk.time, settings.timezone);
        var blkEnd = blkStart + Number(blk.durationMinutes) * 60 * 1000;
        return current < blkEnd && slotEnd > blkStart;
      });

      if (!hasConflict) {
        slots.push(formatClock_(new Date(current), settings.timezone));
      }
    }
  });

  return slots;
}

function scheduleWindows_(date, settings) {
  var exception = findBy_('Exceptions', 'date', date);
  if (exception) {
    if (bool_(exception.isClosed)) return [];
    return JSON.parse(exception.intervalsJson || '[]');
  }
  var d = new Date(date + 'T12:00:00Z');
  var weekday = (d.getUTCDay() + 1) % 7; // Iran weekday align if needed or standard
  var weekly = findBy_('WeeklyHours', 'weekday', String(weekday));
  if (!weekly || bool_(weekly.isClosed)) return [];
  return JSON.parse(weekly.intervalsJson || '[]');
}

function normalizeIntervals_(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(function (it) {
    return it && /^([01]\d|2[0-3]):[0-5]\d$/.test(it.startsAt) && /^([01]\d|2[0-3]):[0-5]\d$/.test(it.endsAt) && it.startsAt < it.endsAt;
  }).map(function (it) { return { startsAt: it.startsAt, endsAt: it.endsAt }; });
}

function parseSlotDateTime_(dateStr, timeStr, timezone) {
  var parts = dateStr.split('-');
  var timeParts = timeStr.split(':');
  var iso = Utilities.formatDate(new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), Number(timeParts[0]), Number(timeParts[1]))), timezone, "yyyy-MM-dd'T'HH:mm:ssXXX");
  return new Date(iso).getTime();
}

function formatClock_(date, timezone) {
  return Utilities.formatDate(date, timezone, 'HH:mm');
}

function rowStartMs_(row, timezone) {
  return parseSlotDateTime_(row.date, row.time, timezone);
}

function rowEndMs_(row, timezone) {
  return rowStartMs_(row, timezone) + Number(row.durationMinutes) * 60 * 1000;
}

function rowDateKey_(row, timezone) {
  return row.date;
}

function rowClock_(row, timezone) {
  return row.time;
}

function normalizeSheetCell_(col, value) {
  if (value instanceof Date) {
    var tz = REQUEST_SPREADSHEET_ ? REQUEST_SPREADSHEET_.getSpreadsheetTimeZone() : IRAN_TIMEZONE_;
    if (col === 'date') return Utilities.formatDate(value, tz, 'yyyy-MM-dd');
    if (col === 'time') return Utilities.formatDate(value, tz, 'HH:mm');
  }
  return String(value === null || value === undefined ? '' : value);
}

function getNotificationSettings_() {
  var props = PropertiesService.getScriptProperties();
  return {
    status: 200,
    payload: {
      ok: true,
      emailNotifications: props.getProperty(EMAIL_NOTIFICATIONS_PROPERTY_) === 'true',
      recipientEmail: props.getProperty(NOTIFICATION_PROPERTY_) || '',
      firebaseProjectId: props.getProperty(FIREBASE_PROJECT_PROPERTY_) || ''
    }
  };
}

function saveNotificationSettings_(input, owner) {
  var props = PropertiesService.getScriptProperties();
  if (input.emailNotifications !== undefined) {
    props.setProperty(EMAIL_NOTIFICATIONS_PROPERTY_, String(Boolean(input.emailNotifications)));
  }
  if (typeof input.recipientEmail === 'string') {
    setSalonNotificationEmail(input.recipientEmail);
  }
  audit_('admin.notification_settings_updated', owner.id, 'settings', 'notifications', input);
  return getNotificationSettings_();
}

function sendBookingNotifications_(booking, service) {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty(EMAIL_NOTIFICATIONS_PROPERTY_) !== 'true') return;

  var recipient = props.getProperty(NOTIFICATION_PROPERTY_);
  if (!recipient) return;

  try {
    MailApp.sendEmail({
      to: recipient,
      subject: 'نوبت جدید رزرو شد: ' + booking.name + ' (' + booking.date + ' ' + booking.time + ')',
      body: 'نوبت جدید در سامانه ثبت گردید:\n\n' +
            'نام مراجع: ' + booking.name + '\n' +
            'شماره تماس: ' + booking.phone + '\n' +
            'خدمت: ' + service.name + '\n' +
            'تاریخ و ساعت: ' + booking.date + ' ساعت ' + booking.time + '\n' +
            'کد رهگیری: ' + booking.reference + '\n'
    });
  } catch (error) {
    Logger.log('Error sending notification email: ' + String(error));
  }

  sendPushPayload_({
    title: 'نوبت جدید: ' + booking.name,
    body: service.name + ' - ' + booking.date + ' ' + booking.time
  });
}

function sendPushPayload_(notification) {
  var subs = readTable_('PushSubscriptions').filter(function (s) { return bool_(s.isActive); });
  if (!subs.length) return;
  var token = ScriptApp.getOAuthToken();
  var props = PropertiesService.getScriptProperties();
  var project = props.getProperty(FIREBASE_PROJECT_PROPERTY_);
  if (!project) return;

  subs.forEach(function (sub) {
    try {
      UrlFetchApp.fetch('https://fcm.googleapis.com/v1/projects/' + project + '/messages:send', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        payload: JSON.stringify({
          message: {
            token: sub.token,
            notification: { title: notification.title, body: notification.body }
          }
        }),
        muteHttpExceptions: true
      });
    } catch (ignored) {}
  });
}

function sendTestPush_(owner) {
  sendPushPayload_({ title: 'آزمایش اعلان آرایشگاه شایان', body: 'اتصال سیستم اعلان با موفقیت برقرار است.' });
  return { status: 200, payload: { ok: true }};
}

function savePushSubscription_(input, owner) {
  var token = String(input.token || '').trim();
  if (!token) return error_(400, 'invalid_token', 'توکن دستگاه الزامی است.');
  var existing = findBy_('PushSubscriptions', 'token', token);
  var record = {
    token: token,
    device: String(input.device || 'web'),
    isActive: 'true',
    createdAt: existing ? existing.createdAt : nowIso_(),
    updatedAt: nowIso_()
  };
  if (existing) updateRecord_('PushSubscriptions', 'token', token, record);
  else appendRecord_('PushSubscriptions', record);
  return { status: 200, payload: { ok: true }};
}

function removePushSubscription_(input, owner) {
  var token = String(input.token || '').trim();
  if (token) deleteRecord_('PushSubscriptions', 'token', token);
  return { status: 200, payload: { ok: true }};
}

function createUser_(username, password) {
  var salt = randomHex_();
  var passwordHash = hashPassword_(password, salt);
  var user = {
    id: uuid_(),
    username: username,
    salt: salt,
    passwordHash: passwordHash,
    isActive: 'true',
    createdAt: nowIso_()
  };
  appendRecord_('AdminUsers', user);
  return user;
}

function createSession_(user) {
  var sessionId = randomHex_() + randomHex_();
  var sessionHash = hashSessionId_(sessionId);
  var expiresAt = new Date(Date.now() + SESSION_TTL_ * 1000).toISOString();
  var session = {
    sessionIdHash: sessionHash,
    userId: user.id,
    username: user.username,
    expiresAt: expiresAt,
    createdAt: nowIso_()
  };
  appendRecord_('AdminSessions', session);
  try {
    CacheService.getScriptCache().put('sess_' + sessionHash, JSON.stringify(session), SESSION_CACHE_TTL_);
  } catch (ignored) {}
  return { sessionId: sessionId, session: session };
}

function authenticateOwner_(sessionId) {
  if (!sessionId) return null;
  var sessionHash = hashSessionId_(sessionId);
  var cache = CacheService.getScriptCache();
  var cached = cache.get('sess_' + sessionHash);
  var session = null;
  if (cached) {
    try { session = JSON.parse(cached); } catch (e) {}
  }
  if (!session) {
    session = findBy_('AdminSessions', 'sessionIdHash', sessionHash);
    if (session) {
      try { cache.put('sess_' + sessionHash, JSON.stringify(session), SESSION_CACHE_TTL_); } catch (e) {}
    }
  }
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    deleteRecord_('AdminSessions', 'sessionIdHash', sessionHash);
    try { cache.remove('sess_' + sessionHash); } catch (e) {}
    return null;
  }
  return { id: session.userId, username: session.username };
}

function audit_(action, actorId, entityType, entityId, details) {
  try {
    appendRecord_('AuditLog', {
      id: uuid_(),
      actorId: actorId || 'anonymous',
      action: action,
      entityType: entityType,
      entityId: String(entityId),
      detailsJson: JSON.stringify(details || {}),
      createdAt: nowIso_()
    });
  } catch (ignored) {}
}

function readTable_(name) {
  if (REQUEST_TABLE_CACHE_[name]) return REQUEST_TABLE_CACHE_[name];
  var sheet = getSheet_(name);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) {
    REQUEST_TABLE_CACHE_[name] = [];
    return [];
  }
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  var rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var data = rows.map(function (row) {
    var obj = {};
    headers.forEach(function (h, idx) { obj[h] = normalizeSheetCell_(h, row[idx]); });
    return obj;
  });
  REQUEST_TABLE_CACHE_[name] = data;
  return data;
}

function appendRecord_(table, record) {
  var sheet = getSheet_(table);
  var headers = TABLES_[table];
  var row = headers.map(function (h) { return record[h] !== undefined ? String(record[h]) : ''; });
  sheet.appendRow(row);
  delete REQUEST_TABLE_CACHE_[table];
}

function updateRecord_(table, keyName, keyValue, record) {
  var sheet = getSheet_(table);
  var headers = TABLES_[table];
  var colIdx = headers.indexOf(keyName) + 1;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var keys = sheet.getRange(2, colIdx, lastRow - 1, 1).getValues();
  for (var i = 0; i < keys.length; i += 1) {
    if (String(keys[i][0]) === String(keyValue)) {
      var row = headers.map(function (h) { return record[h] !== undefined ? String(record[h]) : ''; });
      sheet.getRange(i + 2, 1, 1, headers.length).setValues([row]);
      break;
    }
  }
  delete REQUEST_TABLE_CACHE_[table];
}

function deleteRecord_(table, keyName, keyValue) {
  var sheet = getSheet_(table);
  var headers = TABLES_[table];
  var colIdx = headers.indexOf(keyName) + 1;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var keys = sheet.getRange(2, colIdx, lastRow - 1, 1).getValues();
  for (var i = 0; i < keys.length; i += 1) {
    if (String(keys[i][0]) === String(keyValue)) {
      sheet.deleteRow(i + 2);
      break;
    }
  }
  delete REQUEST_TABLE_CACHE_[table];
}

function findBy_(table, key, value) {
  var rows = readTable_(table);
  for (var i = 0; i < rows.length; i += 1) {
    if (String(rows[i][key]) === String(value)) return rows[i];
  }
  return null;
}

function getSheet_(name) {
  if (!REQUEST_SPREADSHEET_) {
    var id = PropertiesService.getScriptProperties().getProperty(DB_PROPERTY_);
    if (!id) throw new Error('Database not initialized. Run setupSalonDatabase() first.');
    REQUEST_SPREADSHEET_ = SpreadsheetApp.openById(id);
  }
  var sheet = REQUEST_SPREADSHEET_.getSheetByName(name);
  if (!sheet) throw new Error('Sheet ' + name + ' not found in database.');
  return sheet;
}

function requireOwnerEditor_() {
  if (!Session.getEffectiveUser().getEmail()) {
    throw new Error('This function must be run by the project owner in the Apps Script editor.');
  }
}

function hashPassword_(password, salt) {
  return sha256_(salt + '|' + password);
}

function verifyPassword_(password, salt, hash) {
  return hashPassword_(password, salt) === hash;
}

function hashSessionId_(id) {
  return sha256_('session:' + id);
}

function sha256_(input) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(input), Utilities.Charset.UTF_8);
  return raw.map(function (b) { var v = (b < 0 ? b + 256 : b).toString(16); return v.length === 1 ? '0' + v : v; }).join('');
}

function uuid_() {
  return Utilities.getUuid();
}

function randomHex_() {
  return sha256_(uuid_() + Math.random() + Date.now()).slice(0, 32);
}

function generateReference_() {
  return 'SH-' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

function normalizePhone_(val) {
  var str = String(val || '').replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).replace(/[^\d+]/g, '');
  if (str.indexOf('+98') === 0) str = '0' + str.slice(3);
  return str;
}

function isValidPhone_(phone) {
  return /^09\d{9}$/.test(phone);
}

function bookingFullName_(input) {
  var f = String(input.firstName || '').trim();
  var l = String(input.lastName || '').trim();
  return (f + ' ' + l).replace(/\s+/g, ' ').trim();
}

function normalizeUsername_(u) {
  return String(u || '').trim().toLowerCase();
}

function isValidUsername_(u) {
  return /^[a-z0-9_-]{3,32}$/.test(u);
}

function bool_(v) {
  return v === true || v === 'true' || v === 1 || v === '1';
}

function nowIso_() {
  return new Date().toISOString();
}

function clientIp_(headers) {
  return headers['x-forwarded-for'] || headers['cf-connecting-ip'] || 'unknown';
}

function error_(status, code, message) {
  return { status: status, payload: { ok: false, error: code, message: message }};
}
