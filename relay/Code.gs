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
var APP_VERSION_ = '1.1.0';
var DB_PROPERTY_ = 'SALON_DB_ID';
var BOOTSTRAP_PROPERTY_ = 'ADMIN_BOOTSTRAP_TOKEN';
var NOTIFICATION_PROPERTY_ = 'NOTIFICATION_EMAIL';
var EMAIL_NOTIFICATIONS_PROPERTY_ = 'EMAIL_NOTIFICATIONS_ENABLED';
var FIREBASE_PROJECT_PROPERTY_ = 'FIREBASE_PROJECT_ID';
var SESSION_TTL_ = 21600; // Apps Script CacheService max TTL: 6 hours.

var TABLES_ = {
  Settings: ['key', 'value'],
  Services: ['id', 'name', 'description', 'durationMinutes', 'priceAmount', 'priceCurrency', 'isActive', 'sortOrder', 'createdAt', 'updatedAt', 'category'],
  WeeklyHours: ['weekday', 'isClosed', 'intervalsJson', 'configured'],
  Exceptions: ['id', 'date', 'isClosed', 'intervalsJson', 'note', 'createdAt'],
  Bookings: ['id', 'reference', 'serviceId', 'serviceName', 'durationMinutes', 'name', 'phone', 'date', 'time', 'startsAt', 'endsAt', 'status', 'note', 'manageTokenHash', 'idempotencyKeyHash', 'requestHash', 'createdAt', 'updatedAt', 'source'],
  PushSubscriptions: ['token', 'device', 'isActive', 'createdAt', 'updatedAt'],
  AdminUsers: ['id', 'username', 'salt', 'passwordHash', 'isActive', 'createdAt'],
  AdminSessions: ['sessionIdHash', 'userId', 'username', 'expiresAt', 'createdAt'],
  AuditLog: ['id', 'actorId', 'action', 'entityType', 'entityId', 'detailsJson', 'createdAt']
};

var DEFAULT_SETTINGS_ = {
  local_timezone: 'unset',
  slot_interval_minutes: '15',
  min_booking_notice_minutes: '120',
  booking_window_days: '30',
  buffer_minutes: '0'
};

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Bridge')
    .setTitle('Salon Booking API')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * One-time owner setup. Creates the private Sheets database and a one-time
 * bootstrap token. The token is written to the execution log, never to GitHub.
 */
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
      // Additive migration: append missing columns and preserve every existing row.
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

  // Trigger the mail permission prompt during owner setup, not on a customer booking.
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

/** Change the email destination from the Apps Script editor when needed. */
function setSalonNotificationEmail(email) {
  requireOwnerEditor_();
  var value = String(email || '').trim();
  if (value && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
    throw new Error('Enter a valid email address.');
  }
  PropertiesService.getScriptProperties().setProperty(NOTIFICATION_PROPERTY_, value);
  if (value) MailApp.getRemainingDailyQuota();
  Logger.log('Salon notification recipient: ' + (value || 'disabled'));
  return value;
}

/** Called by the hidden iframe through google.script.run. */
function proxyRequest(input) {
  var sessionId = '';
  try {
    if (!input || typeof input !== 'object') return result_(400, { ok: false, error: 'invalid_request', message: 'درخواست معتبر نیست.' });
    var path = String(input.path || '');
    var method = String(input.method || 'GET').toUpperCase();
    sessionId = String(input.sessionId || '');
    if (!/^\/api\/[A-Za-z0-9/_-]*(?:\?[^#]{0,1500})?$/.test(path) ||
        ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].indexOf(method) === -1 ||
        !/^[A-Za-z0-9-]{24,64}$/.test(sessionId)) {
      return result_(400, { ok: false, error: 'invalid_request', message: 'مسیر یا روش درخواست معتبر نیست.' });
    }
    var rawBody = input.body == null ? '' : String(input.body);
    if (rawBody.length > 8192) return result_(413, { ok: false, error: 'payload_too_large', message: 'حجم درخواست بیش از حد مجاز است.' });
    var headers = normalizeHeaders_(input.headers || {});
    var queryAt = path.indexOf('?');
    var pathname = queryAt < 0 ? path : path.slice(0, queryAt);
    var query = parseQuery_(queryAt < 0 ? '' : path.slice(queryAt + 1));
    var body = rawBody ? parseJson_(rawBody) : {};
    if (rawBody && (!body || typeof body !== 'object' || Array.isArray(body))) {
      return result_(400, { ok: false, error: 'invalid_request', message: 'ساختار اطلاعات ارسالی معتبر نیست.' });
    }
    var response = dispatch_(pathname, method, query, headers, body || {}, sessionId);
    return result_(response.status || 200, response.payload || {});
  } catch (error) {
    Logger.log('API request failed: ' + String(error && error.message || error));
    return result_(503, { ok: false, error: 'service_unavailable', message: 'سامانه رزرو در حال حاضر در دسترس نیست. کمی بعد دوباره تلاش کنید.' }, sessionId);
  }
}

function dispatch_(path, method, query, headers, body, sessionId) {
  if (path === '/api/health' && method === 'GET') return { status: 200, payload: { ok: true, service: 'salon-booking-apps-script', version: APP_VERSION_ } };

  if (path === '/api/public/config' && method === 'GET') {
    var settings = getSettings_();
    return { status: 200, payload: {
      ok: true,
      configured: settings.timezone !== 'unset',
      timezone: settings.timezone === 'unset' ? null : settings.timezone,
      bookingWindowDays: settings.bookingWindowDays,
      slotIntervalMinutes: settings.slotIntervalMinutes
    }};
  }

  if (path === '/api/public/services' && method === 'GET') {
    var publicServices = readTable_('Services').filter(function (row) { return bool_(row.isActive); });
    publicServices.sort(serviceSort_);
    return { status: 200, payload: { ok: true, services: publicServices.map(servicePayload_) } };
  }

  if (path === '/api/public/availability' && method === 'GET') {
    if (!rateLimit_(sessionId, 'availability', 180, 900)) return rateLimited_();
    var requestedDate = query.get('date') || '';
    var serviceId = query.get('serviceId') || '';
    if (!parseDateKey_(requestedDate)) return error_(400, 'invalid_date', 'تاریخ واردشده معتبر نیست.');
    var service = findBy_('Services', 'id', serviceId);
    if (!service || !bool_(service.isActive)) return error_(404, 'service_not_found', 'این خدمت در دسترس نیست.');
    var publicSettings = getSettings_();
    if (publicSettings.timezone === 'unset') return error_(503, 'schedule_not_configured', 'برنامه کاری استودیو هنوز تنظیم نشده است.');
    try {
      return { status: 200, payload: Object.assign({ ok: true }, getAvailability_(requestedDate, service, publicSettings)) };
    } catch (availabilityError) {
      if (String(availabilityError.message) === 'date_out_of_range') return error_(400, 'date_out_of_range', 'این تاریخ خارج از بازه رزرو است.');
      throw availabilityError;
    }
  }

  if (path === '/api/public/bookings' && method === 'POST') {
    if (!rateLimit_(sessionId, 'booking', 10, 900)) return rateLimited_();
    return createBooking_(body, headers, sessionId);
  }

  if (path === '/api/public/bookings/lookup' && method === 'POST') {
    if (!rateLimit_(sessionId, 'booking_manage', 20, 900)) return rateLimited_();
    return manageCustomerBooking_(body, false);
  }

  if (path === '/api/public/bookings/cancel' && method === 'POST') {
    if (!rateLimit_(sessionId, 'booking_manage', 20, 900)) return rateLimited_();
    return manageCustomerBooking_(body, true);
  }

  if (path.indexOf('/api/admin/') === 0) return dispatchAdmin_(path, method, query, headers, body, sessionId);
  return error_(404, 'not_found', 'این مسیر پیدا نشد.');
}

function dispatchAdmin_(path, method, query, headers, body, sessionId) {
  var users = readTable_('AdminUsers').filter(function (user) { return bool_(user.isActive); });
  var initialized = users.length > 0;

  if (path === '/api/admin/setup-status' && method === 'GET') {
    return { status: 200, payload: {
      ok: true,
      initialized: initialized,
      bootstrapAvailable: !initialized && Boolean(PropertiesService.getScriptProperties().getProperty(BOOTSTRAP_PROPERTY_))
    }};
  }

  if (path === '/api/admin/bootstrap' && method === 'POST') {
    if (!rateLimit_(sessionId, 'bootstrap', 5, 900)) return rateLimited_();
    var props = PropertiesService.getScriptProperties();
    var expected = props.getProperty(BOOTSTRAP_PROPERTY_) || '';
    var supplied = headers['x-admin-bootstrap-token'] || '';
    if (!expected || !constantTimeEqual_(expected, supplied)) return error_(401, 'invalid_bootstrap_token', 'کلید راه‌اندازی معتبر نیست.');
    if (initialized) return error_(409, 'already_initialized', 'حساب مدیر قبلاً ساخته شده است؛ از صفحه ورود استفاده کنید.');
    var username = String(body.username || '').trim();
    var password = String(body.password || '');
    if (!/^[\p{L}\p{N}_.-]{3,32}$/u.test(username)) return error_(400, 'invalid_username', 'نام کاربری باید ۳ تا ۳۲ نویسه و بدون فاصله باشد.');
    if (password.length < 12 || password.length > 128) return error_(400, 'weak_password', 'گذرواژه باید حداقل ۱۲ و حداکثر ۱۲۸ نویسه باشد.');
    var salt = randomHex_().slice(0, 32);
    var admin = { id: uuid_(), username: username, salt: salt, passwordHash: passwordHash_(password, salt), isActive: 'true', createdAt: nowIso_() };
    appendRecord_('AdminUsers', admin);
    props.deleteProperty(BOOTSTRAP_PROPERTY_);
    setSession_(sessionId, admin);
    audit_('owner.bootstrap', admin.id, 'admin', admin.id, { username: username });
    return { status: 200, payload: { ok: true, user: { id: admin.id, username: admin.username }, expiresAt: new Date(Date.now() + SESSION_TTL_ * 1000).toISOString() }};
  }

  if (path === '/api/admin/login' && method === 'POST') {
    if (!rateLimit_(sessionId, 'login', 8, 900)) return rateLimited_();
    var loginName = String(body.username || '').trim();
    var loginPassword = String(body.password || '').slice(0, 128);
    var account = users.filter(function (user) { return user.username === loginName; })[0];
    if (!account || !constantTimeEqual_(passwordHash_(loginPassword, account.salt), String(account.passwordHash || ''))) {
      return error_(401, 'invalid_credentials', 'نام کاربری یا گذرواژه اشتباه است.');
    }
    setSession_(sessionId, account);
    return { status: 200, payload: { ok: true, user: { id: account.id, username: account.username }, expiresAt: new Date(Date.now() + SESSION_TTL_ * 1000).toISOString() }};
  }

  if (path === '/api/admin/logout' && method === 'POST') {
    revokeSession_(sessionId);
    return { status: 200, payload: { ok: true } };
  }

  var owner = getSession_(sessionId);
  if (!owner) {
    if (path === '/api/admin/me' && method === 'GET') return error_(401, 'unauthorized', 'برای ادامه وارد پنل مدیریت شوید.');
    if (path === '/api/admin/setup-status') return error_(405, 'method_not_allowed', 'روش درخواست پشتیبانی نمی‌شود.');
    return error_(401, 'unauthorized', 'برای ادامه وارد پنل مدیریت شوید.');
  }

  if (path === '/api/admin/me' && method === 'GET') {
    return { status: 200, payload: { ok: true, user: { id: owner.id, username: owner.username } }};
  }
  if (path === '/api/admin/bookings' && method === 'GET') return getAdminBookings_(query, owner);
  if (path === '/api/admin/availability' && method === 'GET') return getAdminAvailability_(query);
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

function createBooking_(input, headers, sessionId) {
  var key = String(headers['idempotency-key'] || '').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(key)) return error_(400, 'idempotency_key_required', 'کلید یکتای ثبت نوبت معتبر نیست؛ دوباره تلاش کنید.');

  var serviceId = String(input.serviceId || '').trim();
  var date = String(input.date || '');
  var time = String(input.time || '');
  var name = bookingFullName_(input);
  var phone = normalizePhone_(input.phone);
  var note = typeof input.note === 'string' ? input.note.trim().slice(0, 500) : '';
  if (!serviceId || serviceId.length > 80) return error_(400, 'invalid_service', 'خدمت انتخاب‌شده معتبر نیست.');
  if (!parseDateKey_(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return error_(400, 'invalid_datetime', 'تاریخ یا ساعت معتبر نیست.');
  if (name.length < 2 || name.length > 80) return error_(400, 'invalid_name', 'نام باید بین ۲ تا ۸۰ نویسه باشد.');
  if (!phone) return error_(400, 'invalid_phone', 'شماره تماس معتبر نیست.');
  if (typeof input.note === 'string' && input.note.length > 1000) return error_(400, 'invalid_note', 'متن توضیحات بیش از حد طولانی است.');

  var fingerprint = JSON.stringify({ serviceId: serviceId, date: date, time: time, name: name, phone: phone, note: note });
  var keyHash = sha256_('salon-booking-idempotency:' + key);
  var requestHash = sha256_('salon-booking-request:' + key + ':' + fingerprint);
  var previous = readTable_('Bookings').filter(function (row) { return row.idempotencyKeyHash === keyHash; })[0];
  if (previous) {
    if (previous.requestHash !== requestHash) return error_(409, 'idempotency_key_reused', 'کلید ثبت قبلاً برای اطلاعات دیگری استفاده شده است.');
    return { status: 200, payload: { ok: true, replayed: true, booking: {
      reference: previous.reference,
      status: previous.status,
      serviceName: previous.serviceName,
      date: previous.date,
      time: previous.time,
      durationMinutes: Number(previous.durationMinutes),
      managementToken: sha256_('salon-booking-management-token:' + key)
    }}};
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return error_(503, 'booking_busy', 'سامانه مشغول ثبت رزرو دیگری است؛ دوباره تلاش کنید.');
  var created;
  try {
    // Recheck idempotency and availability after acquiring the lock.
    previous = readTable_('Bookings').filter(function (row) { return row.idempotencyKeyHash === keyHash; })[0];
    if (previous) {
      if (previous.requestHash !== requestHash) return error_(409, 'idempotency_key_reused', 'کلید ثبت قبلاً برای اطلاعات دیگری استفاده شده است.');
      return { status: 200, payload: { ok: true, replayed: true, booking: {
        reference: previous.reference, status: previous.status, serviceName: previous.serviceName,
        date: previous.date, time: previous.time, durationMinutes: Number(previous.durationMinutes),
        managementToken: sha256_('salon-booking-management-token:' + key)
      }}};
    }
    var service = findBy_('Services', 'id', serviceId);
    if (!service || !bool_(service.isActive)) return error_(404, 'service_not_found', 'این خدمت در دسترس نیست.');
    var settings = getSettings_();
    if (settings.timezone === 'unset') return error_(503, 'schedule_not_configured', 'برنامه کاری استودیو هنوز تنظیم نشده است.');
    var availability = getAvailability_(date, service, settings);
    if (availability.slots.indexOf(time) === -1) return error_(409, 'slot_unavailable', 'این زمان دیگر آزاد نیست؛ لطفاً ساعت دیگری انتخاب کنید.');

    var start = localDateTimeToUtc_(date, time, settings.timezone);
    var duration = Number(service.durationMinutes) + settings.bufferMinutes;
    var end = new Date(start.getTime() + duration * 60000);
    var token = sha256_('salon-booking-management-token:' + key);
    created = {
      id: uuid_(), reference: makeReference_(), serviceId: serviceId, serviceName: String(service.name),
      durationMinutes: String(Number(service.durationMinutes)), name: name, phone: phone, date: date,
      time: time, startsAt: start.toISOString(), endsAt: end.toISOString(), status: 'pending',
      note: note, manageTokenHash: sha256_(token), idempotencyKeyHash: keyHash, requestHash: requestHash, source: 'online',
      createdAt: nowIso_(), updatedAt: nowIso_()
    };
    appendRecord_('Bookings', created);
    audit_('booking.created', 'public', 'booking', created.id, { reference: created.reference, serviceName: created.serviceName, date: date, time: time });
  } finally {
    lock.releaseLock();
  }

  sendBookingNotifications_(created);
  return { status: 201, payload: { ok: true, booking: {
    reference: created.reference,
    status: 'pending',
    serviceName: created.serviceName,
    date: created.date,
    time: created.time,
    durationMinutes: Number(created.durationMinutes),
    managementToken: sha256_('salon-booking-management-token:' + key)
  }}};
}

function getAdminAvailability_(query) {
  var date = query.get('date') || '';
  var serviceId = query.get('serviceId') || '';
  if (!parseDateKey_(date)) return error_(400, 'invalid_date', 'تاریخ واردشده معتبر نیست.');
  var service = findBy_('Services', 'id', serviceId);
  if (!service || !bool_(service.isActive)) return error_(404, 'service_not_found', 'این خدمت در دسترس نیست.');
  var settings = getSettings_();
  if (settings.timezone === 'unset') return error_(503, 'schedule_not_configured', 'برنامه کاری استودیو هنوز تنظیم نشده است.');
  try {
    var availability = getAvailability_(date, service, settings, true);
    return { status: 200, payload: { ok: true, date: date, timezone: settings.timezone, slots: availability.slots } };
  } catch (availabilityError) {
    if (String(availabilityError.message) === 'date_out_of_range') return error_(400, 'date_out_of_range', 'این تاریخ خارج از بازه رزرو است.');
    throw availabilityError;
  }
}

/** A phone reservation is confirmed at creation and shares the online booking lock. */
function createManualBooking_(input, owner) {
  var serviceId = String(input.serviceId || '').trim();
  var date = String(input.date || '');
  var time = String(input.time || '');
  var name = bookingFullName_(input);
  var phone = normalizePhone_(input.phone);
  var note = typeof input.note === 'string' ? input.note.trim().slice(0, 500) : '';
  if (!serviceId || serviceId.length > 80) return error_(400, 'invalid_service', 'خدمت انتخاب‌شده معتبر نیست.');
  if (!parseDateKey_(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return error_(400, 'invalid_datetime', 'تاریخ یا ساعت معتبر نیست.');
  if (!String(input.firstName || '').trim() || !String(input.lastName || '').trim() || name.length < 3 || name.length > 161) return error_(400, 'invalid_name', 'نام و نام خانوادگی را جداگانه وارد کنید.');
  if (!phone) return error_(400, 'invalid_phone', 'شماره تماس معتبر نیست.');
  if (typeof input.note === 'string' && input.note.length > 1000) return error_(400, 'invalid_note', 'متن توضیحات بیش از حد طولانی است.');

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return error_(503, 'booking_busy', 'سامانه مشغول ثبت رزرو دیگری است؛ دوباره تلاش کنید.');
  var created;
  try {
    var service = findBy_('Services', 'id', serviceId);
    if (!service || !bool_(service.isActive)) return error_(404, 'service_not_found', 'این خدمت دیگر فعال نیست.');
    var settings = getSettings_();
    if (settings.timezone === 'unset') return error_(503, 'schedule_not_configured', 'برنامه کاری استودیو هنوز تنظیم نشده است.');
    var availability;
    try { availability = getAvailability_(date, service, settings, true); }
    catch (availabilityError) {
      if (String(availabilityError.message) === 'date_out_of_range') return error_(400, 'date_out_of_range', 'تاریخ رزرو باید از امروز تا پایان بازه مجاز باشد.');
      throw availabilityError;
    }
    if (availability.slots.indexOf(time) === -1) return error_(409, 'slot_unavailable', 'این ساعت در برنامه کاری آزاد نیست یا با نوبت دیگری تداخل دارد.');
    var start = localDateTimeToUtc_(date, time, settings.timezone);
    var duration = Number(service.durationMinutes) + settings.bufferMinutes;
    var end = new Date(start.getTime() + duration * 60000);
    var reference = makeReference_();
    for (var attempt = 0; attempt < 4 && findBy_('Bookings', 'reference', reference); attempt += 1) reference = makeReference_();
    created = {
      id: uuid_(), reference: reference, serviceId: serviceId, serviceName: String(service.name),
      durationMinutes: String(Number(service.durationMinutes)), name: name, phone: phone,
      date: date, time: time, startsAt: start.toISOString(), endsAt: end.toISOString(),
      status: 'confirmed', note: note, manageTokenHash: '', idempotencyKeyHash: '',
      requestHash: '', createdAt: nowIso_(), updatedAt: nowIso_(), source: 'phone'
    };
    appendRecord_('Bookings', created);
    audit_('booking.created_by_owner_phone', owner.id, 'booking', created.id, {
      reference: created.reference, serviceName: created.serviceName, date: date, time: time
    });
  } finally { lock.releaseLock(); }
  sendBookingNotifications_(created);
  return { status: 201, payload: { ok: true, booking: {
    id: created.id, reference: created.reference, status: created.status,
    serviceName: created.serviceName, date: created.date, time: created.time,
    durationMinutes: Number(created.durationMinutes), source: 'phone'
  }}};
}

function manageCustomerBooking_(input, cancel) {
  var reference = String(input.reference || '').trim().toUpperCase();
  var token = String(input.managementToken || '').trim().toLowerCase();
  if (!/^SB-[A-HJ-NP-Z2-9]{7}$/.test(reference) || !/^[a-f0-9]{64}$/.test(token)) {
    return error_(404, 'booking_access_invalid', 'کد پیگیری یا کلید محرمانه معتبر نیست.');
  }
  var row = findBy_('Bookings', 'reference', reference);
  if (!row || !row.manageTokenHash || !constantTimeEqual_(sha256_(token), String(row.manageTokenHash))) {
    return error_(404, 'booking_access_invalid', 'کد پیگیری یا کلید محرمانه معتبر نیست.');
  }
  var settings = getSettings_();
  if (settings.timezone === 'unset') return error_(503, 'schedule_not_configured', 'منطقه زمانی استودیو هنوز تنظیم نشده است.');
  if (cancel) {
    if (row.status === 'cancelled') return { status: 200, payload: { ok: true, alreadyCancelled: true, booking: managedPayload_(row, settings.timezone) }};
    if (['pending', 'confirmed'].indexOf(row.status) === -1 || Date.parse(row.startsAt) <= Date.now()) {
      return error_(409, 'booking_not_cancellable', 'این نوبت دیگر از طریق سامانه قابل لغو نیست.');
    }
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(15000)) return error_(503, 'booking_busy', 'سامانه مشغول پردازش است؛ دوباره تلاش کنید.');
    try {
      row.status = 'cancelled';
      row.updatedAt = nowIso_();
      updateRecord_('Bookings', 'id', row.id, row);
      audit_('booking.cancelled_by_customer', 'customer', 'booking', row.id, { reference: row.reference });
    } finally { lock.releaseLock(); }
    return { status: 200, payload: { ok: true, booking: managedPayload_(row, settings.timezone) }};
  }
  return { status: 200, payload: { ok: true, booking: managedPayload_(row, settings.timezone) }};
}

function managedPayload_(row, timezone) {
  var local = getZonedParts_(new Date(row.startsAt), timezone);
  return {
    reference: row.reference,
    status: row.status,
    serviceName: row.serviceName,
    date: local.year + '-' + pad2_(local.month) + '-' + pad2_(local.day),
    time: pad2_(local.hour) + ':' + pad2_(local.minute),
    durationMinutes: Number(row.durationMinutes),
    cancellable: ['pending', 'confirmed'].indexOf(row.status) !== -1 && Date.parse(row.startsAt) > Date.now()
  };
}

function getAdminBookings_(query, owner) {
  var settings = getSettings_();
  if (settings.timezone === 'unset') return error_(503, 'schedule_not_configured', 'منطقه زمانی استودیو هنوز تنظیم نشده است.');
  var today = getLocalDateKey_(new Date(), settings.timezone);
  var from = query.get('from') || today;
  var to = query.get('to') || addDays_(today, 6);
  if (!parseDateKey_(from) || !parseDateKey_(to)) return error_(400, 'invalid_date_range', 'بازه تاریخ معتبر نیست.');
  var span = (Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000;
  if (span < 0 || span > 31) return error_(400, 'invalid_date_range', 'بازه نمایش نمی‌تواند بیشتر از ۳۱ روز باشد.');
  var endDate = addDays_(to, 1);
  var start = localDateTimeToUtc_(from, '00:00', settings.timezone);
  var end = localDateTimeToUtc_(endDate, '00:00', settings.timezone);
  if (!start || !end) return error_(400, 'invalid_date_range', 'بازه تاریخ معتبر نیست.');
  var status = query.get('status') || 'all';
  var allowed = ['all', 'pending', 'confirmed', 'cancelled', 'completed', 'no_show'];
  if (allowed.indexOf(status) === -1) return error_(400, 'invalid_status', 'فیلتر وضعیت معتبر نیست.');
  var rows = readTable_('Bookings').filter(function (row) {
    return Date.parse(row.startsAt) >= start.getTime() && Date.parse(row.startsAt) < end.getTime() &&
      (status === 'all' || row.status === status);
  });
  rows.sort(function (a, b) { return Date.parse(a.startsAt) - Date.parse(b.startsAt); });
  return { status: 200, payload: { ok: true, timezone: settings.timezone, from: from, to: to, bookings: rows.map(function (row) {
    return {
      id: row.id, reference: row.reference, name: row.name, phone: row.phone,
      startsAt: row.startsAt, endsAt: row.endsAt, status: row.status, note: row.note,
      service: row.serviceName, durationMinutes: Number(row.durationMinutes), source: row.source || 'online'
    };
  }) }};
}

function updateBookingStatus_(id, input, owner) {
  var allowed = ['confirmed', 'cancelled', 'completed', 'no_show'];
  var next = String(input.status || '');
  if (allowed.indexOf(next) === -1) return error_(400, 'invalid_status', 'وضعیت انتخاب‌شده معتبر نیست.');
  var row = findBy_('Bookings', 'id', id);
  if (!row) return error_(404, 'booking_not_found', 'نوبت پیدا نشد.');
  var transitions = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['cancelled', 'completed', 'no_show']
  };
  if ((transitions[row.status] || []).indexOf(next) === -1) {
    if (row.status === next) return { status: 200, payload: { ok: true, unchanged: true }};
    return error_(409, 'invalid_status_transition', 'تغییر وضعیت این نوبت مجاز نیست.');
  }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return error_(503, 'booking_busy', 'سامانه مشغول پردازش است؛ دوباره تلاش کنید.');
  try {
    var previous = row.status;
    row.status = next;
    row.updatedAt = nowIso_();
    updateRecord_('Bookings', 'id', row.id, row);
    audit_('booking.status_changed', owner.id, 'booking', row.id, { previousStatus: previous, status: next });
  } finally { lock.releaseLock(); }
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
    id: row.id, name: row.name, description: row.description, category: row.category || 'عمومی',
    durationMinutes: Number(row.durationMinutes), priceAmount: Number(row.priceAmount),
    priceCurrency: row.priceCurrency, isActive: bool_(row.isActive), sortOrder: Number(row.sortOrder)
  };
}

function getAdminSchedule_() {
  var settings = getSettings_();
  var weeklyRows = readTable_('WeeklyHours');
  var names = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
  var weekOrder = [6, 0, 1, 2, 3, 4, 5];
  var weekly = weekOrder.map(function (day) {
    var row = weeklyRows.filter(function (item) { return Number(item.weekday) === day; })[0];
    var intervals = row ? parseJson_(row.intervalsJson || '[]') || [] : [];
    return {
      weekday: day, name: names[day],
      intervals: bool_(row && row.isClosed) ? [] : intervals,
      isClosed: row ? bool_(row.isClosed) : true,
      configured: Boolean(row && bool_(row.configured))
    };
  });
  var exceptions = readTable_('Exceptions').sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); }).map(function (row) {
    var intervals = parseJson_(row.intervalsJson || '[]') || [];
    return {
      id: row.id, date: row.date, startsAt: intervals[0] ? intervals[0].startsAt : null,
      endsAt: intervals[0] ? intervals[0].endsAt : null,
      intervals: bool_(row.isClosed) ? [] : intervals,
      isClosed: bool_(row.isClosed), note: row.note || ''
    };
  });
  return { status: 200, payload: { ok: true, settings: settings, weeklyHours: weekly, exceptions: exceptions }};
}

function saveSettings_(input, owner) {
  var current = getSettings_();
  var timezone = input.timezone === undefined ? current.timezone : input.timezone;
  var interval = input.slotIntervalMinutes === undefined ? current.slotIntervalMinutes : Number(input.slotIntervalMinutes);
  var notice = input.minBookingNoticeMinutes === undefined ? current.minBookingNoticeMinutes : Number(input.minBookingNoticeMinutes);
  var horizon = input.bookingWindowDays === undefined ? current.bookingWindowDays : Number(input.bookingWindowDays);
  var buffer = input.bufferMinutes === undefined ? current.bufferMinutes : Number(input.bufferMinutes);
  if (typeof timezone !== 'string' || (timezone !== 'unset' && !validTimezone_(timezone))) return error_(400, 'invalid_timezone', 'منطقه زمانی باید یک شناسه معتبر مانند Asia/Tehran باشد.');
  if (!Number.isInteger(interval) || interval < 5 || interval > 120) return error_(400, 'invalid_slot_interval', 'فاصله زمانی نوبت‌ها باید بین ۵ تا ۱۲۰ دقیقه باشد.');
  if (!Number.isInteger(notice) || notice < 0 || notice > 10080) return error_(400, 'invalid_notice', 'حداقل فاصله رزرو باید بین صفر تا ۷ روز باشد.');
  if (!Number.isInteger(horizon) || horizon < 1 || horizon > 365) return error_(400, 'invalid_horizon', 'بازه رزرو باید بین ۱ تا ۳۶۵ روز باشد.');
  if (!Number.isInteger(buffer) || buffer < 0 || buffer > 240) return error_(400, 'invalid_buffer', 'زمان فاصله بین نوبت‌ها باید بین صفر تا ۲۴۰ دقیقه باشد.');
  if (timezone !== current.timezone && readTable_('Bookings').some(function (row) {
    return ['pending', 'confirmed'].indexOf(row.status) !== -1 && Date.parse(row.startsAt) >= Date.now();
  })) return error_(409, 'timezone_has_bookings', 'تا زمانی که نوبت فعال آینده وجود دارد، تغییر منطقه زمانی مجاز نیست.');
  var values = {
    local_timezone: timezone, slot_interval_minutes: String(interval),
    min_booking_notice_minutes: String(notice), booking_window_days: String(horizon),
    buffer_minutes: String(buffer)
  };
  Object.keys(values).forEach(function (key) { saveSetting_(key, values[key]); });
  audit_('salon.settings_updated', owner.id, 'salon', 'settings', values);
  return { status: 200, payload: { ok: true, settings: getSettings_() }};
}

function saveWeeklyHours_(weekday, input, owner) {
  if (typeof input.isClosed !== 'boolean') return error_(400, 'invalid_request', 'وضعیت روز کاری معتبر نیست.');
  var intervals = input.isClosed ? [] : normalizeIntervals_(input.intervals || [
    { startsAt: input.opensAt, endsAt: input.closesAt }
  ]);
  if (!input.isClosed && (!intervals || !intervals.length)) return error_(400, 'invalid_hours', 'بازه‌های کاری معتبر نیستند؛ حداکثر ۸ بازه بدون هم‌پوشانی ثبت کنید.');
  if (input.isClosed) intervals = [];
  var settings = getSettings_();
  if (settings.timezone === 'unset') return error_(409, 'schedule_not_configured', 'ابتدا منطقه زمانی استودیو را در تنظیمات ذخیره کنید.');
  if (hasWeeklyConflict_(weekday, intervals, settings.timezone)) return error_(409, 'hours_conflict', 'این تغییر با نوبت‌های فعال آینده تداخل دارد؛ ابتدا نوبت‌های مربوط را مدیریت کنید.');
  var existing = findBy_('WeeklyHours', 'weekday', String(weekday));
  var record = { weekday: String(weekday), isClosed: String(input.isClosed), intervalsJson: JSON.stringify(intervals), configured: 'true' };
  if (existing) updateRecord_('WeeklyHours', 'weekday', String(weekday), record);
  else appendRecord_('WeeklyHours', record);
  audit_('schedule.weekday_updated', owner.id, 'opening_hours', String(weekday), { isClosed: input.isClosed, intervals: intervals });
  return { status: 200, payload: { ok: true }};
}

function saveException_(input, owner) {
  var date = String(input.date || '');
  if (!parseDateKey_(date) || typeof input.isClosed !== 'boolean') return error_(400, 'invalid_exception', 'تاریخ یا نوع تعطیلی معتبر نیست.');
  var settings = getSettings_();
  if (settings.timezone === 'unset') return error_(409, 'schedule_not_configured', 'ابتدا منطقه زمانی را تنظیم کنید.');
  var today = getLocalDateKey_(new Date(), settings.timezone);
  if (date < today || date > addDays_(today, 365)) return error_(400, 'date_out_of_range', 'تاریخ استثنا باید از امروز تا یک سال آینده باشد.');
  var intervals = input.isClosed ? [] : normalizeIntervals_(input.intervals || [{ startsAt: input.startsAt, endsAt: input.endsAt }]);
  if (!input.isClosed && (!intervals || !intervals.length)) return error_(400, 'invalid_exception_hours', 'بازه‌های ساعت استثنا معتبر نیستند؛ حداکثر ۸ بازه بدون هم‌پوشانی ثبت کنید.');
  if (input.isClosed) intervals = [];
  var note = typeof input.note === 'string' ? input.note.trim() : '';
  if (note.length > 160) return error_(400, 'invalid_note', 'توضیحات حداکثر ۱۶۰ نویسه است.');
  if (hasExceptionConflict_(date, intervals, settings.timezone)) return error_(409, 'exception_has_bookings', 'این تغییر با نوبت‌های فعال این روز تداخل دارد.');
  var existing = findBy_('Exceptions', 'date', date);
  var record = { id: existing ? existing.id : uuid_(), date: date, isClosed: String(input.isClosed), intervalsJson: JSON.stringify(intervals), note: note, createdAt: existing ? existing.createdAt : nowIso_() };
  if (existing) updateRecord_('Exceptions', 'date', date, record);
  else appendRecord_('Exceptions', record);
  audit_('schedule.exception_saved', owner.id, 'schedule_exception', date, { date: date, isClosed: input.isClosed, intervals: intervals, note: note });
  return { status: 200, payload: { ok: true, date: date }};
}

function deleteException_(id, owner) {
  var exception = findBy_('Exceptions', 'id', id);
  if (!exception) return error_(404, 'exception_not_found', 'استثنای برنامه پیدا نشد.');
  var settings = getSettings_();
  if (settings.timezone === 'unset') return error_(409, 'schedule_not_configured', 'منطقه زمانی تنظیم نشده است.');
  if (activeBookingsOnDate_(exception.date, settings.timezone).length) return error_(409, 'exception_has_bookings', 'تا زمانی که برای این تاریخ نوبت فعال وجود دارد، حذف استثنا مجاز نیست.');
  deleteRecord_('Exceptions', 'id', id);
  audit_('schedule.exception_deleted', owner.id, 'schedule_exception', exception.date, {});
  return { status: 200, payload: { ok: true }};
}

function hasWeeklyConflict_(weekday, intervals, timezone) {
  return readTable_('Bookings').some(function (booking) {
    if (['pending', 'confirmed'].indexOf(booking.status) === -1 || Date.parse(booking.startsAt) < Date.now()) return false;
    var local = getZonedParts_(new Date(booking.startsAt), timezone);
    if (new Date(Date.UTC(local.year, local.month - 1, local.day)).getUTCDay() !== weekday) return false;
    return !fitsIntervals_(booking, intervals, timezone);
  });
}
function hasExceptionConflict_(date, intervals, timezone) {
  return activeBookingsOnDate_(date, timezone).some(function (booking) {
    return !fitsIntervals_(booking, intervals, timezone);
  });
}
function fitsIntervals_(booking, intervals, timezone) {
  if (!intervals.length) return false;
  var start = getZonedParts_(new Date(booking.startsAt), timezone);
  var end = getZonedParts_(new Date(booking.endsAt), timezone);
  var startClock = pad2_(start.hour) + ':' + pad2_(start.minute);
  var endClock = pad2_(end.hour) + ':' + pad2_(end.minute);
  return intervals.some(function (interval) { return startClock >= interval.startsAt && endClock <= interval.endsAt; });
}
function activeBookingsOnDate_(date, timezone) {
  var start = localDateTimeToUtc_(date, '00:00', timezone);
  var end = localDateTimeToUtc_(addDays_(date, 1), '00:00', timezone);
  if (!start || !end) return [];
  return readTable_('Bookings').filter(function (row) {
    return ['pending', 'confirmed'].indexOf(row.status) !== -1 &&
      Date.parse(row.startsAt) < end.getTime() && Date.parse(row.endsAt) > start.getTime();
  });
}

function getAvailability_(dateKey, service, settings, ignoreNotice) {
  var date = parseDateKey_(dateKey);
  if (!date) throw new Error('invalid_date');
  if (settings.timezone === 'unset') throw new Error('schedule_not_configured');
  var today = getLocalDateKey_(new Date(), settings.timezone);
  var deltaDays = (Date.parse(dateKey + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000;
  if (deltaDays < 0 || deltaDays > settings.bookingWindowDays) throw new Error('date_out_of_range');
  var windows = scheduleWindows_(dateKey);
  if (!windows.length) return { date: dateKey, timezone: settings.timezone, slots: [] };
  var dayStart = localDateTimeToUtc_(dateKey, '00:00', settings.timezone);
  var nextDay = localDateTimeToUtc_(addDays_(dateKey, 1), '00:00', settings.timezone);
  if (!dayStart || !nextDay) throw new Error('invalid_salon_timezone');
  var busy = readTable_('Bookings').filter(function (row) {
    return ['pending', 'confirmed'].indexOf(row.status) !== -1 &&
      Date.parse(row.startsAt) < nextDay.getTime() && Date.parse(row.endsAt) > dayStart.getTime();
  }).map(function (row) { return { start: Date.parse(row.startsAt), end: Date.parse(row.endsAt) }; });
  var duration = Number(service.durationMinutes) + settings.bufferMinutes;
  var earliest = Date.now() + (ignoreNotice ? 0 : settings.minBookingNoticeMinutes * 60000);
  var slots = {};
  windows.forEach(function (window) {
    var open = Number(window.startsAt.slice(0, 2)) * 60 + Number(window.startsAt.slice(3, 5));
    var close = Number(window.endsAt.slice(0, 2)) * 60 + Number(window.endsAt.slice(3, 5));
    for (var minute = open; minute < close; minute += settings.slotIntervalMinutes) {
      var time = pad2_(Math.floor(minute / 60)) + ':' + pad2_(minute % 60);
      var start = localDateTimeToUtc_(dateKey, time, settings.timezone);
      if (!start || start.getTime() < earliest) continue;
      var end = new Date(start.getTime() + duration * 60000);
      var localEnd = getZonedParts_(end, settings.timezone);
      var endDate = localEnd.year + '-' + pad2_(localEnd.month) + '-' + pad2_(localEnd.day);
      var endMinute = localEnd.hour * 60 + localEnd.minute;
      if (endDate !== dateKey || endMinute > close) continue;
      var overlaps = busy.some(function (item) { return start.getTime() < item.end && end.getTime() > item.start; });
      if (!overlaps) slots[time] = true;
    }
  });
  return { date: dateKey, timezone: settings.timezone, slots: Object.keys(slots).sort() };
}
function scheduleWindows_(dateKey) {
  var exception = findBy_('Exceptions', 'date', dateKey);
  if (exception) return bool_(exception.isClosed) ? [] : (parseJson_(exception.intervalsJson || '[]') || []);
  var weekday = new Date(Date.parse(dateKey + 'T00:00:00Z')).getUTCDay();
  var row = findBy_('WeeklyHours', 'weekday', String(weekday));
  if (!row || bool_(row.isClosed)) return [];
  return parseJson_(row.intervalsJson || '[]') || [];
}

function getSettings_() {
  var map = {};
  readTable_('Settings').forEach(function (row) { map[row.key] = row.value; });
  var timezone = map.local_timezone || 'unset';
  if (timezone !== 'unset' && !validTimezone_(timezone)) throw new Error('invalid_salon_timezone');
  return {
    timezone: timezone,
    slotIntervalMinutes: intSetting_(map.slot_interval_minutes, 15, 5, 120),
    minBookingNoticeMinutes: intSetting_(map.min_booking_notice_minutes, 120, 0, 10080),
    bookingWindowDays: intSetting_(map.booking_window_days, 30, 1, 365),
    bufferMinutes: intSetting_(map.buffer_minutes, 0, 0, 240)
  };
}
function intSetting_(value, fallback, min, max) {
  var number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : fallback;
}
function saveSetting_(key, value) {
  var current = findBy_('Settings', 'key', key);
  var record = { key: key, value: String(value) };
  if (current) updateRecord_('Settings', 'key', key, record);
  else appendRecord_('Settings', record);
}
function scheduleWindowsDummy_() {}

function getDatabase_() {
  var id = PropertiesService.getScriptProperties().getProperty(DB_PROPERTY_);
  if (!id) throw new Error('DATABASE_NOT_INITIALIZED');
  return SpreadsheetApp.openById(id);
}
function getSheet_(name) {
  var sheet = getDatabase_().getSheetByName(name);
  if (!sheet) throw new Error('DATABASE_TABLE_MISSING:' + name);
  return sheet;
}
function readTable_(name) {
  var sheet = getSheet_(name);
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0].map(String);
  return values.slice(1).filter(function (row) {
    return row.some(function (value) { return value !== '' && value !== null; });
  }).map(function (row) {
    var item = {};
    headers.forEach(function (header, index) { item[header] = row[index] == null ? '' : String(row[index]); });
    return item;
  });
}
function appendRecord_(name, record) {
  var sheet = getSheet_(name);
  var lastColumn = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(String);
  sheet.appendRow(headers.map(function (key) { return record[key] == null ? '' : String(record[key]); }));
}
function findBy_(name, key, value) {
  return readTable_(name).filter(function (row) { return String(row[key]) === String(value); })[0] || null;
}
function updateRecord_(name, key, value, record) {
  var sheet = getSheet_(name);
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return false;
  var headers = values[0].map(String);
  var keyIndex = headers.indexOf(key);
  for (var rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    if (String(values[rowIndex][keyIndex]) === String(value)) {
      sheet.getRange(rowIndex + 1, 1, 1, headers.length).setValues([headers.map(function (header) {
        return record[header] == null ? '' : String(record[header]);
      })]);
      return true;
    }
  }
  return false;
}
function deleteRecord_(name, key, value) {
  var sheet = getSheet_(name);
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return false;
  var headers = values[0].map(String);
  var keyIndex = headers.indexOf(key);
  for (var rowIndex = values.length - 1; rowIndex >= 1; rowIndex -= 1) {
    if (String(values[rowIndex][keyIndex]) === String(value)) {
      sheet.deleteRow(rowIndex + 1);
      return true;
    }
  }
  return false;
}

function sendBookingNotifications_(booking) {
  sendPushNotifications_(booking);
  if (PropertiesService.getScriptProperties().getProperty(EMAIL_NOTIFICATIONS_PROPERTY_) !== 'true') return;
  sendBookingEmail_(booking);
}

function getNotificationSettings_() {
  var props = PropertiesService.getScriptProperties();
  var devices = readTable_('PushSubscriptions').filter(function (row) { return bool_(row.isActive); });
  return { status: 200, payload: { ok: true,
    emailEnabled: props.getProperty(EMAIL_NOTIFICATIONS_PROPERTY_) === 'true',
    firebaseProjectId: props.getProperty(FIREBASE_PROJECT_PROPERTY_) || '',
    pushDeviceCount: devices.length,
    pushReady: Boolean(props.getProperty(FIREBASE_PROJECT_PROPERTY_)) && devices.length > 0
  }};
}
function saveNotificationSettings_(input, owner) {
  if (typeof input.emailEnabled !== 'boolean') return error_(400, 'invalid_notification_settings', 'وضعیت ایمیل معتبر نیست.');
  var projectId = String(input.firebaseProjectId || '').trim();
  if (projectId && !/^[a-z0-9-]{6,60}$/.test(projectId)) return error_(400, 'invalid_firebase_project', 'شناسه پروژه Firebase معتبر نیست.');
  var props = PropertiesService.getScriptProperties();
  props.setProperty(EMAIL_NOTIFICATIONS_PROPERTY_, String(input.emailEnabled));
  if (projectId) props.setProperty(FIREBASE_PROJECT_PROPERTY_, projectId);
  else props.deleteProperty(FIREBASE_PROJECT_PROPERTY_);
  audit_('notifications.settings_updated', owner.id, 'notification_settings', 'owner', { emailEnabled: input.emailEnabled, firebaseConfigured: Boolean(projectId) });
  return getNotificationSettings_();
}
function savePushSubscription_(input, owner) {
  var token = String(input.token || '').trim();
  var device = String(input.device || 'دستگاه مدیر').trim().slice(0, 80);
  if (token.length < 80 || token.length > 4096) return error_(400, 'invalid_push_token', 'شناسه اعلان دستگاه معتبر نیست.');
  var existing = findBy_('PushSubscriptions', 'token', token);
  var record = { token: token, device: device, isActive: 'true', createdAt: existing ? existing.createdAt : nowIso_(), updatedAt: nowIso_() };
  if (existing) updateRecord_('PushSubscriptions', 'token', token, record);
  else appendRecord_('PushSubscriptions', record);
  audit_('notifications.device_registered', owner.id, 'push_device', sha256_(token), { device: device });
  return getNotificationSettings_();
}
function removePushSubscription_(input, owner) {
  var token = String(input.token || '').trim();
  if (!token) return error_(400, 'invalid_push_token', 'شناسه دستگاه معتبر نیست.');
  var existing = findBy_('PushSubscriptions', 'token', token);
  if (existing) {
    existing.isActive = 'false'; existing.updatedAt = nowIso_();
    updateRecord_('PushSubscriptions', 'token', token, existing);
  }
  audit_('notifications.device_removed', owner.id, 'push_device', sha256_(token), {});
  return getNotificationSettings_();
}
function sendTestPush_(owner) {
  var result = sendPushPayload_({ title: 'اعلان‌های فُرم فعال‌اند', body: 'این یک اعلان آزمایشی از پنل مدیریت است.' });
  if (result.sent < 1) return error_(409, 'push_not_ready', 'هنوز دستگاهی برای اعلان ثبت نشده یا تنظیمات Firebase کامل نیست.');
  audit_('notifications.test_sent', owner.id, 'notification', 'push', { sent: result.sent, failed: result.failed });
  return { status: 200, payload: { ok: true, sent: result.sent, failed: result.failed }};
}
function sendPushNotifications_(booking) {
  var body = [booking.name, booking.serviceName, booking.date + ' · ' + booking.time].filter(Boolean).join(' — ');
  var result = sendPushPayload_({ title: 'نوبت جدید فُرم', body: body || 'یک نوبت جدید ثبت شد.' });
  Logger.log('Push sent=' + result.sent + ', failed=' + result.failed);
}
function sendPushPayload_(notification) {
  var projectId = PropertiesService.getScriptProperties().getProperty(FIREBASE_PROJECT_PROPERTY_) || '';
  if (!projectId) return { sent: 0, failed: 0 };
  var devices = readTable_('PushSubscriptions').filter(function (row) { return bool_(row.isActive); });
  if (!devices.length) return { sent: 0, failed: 0 };
  var accessToken;
  try { accessToken = ScriptApp.getOAuthToken(); } catch (error) {
    Logger.log('Push OAuth unavailable: ' + String(error)); return { sent: 0, failed: devices.length };
  }
  var sent = 0, failed = 0;
  devices.forEach(function (device) {
    try {
      var response = UrlFetchApp.fetch('https://fcm.googleapis.com/v1/projects/' + projectId + '/messages:send', {
        method: 'post', contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + accessToken },
        payload: JSON.stringify({ message: {
          token: device.token,
          notification: { title: notification.title, body: notification.body },
          webpush: { fcmOptions: { link: 'https://pooya-labs.github.io/salon-booking/admin' } }
        }}),
        muteHttpExceptions: true
      });
      var status = response.getResponseCode();
      if (status >= 200 && status < 300) sent += 1;
      else {
        failed += 1;
        var responseBody = response.getContentText() || '';
        Logger.log('FCM failed HTTP ' + status + ' ' + responseBody.slice(0, 300));
        if (status === 404 || /UNREGISTERED|registration-token-not-registered/i.test(responseBody)) {
          device.isActive = 'false'; device.updatedAt = nowIso_();
          updateRecord_('PushSubscriptions', 'token', device.token, device);
        }
      }
    } catch (error) { failed += 1; Logger.log('FCM request failed: ' + String(error)); }
  });
  return { sent: sent, failed: failed };
}

function sendBookingEmail_(booking) {
  var recipient = PropertiesService.getScriptProperties().getProperty(NOTIFICATION_PROPERTY_) || '';
  if (!recipient) {
    Logger.log('Booking notification skipped: recipient is not configured.');
    return;
  }
  try {
    if (MailApp.getRemainingDailyQuota() < 1) {
      Logger.log('Booking saved; daily email quota is exhausted.');
      return;
    }
    var subject = 'رزرو جدید سالن · ' + booking.reference;
    var body = [
      booking.source === 'phone' ? 'یک نوبت تلفنی جدید ثبت شد.' : 'یک درخواست رزرو آنلاین جدید ثبت شد.',
      '',
      'کد پیگیری: ' + booking.reference,
      'نام مشتری: ' + booking.name,
      'شماره تماس: ' + booking.phone,
      'خدمت: ' + booking.serviceName,
      'تاریخ: ' + booking.date,
      'ساعت: ' + booking.time,
      'وضعیت: ' + (booking.status === 'confirmed' ? 'تأیید شده' : 'در انتظار تأیید'),
      '',
      'برای مشاهده و مدیریت رزرو وارد پنل مدیریت شوید.'
    ].join('\n');
    MailApp.sendEmail(recipient, subject, body);
  } catch (error) {
    // Never undo a committed booking because the notification channel failed.
    Logger.log('Booking saved; notification delivery failed: ' + String(error && error.message || error));
  }
}

function audit_(action, actorId, entityType, entityId, details) {
  appendRecord_('AuditLog', {
    id: uuid_(), actorId: actorId, action: action, entityType: entityType,
    entityId: entityId, detailsJson: JSON.stringify(details || {}), createdAt: nowIso_()
  });
}

function setSession_(sessionId, user) {
  var expiresAt = Date.now() + SESSION_TTL_ * 1000;
  var session = { id: user.id, username: user.username, expiresAt: expiresAt };
  var hash = sha256_('salon-owner-session:' + sessionId);
  var record = {
    sessionIdHash: hash, userId: user.id, username: user.username,
    expiresAt: new Date(expiresAt).toISOString(), createdAt: nowIso_()
  };
  var existing = findBy_('AdminSessions', 'sessionIdHash', hash);
  if (existing) updateRecord_('AdminSessions', 'sessionIdHash', hash, record);
  else appendRecord_('AdminSessions', record);
  CacheService.getScriptCache().put(sessionKey_(sessionId), JSON.stringify(session), SESSION_TTL_);
}
function getSession_(sessionId) {
  var cache = CacheService.getScriptCache();
  var raw = cache.get(sessionKey_(sessionId));
  if (raw) {
    var cached = parseJson_(raw);
    if (cached && Number(cached.expiresAt) > Date.now()) return cached;
    cache.remove(sessionKey_(sessionId));
  }
  var hash = sha256_('salon-owner-session:' + sessionId);
  var record = findBy_('AdminSessions', 'sessionIdHash', hash);
  if (!record || Date.parse(record.expiresAt) <= Date.now()) {
    if (record) deleteRecord_('AdminSessions', 'sessionIdHash', hash);
    return null;
  }
  var session = { id: record.userId, username: record.username, expiresAt: Date.parse(record.expiresAt) };
  cache.put(sessionKey_(sessionId), JSON.stringify(session), SESSION_TTL_);
  return session;
}
function revokeSession_(sessionId) {
  CacheService.getScriptCache().remove(sessionKey_(sessionId));
  deleteRecord_('AdminSessions', 'sessionIdHash', sha256_('salon-owner-session:' + sessionId));
}
function sessionKey_(sessionId) { return 'salon-owner:' + sha256_('salon-owner-cache:' + sessionId); }
function rateLimit_(sessionId, scope, limit, windowSeconds) {
  var cache = CacheService.getScriptCache();
  var bucket = Math.floor(Date.now() / (windowSeconds * 1000));
  var key = 'salon-rate:' + scope + ':' + sessionId + ':' + bucket;
  var count = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(count), windowSeconds * 2);
  return count <= limit;
}
function rateLimited_() { return error_(429, 'rate_limited', 'تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.'); }

function requireOwnerEditor_() {
  var active = '';
  var effective = '';
  try {
    active = Session.getActiveUser().getEmail() || '';
    effective = Session.getEffectiveUser().getEmail() || '';
  } catch (ignored) {}
  if (!active || !effective || active.toLowerCase() !== effective.toLowerCase()) {
    throw new Error('Run this function from the Apps Script editor while signed in as the script owner.');
  }
}
function parseQuery_(raw) {
  var values = {};
  String(raw || '').split('&').forEach(function (part) {
    if (!part) return;
    var at = part.indexOf('=');
    var key = at < 0 ? part : part.slice(0, at);
    var value = at < 0 ? '' : part.slice(at + 1);
    try {
      key = decodeURIComponent(key.replace(/\+/g, ' '));
      value = decodeURIComponent(value.replace(/\+/g, ' '));
    } catch (ignored) { return; }
    if (!Object.prototype.hasOwnProperty.call(values, key)) values[key] = value;
  });
  return { get: function (key) { return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null; } };
}
function normalizeHeaders_(headers) {
  var normalized = {};
  Object.keys(headers || {}).forEach(function (key) { normalized[String(key).toLowerCase()] = String(headers[key]); });
  return normalized;
}
function parseJson_(value) {
  try { return JSON.parse(String(value)); } catch (ignored) { return null; }
}
function result_(status, payload, sessionId) {
  return { status: status, body: JSON.stringify(payload || {}), sessionId: sessionId || '' };
}
function error_(status, error, message) {
  return { status: status, payload: { ok: false, error: error, message: message }};
}
function bool_(value) { return value === true || value === 'true' || value === 1 || value === '1'; }
function normalizeDigits_(value) {
  return String(value == null ? '' : value)
    .replace(/[۰-۹]/g, function (digit) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)); })
    .replace(/[٠-٩]/g, function (digit) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)); });
}
function bookingFullName_(input) {
  var firstName = String(input.firstName || '').trim().replace(/\s+/g, ' ');
  var lastName = String(input.lastName || '').trim().replace(/\s+/g, ' ');
  if (firstName || lastName) return (firstName + ' ' + lastName).trim().replace(/\s+/g, ' ');
  return String(input.name || '').trim().replace(/\s+/g, ' ');
}
function normalizePhone_(value) {
  var phone = normalizeDigits_(value).replace(/[\s()-]/g, '');
  return /^\+?[0-9]{8,15}$/.test(phone) ? phone : null;
}
function normalizeIntervals_(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) return null;
  var result = [];
  for (var index = 0; index < value.length; index += 1) {
    var item = value[index] || {};
    var start = String(item.startsAt || item.start || '');
    var end = String(item.endsAt || item.end || '');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end) || start >= end) return null;
    result.push({ startsAt: start, endsAt: end });
  }
  result.sort(function (a, b) { return a.startsAt.localeCompare(b.startsAt); });
  for (var i = 1; i < result.length; i += 1) if (result[i - 1].endsAt > result[i].startsAt) return null;
  return result;
}
function parseDateKey_(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  var pieces = value.split('-').map(Number);
  var check = new Date(Date.UTC(pieces[0], pieces[1] - 1, pieces[2]));
  if (check.getUTCFullYear() !== pieces[0] || check.getUTCMonth() !== pieces[1] - 1 || check.getUTCDate() !== pieces[2]) return null;
  return { year: pieces[0], month: pieces[1], day: pieces[2] };
}
function validTimezone_(timezone) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date()); return true; } catch (ignored) { return false; }
}
function getZonedParts_(instant, timezone) {
  var parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(instant);
  var values = {};
  parts.forEach(function (part) { values[part.type] = part.value; });
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day), hour: Number(values.hour), minute: Number(values.minute) };
}
function getLocalDateKey_(instant, timezone) {
  var p = getZonedParts_(instant, timezone);
  return p.year + '-' + pad2_(p.month) + '-' + pad2_(p.day);
}
function getLocalMinuteOfDay_(instant, timezone) {
  var p = getZonedParts_(instant, timezone);
  return p.hour * 60 + p.minute;
}
function localDateTimeToUtc_(dateKey, time, timezone) {
  var date = parseDateKey_(dateKey);
  var match = /^(\d{2}):(\d{2})$/.exec(String(time));
  if (!date || !match) return null;
  var hour = Number(match[1]), minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  var target = Date.UTC(date.year, date.month - 1, date.day, hour, minute);
  var candidate = target;
  try {
    for (var attempt = 0; attempt < 4; attempt += 1) {
      var z = getZonedParts_(new Date(candidate), timezone);
      var represented = Date.UTC(z.year, z.month - 1, z.day, z.hour, z.minute);
      candidate += target - represented;
    }
    var resolved = getZonedParts_(new Date(candidate), timezone);
    if (resolved.year !== date.year || resolved.month !== date.month || resolved.day !== date.day ||
        resolved.hour !== hour || resolved.minute !== minute) return null;
    return new Date(candidate);
  } catch (ignored) { return null; }
}
function addDays_(dateKey, amount) {
  var parts = parseDateKey_(dateKey);
  if (!parts) return null;
  var date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + amount));
  return date.getUTCFullYear() + '-' + pad2_(date.getUTCMonth() + 1) + '-' + pad2_(date.getUTCDate());
}
function pad2_(value) { return String(value).padStart(2, '0'); }
function nowIso_() { return new Date().toISOString(); }
function uuid_() { return Utilities.getUuid(); }
function randomHex_() { return uuid_().replace(/-/g, '') + uuid_().replace(/-/g, ''); }
function makeReference_() {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, randomHex_(), Utilities.Charset.UTF_8);
  var alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var output = 'SB-';
  for (var i = 0; i < 7; i += 1) output += alphabet[(bytes[i] + 256) % 256 % alphabet.length];
  return output;
}
function sha256_(value) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8);
  return bytes.map(function (byte) { return ((byte + 256) % 256).toString(16).padStart(2, '0'); }).join('');
}
function passwordHash_(password, salt) {
  // Iterated salted SHA-256 using Apps Script's native digest helper.
  var value = String(salt) + ':' + String(password);
  for (var i = 0; i < 12000; i += 1) value = sha256_(value);
  return value;
}
function constantTimeEqual_(left, right) {
  left = String(left || '');
  right = String(right || '');
  if (left.length !== right.length) return false;
  var diff = 0;
  for (var i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}
