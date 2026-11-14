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
    .setTitle('Salon Booking API')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(event) {
  return proxyRequest(event && event.postData && event.postData.contents ? JSON.parse(event.postData.contents) : null);
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
}

/**
 * Entrypoint called by the GitHub Pages relay iframe.
 *
 * Input:  { path, method, query, headers, body, sessionId }
 * Output: { status, body, sessionId? }
 */
function proxyRequest(input) {
  if (!input || typeof input !== 'object') {
    return { status: 400, body: JSON.stringify({ ok: false, error: 'invalid_envelope', message: 'درخواست نامعتبر است.' }) };
  }
  REQUEST_TABLE_CACHE_ = {};
  REQUEST_SPREADSHEET_ = null;
  var path = String(input.path || '/');
  var method = String(input.method || 'GET').toUpperCase();
  var headers = normalizeHeaders_(input.headers);
  var body = parseJson_(input.body);
  var sessionId = typeof input.sessionId === 'string' ? input.sessionId : '';

  try {
    var response = dispatch_(path, method, headers, body, sessionId);
    if (response && response.sessionId && !sessionId) sessionId = response.sessionId;
    return {
      status: response.status,
      body: JSON.stringify(response.payload),
      sessionId: response.sessionId || sessionId || undefined
    };
  } catch (error) {
    return {
      status: 500,
      body: JSON.stringify({
        ok: false,
        error: 'internal_error',
        message: error && error.message ? error.message : 'خطای داخلی سامانه رزرو رخ داد.'
      }),
      sessionId: sessionId || undefined
    };
  }
}

function dispatch_(rawPath, method, headers, body, sessionId) {
  var path = rawPath;
  var query = {};
  var queryAt = path.indexOf('?');
  if (queryAt !== -1) {
    query = parseQuery_(path.slice(queryAt + 1));
    path = path.slice(0, queryAt);
  }

  if (path === '/api/health' && method === 'GET') {
    return { status: 200, payload: { ok: true, service: 'salon-booking-apps-script', version: APP_VERSION_ } };
  }

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
    var salonSettings = getSettings_();
    return {
      status: 200,
      payload: {
        ok: true,
        date: date,
        slots: getAvailability_(date, service, salonSettings, false)
      }
    };
  }

  if (path === '/api/public/bookings' && method === 'POST') {
    var clientIp = clientIp_(headers);
    if (rateLimited_('book:' + clientIp, 12, 60)) {
      return error_(429, 'rate_limited', 'تعداد درخواست‌ها بیش از حد مجاز است. لطفاً کمی بعد دوباره تلاش کنید.');
    }
    return createBooking_(body, false, null, clientIp);
  }

  if (path === '/api/public/bookings/lookup' && method === 'POST') {
    return manageCustomerBooking_(body, clientIp_(headers), 'lookup');
  }

  if (path === '/api/public/bookings/cancel' && method === 'POST') {
    return manageCustomerBooking_(body, clientIp_(headers), 'cancel');
  }

  if (path.indexOf('/api/admin/') === 0) {
    return dispatchAdmin_(path, method, query, headers, body, sessionId);
  }

  return error_(404, 'not_found', 'مسیر درخواست‌شده پیدا نشد.');
}

function dispatchAdmin_(path, method, query, headers, body, sessionId) {
  var props = PropertiesService.getScriptProperties();
  var adminUsers = readTable_('AdminUsers').filter(function (row) { return bool_(row.isActive); });

  if (path === '/api/admin/setup-status' && method === 'GET') {
    return {
      status: 200,
      payload: {
        ok: true,
        setupRequired: adminUsers.length === 0,
        adminUserExists: adminUsers.length > 0
      }
    };
  }

  if (path === '/api/admin/bootstrap' && method === 'POST') {
    if (adminUsers.length > 0) return error_(409, 'bootstrap_already_completed', 'مدیر اولیه قبلاً ثبت شده است.');
    var expectedToken = props.getProperty(BOOTSTRAP_PROPERTY_);
    var suppliedToken = String((body && body.bootstrapToken) || '').trim();
    if (!expectedToken || suppliedToken !== expectedToken) {
      return error_(401, 'invalid_bootstrap_token', 'توکن راه‌اندازی اولیه معتبر نیست.');
    }
    var username = String((body && body.username) || '').trim().toLowerCase();
    var password = String((body && body.password) || '');
    if (!/^[a-z0-9_-]{3,32}$/.test(username)) {
      return error_(400, 'invalid_username', 'نام کاربری باید ۳ تا ۳۲ کاراکتر و شامل حروف کوچک انگلیسی، عدد، خط تیره یا زیرخط باشد.');
    }
    if (password.length < 10) return error_(400, 'weak_password', 'رمز عبور باید حداقل ۱۰ کاراکتر باشد.');

    var salt = randomHex_();
    var now = nowIso_();
    var adminUser = {
      id: uuid_(),
      username: username,
      salt: salt,
      passwordHash: passwordHash_(password, salt),
      isActive: 'true',
      createdAt: now
    };
    appendRecord_('AdminUsers', adminUser);
    props.deleteProperty(BOOTSTRAP_PROPERTY_);
    audit_('admin.bootstrapped', adminUser.id, 'admin_user', adminUser.id, { username: username });
    var session = setSession_(adminUser);
    return {
      status: 201,
      sessionId: session.id,
      payload: { ok: true, user: { id: adminUser.id, username: adminUser.username } }
    };
  }

  if (path === '/api/admin/login' && method === 'POST') {
    var loginUsername = String((body && body.username) || '').trim().toLowerCase();
    var loginPassword = String((body && body.password) || '');
    var target = readTable_('AdminUsers').find(function (row) {
      return bool_(row.isActive) && String(row.username).toLowerCase() === loginUsername;
    });
    if (!target || !constantTimeEqual_(target.passwordHash, passwordHash_(loginPassword, target.salt))) {
      audit_('admin.login_failed', null, 'admin_user', loginUsername, { ip: clientIp_(headers) });
      return error_(401, 'invalid_credentials', 'نام کاربری یا رمز عبور اشتباه است.');
    }
    var loginSession = setSession_(target);
    audit_('admin.logged_in', target.id, 'admin_user', target.id, { ip: clientIp_(headers) });
    return {
      status: 200,
      sessionId: loginSession.id,
      payload: { ok: true, user: { id: target.id, username: target.username } }
    };
  }

  if (path === '/api/admin/logout' && method === 'POST') {
    if (sessionId) revokeSession_(sessionId);
    return { status: 200, payload: { ok: true } };
  }

  var owner = getSession_(sessionId);
  if (!owner) {
    if (path === '/api/admin/me' && method === 'GET') return error_(401, 'unauthorized', 'برای ادامه وارد پنل مدیریت شوید.');
    if (path === '/api/admin/setup-status') return error_(405, 'method_not_allowed', 'روش درخواست پشتیبانی نمی‌شود.');
    return error_(401, 'unauthorized', 'برای ادامه وارد پنل مدیریت شوید.');
  }

  if (path === '/api/admin/me' && method === 'GET') {
    return { status: 200, payload: { ok: true, user: { id: owner.id, username: owner.username } } };
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
    return { status: 200, payload: { ok: true, services: services.map(servicePayload_) } };
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

  return error_(404, 'not_found', 'مسیر مدیریت پیدا نشد.');
}

function createBooking_(input, isManual, owner, clientIp) {
  var serviceId = String(input.serviceId || '').trim();
  var date = String(input.date || '').trim();
  var time = String(input.time || '').trim();
  var name = bookingFullName_(input);
  var phone = normalizePhone_(input.phone);
  var note = String(input.note || '').trim();

  if (!serviceId) return error_(400, 'missing_service', 'انتخاب خدمت الزامی است.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return error_(400, 'invalid_date', 'تاریخ رزرو معتبر نیست.');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return error_(400, 'invalid_time', 'ساعت نوبت معتبر نیست.');
  if (name.length < 2 || name.length > 100) return error_(400, 'invalid_name', 'نام و نام خانوادگی را کامل وارد کنید.');
  if (!phone) return error_(400, 'invalid_phone', 'شماره موبایل واردشده معتبر نیست.');
  if (note.length > 500) return error_(400, 'invalid_note', 'یادداشت بیش از حد طولانی است.');

  var service = findBy_('Services', 'id', serviceId);
  if (!service || (!isManual && !bool_(service.isActive))) return error_(404, 'service_not_found', 'خدمت انتخاب‌شده یافت نشد یا فعال نیست.');

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return error_(503, 'service_busy', 'سامانه موقتاً پاسخگو نیست. لطفاً چند لحظه بعد تلاش کنید.');

  try {
    var settings = getSettings_();
    var duration = Number(service.durationMinutes);
    var startInstant = parseDateKey_(date, time, settings.timezone);
    if (!startInstant) return error_(400, 'invalid_datetime', 'زمان انتخابی نامعتبر است.');
    var endInstant = new Date(startInstant.getTime() + duration * 60 * 1000);

    var available = getAvailability_(date, service, settings, isManual);
    if (available.indexOf(time) === -1) {
      return error_(409, 'time_slot_unavailable', 'ساعت انتخابی در دسترس نیست یا پر شده است.');
    }

    var now = nowIso_();
    var manageToken = isManual ? '' : randomHex_();
    var booking = {
      id: uuid_(),
      reference: makeReference_(),
      serviceId: service.id,
      serviceName: service.name,
      durationMinutes: String(duration),
      name: name,
      phone: phone,
      date: date,
      time: time,
      startsAt: startInstant.toISOString(),
      endsAt: endInstant.toISOString(),
      status: 'confirmed',
      note: note,
      manageTokenHash: manageToken ? sha256_(manageToken) : '',
      idempotencyKeyHash: '',
      requestHash: sha256_((clientIp || '') + ':' + serviceId + ':' + date + ':' + time + ':' + phone),
      createdAt: now,
      updatedAt: now,
      source: isManual ? 'phone' : 'online'
    };

    appendRecord_('Bookings', booking);
    audit_(isManual ? 'booking.created_manual' : 'booking.created_public', owner ? owner.id : null, 'booking', booking.id, {
      reference: booking.reference, serviceName: booking.serviceName, date: date, time: time
    });

    sendBookingNotifications_(booking, service, isManual ? 'manual' : 'public');

    return {
      status: 201,
      payload: {
        ok: true,
        reference: booking.reference,
        manageToken: manageToken || undefined,
        booking: {
          reference: booking.reference,
          serviceName: booking.serviceName,
          date: booking.date,
          time: booking.time,
          durationMinutes: Number(booking.durationMinutes),
          name: booking.name,
          phone: booking.phone,
          status: booking.status,
          createdAt: booking.createdAt
        }
      }
    };
  } finally {
    lock.releaseLock();
  }
}

function getAdminAvailability_(query) {
  var date = String(query.date || '').trim();
  var duration = Math.max(5, Math.min(480, Number(query.durationMinutes || 30)));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return error_(400, 'invalid_date', 'تاریخ الزامی است.');
  var dummy = { durationMinutes: duration, isActive: 'true' };
  var settings = getSettings_();
  return {
    status: 200,
    payload: {
      ok: true,
      date: date,
      slots: getAvailability_(date, dummy, settings, true)
    }
  };
}

function createManualBooking_(input, owner) {
  return createBooking_(input, true, owner, null);
}

function manageCustomerBooking_(input, clientIp, mode) {
  if (rateLimited_('manage:' + clientIp, 20, 60)) {
    return error_(429, 'rate_limited', 'درخواست‌های پیگیری نوبت بیش از حد مجاز است. کمی بعد امتحان کنید.');
  }
  var phone = normalizePhone_(input.phone);
  var reference = String(input.reference || '').trim().toUpperCase();
  if (!phone || !reference) return error_(400, 'missing_fields', 'شماره موبایل و شناسه نوبت الزامی است.');

  var booking = readTable_('Bookings').find(function (row) {
    return String(row.reference).toUpperCase() === reference && normalizePhone_(row.phone) === phone;
  });
  if (!booking) return error_(404, 'booking_not_found', 'نوبتی با این مشخصات پیدا نشد.');

  if (mode === 'lookup') {
    return { status: 200, payload: { ok: true, booking: managedPayload_(booking) } };
  }

  var token = String(input.manageToken || '').trim();
  if (!token || !constantTimeEqual_(booking.manageTokenHash, sha256_(token))) {
    return error_(403, 'invalid_manage_token', 'کد مدیریت نوبت معتبر نیست.');
  }
  if (booking.status === 'cancelled') return error_(409, 'already_cancelled', 'این نوبت قبلاً لغو شده است.');

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return error_(503, 'busy', 'سامانه موقتاً پاسخگو نیست.');
  try {
    var updated = Object.assign({}, booking, { status: 'cancelled', updatedAt: nowIso_() });
    updateRecord_('Bookings', 'id', booking.id, updated);
    audit_('booking.cancelled_by_customer', null, 'booking', booking.id, { reference: booking.reference });
    return { status: 200, payload: { ok: true, booking: managedPayload_(updated) } };
  } finally {
    lock.releaseLock();
  }
}

function managedPayload_(row) {
  return {
    reference: row.reference,
    serviceName: row.serviceName,
    date: row.date,
    time: row.time,
    durationMinutes: Number(row.durationMinutes),
    name: row.name,
    phone: row.phone,
    status: row.status,
    createdAt: row.createdAt
  };
}

function getAdminBookings_(query, owner) {
  var rows = readTable_('Bookings');
  if (query.date) rows = rows.filter(function (r) { return r.date === query.date; });
  if (query.status) rows = rows.filter(function (r) { return r.status === query.status; });
  rows.sort(function (a, b) { return String(b.date + ' ' + b.time).localeCompare(String(a.date + ' ' + a.time)); });
  return {
    status: 200,
    payload: {
      ok: true,
      bookings: rows.map(function (row) {
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
          createdAt: row.createdAt,
          updatedAt: row.updatedAt
        };
      })
    }
  };
}

function deleteBooking_(id, owner) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return error_(503, 'service_busy', 'سامانه موقتاً پاسخگو نیست.');
  try {
    var booking = findBy_('Bookings', 'id', id);
    if (!booking) return error_(404, 'booking_not_found', 'نوبت پیدا نشد.');
    deleteRecord_('Bookings', 'id', id);
    audit_('booking.deleted', owner.id, 'booking', id, { reference: booking.reference, serviceName: booking.serviceName });
    return { status: 200, payload: { ok: true, deleted: true } };
  } finally {
    lock.releaseLock();
  }
}

function updateBookingStatus_(id, body, owner) {
  var status = String((body && body.status) || '').trim().toLowerCase();
  if (['pending', 'confirmed', 'completed', 'cancelled'].indexOf(status) === -1) {
    return error_(400, 'invalid_status', 'وضعیت معتبر نیست.');
  }
  var booking = findBy_('Bookings', 'id', id);
  if (!booking) return error_(404, 'booking_not_found', 'نوبت پیدا نشد.');
  var updated = Object.assign({}, booking, { status: status, updatedAt: nowIso_() });
  updateRecord_('Bookings', 'id', id, updated);
  audit_('booking.status_updated', owner.id, 'booking', id, { status: status });
  return { status: 200, payload: { ok: true, booking: updated } };
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
    description: row.description,
    category: row.category || 'عمومی',
    durationMinutes: Number(row.durationMinutes),
    priceAmount: Number(row.priceAmount),
    priceCurrency: row.priceCurrency || 'IRR',
    isActive: bool_(row.isActive),
    sortOrder: Number(row.sortOrder || 0)
  };
}

function getAdminDaySchedule_(query) {
  var date = String(query.date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return error_(400, 'invalid_date', 'تاریخ الزامی است.');
  var settings = getSettings_();
  var bookings = readTable_('Bookings').filter(function (row) {
    return row.date === date && ['pending', 'confirmed'].indexOf(String(row.status || '').toLowerCase()) !== -1;
  }).map(function (row) {
    return {
      id: row.id,
      reference: row.reference,
      serviceName: row.serviceName,
      name: row.name,
      phone: row.phone,
      time: row.time,
      durationMinutes: Number(row.durationMinutes),
      status: row.status,
      source: row.source || 'online'
    };
  });
  var blocks = readTable_('TimeBlocks').filter(function (row) { return row.date === date; }).map(function (row) {
    return { id: row.id, time: row.time, durationMinutes: Number(row.durationMinutes), note: row.note || '' };
  });
  var windows = scheduleWindows_(date, settings);
  return {
    status: 200,
    payload: {
      ok: true,
      date: date,
      workingHours: windows,
      bookings: bookings,
      timeBlocks: blocks
    }
  };
}

function createTimeBlock_(input, owner) {
  var date = String(input.date || '').trim();
  var time = String(input.time || '').trim();
  var duration = Number(input.durationMinutes || 15);
  var note = String(input.note || '').trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return error_(400, 'invalid_date', 'تاریخ الزامی است.');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return error_(400, 'invalid_time', 'ساعت نامعتبر است.');
  if (!Number.isInteger(duration) || duration < 5 || duration > 480) return error_(400, 'invalid_duration', 'مدت زمان نامعتبر است.');
  if (note.length > 200) return error_(400, 'invalid_note', 'یادداشت بیش از حد طولانی است.');

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return error_(503, 'service_busy', 'سامانه موقتاً پاسخگو نیست.');
  try {
    var settings = getSettings_();
    var startInstant = parseDateKey_(date, time, settings.timezone);
    if (!startInstant) return error_(400, 'invalid_datetime', 'زمان انتخابی نامعتبر است.');
    var endInstant = new Date(startInstant.getTime() + duration * 60 * 1000);

    var windows = scheduleWindows_(date, settings);
    if (!fitsIntervals_(time, duration, windows)) {
      return error_(409, 'outside_working_hours', 'بازه مسدودشده خارج از ساعات کاری تعریف‌شده است.');
    }

    var bookings = activeBookingsOnDate_(date);
    var blocks = readTable_('TimeBlocks').filter(function (row) { return row.date === date; });

    var startMs = startInstant.getTime();
    var endMs = endInstant.getTime();
    var overlaps = bookings.some(function (b) {
      return Math.max(startMs, rowStartMs_(b, settings.timezone)) < Math.min(endMs, rowEndMs_(b, settings.timezone));
    }) || blocks.some(function (blk) {
      return Math.max(startMs, rowStartMs_(blk, settings.timezone)) < Math.min(endMs, rowEndMs_(blk, settings.timezone));
    });

    if (overlaps) return error_(409, 'time_already_booked', 'این بازه زمانی با نوبت یا مسدودی دیگری همپوشانی دارد.');

    var record = {
      id: uuid_(),
      date: date,
      time: time,
      startsAt: startInstant.toISOString(),
      endsAt: endInstant.toISOString(),
      durationMinutes: String(duration),
      createdAt: nowIso_(),
      createdBy: owner.id
    };
    appendRecord_('TimeBlocks', record);
    audit_('time_block.created', owner.id, 'time_block', record.id, { date: date, time: time, durationMinutes: duration });
    return { status: 201, payload: { ok: true, block: record } };
  } finally {
    lock.releaseLock();
  }
}

function deleteTimeBlock_(id, owner) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return error_(503, 'service_busy', 'سامانه موقتاً پاسخگو نیست.');
  try {
    var block = findBy_('TimeBlocks', 'id', id);
    if (!block) return error_(404, 'block_not_found', 'بازه زمانی پیدا نشد.');
    deleteRecord_('TimeBlocks', 'id', id);
    audit_('time_block.deleted', owner.id, 'time_block', id, { date: block.date, time: block.time });
    return { status: 200, payload: { ok: true } };
  } finally {
    lock.releaseLock();
  }
}

function clockForInstant_(instant, timezone) {
  return Utilities.formatDate(instant, timezone, 'HH:mm');
}

function clockFromMinutes_(minutes) {
  var hour = Math.floor(minutes / 60);
  var min = minutes % 60;
  return pad2_(hour) + ':' + pad2_(min);
}

function getAdminSchedule_() {
  var settings = getSettings_();
  var weekly = [0, 1, 2, 3, 4, 5, 6].map(function (day) {
    var row = findBy_('WeeklyHours', 'weekday', String(day));
    return {
      weekday: day,
      isClosed: row ? bool_(row.isClosed) : true,
      intervals: row && row.intervalsJson ? JSON.parse(row.intervalsJson) : [],
      configured: row ? bool_(row.configured) : false
    };
  });
  var exceptions = readTable_('Exceptions').map(function (row) {
    return {
      id: row.id,
      date: row.date,
      isClosed: bool_(row.isClosed),
      intervals: row.intervalsJson ? JSON.parse(row.intervalsJson) : [],
      note: row.note || '',
      createdAt: row.createdAt
    };
  });
  exceptions.sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
  return { status: 200, payload: { ok: true, settings: settings, weekly: weekly, exceptions: exceptions } };
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
  if (!input.isClosed && (!intervals || intervals.length === 0)) {
    return error_(400, 'invalid_intervals', 'ساعات کاری باید دارای شروع و پایان معتبر باشند.');
  }
  var conflict = hasWeeklyConflict_(weekday, intervals, input.isClosed);
  if (conflict) {
    return error_(409, 'weekly_conflict', 'تغییر ساعات این روز کاری با نوبت‌های رزروشده آینده تداخل دارد.');
  }
  var current = findBy_('WeeklyHours', 'weekday', String(weekday));
  var record = {
    weekday: String(weekday),
    isClosed: String(input.isClosed),
    intervalsJson: JSON.stringify(intervals),
    configured: 'true'
  };
  if (current) updateRecord_('WeeklyHours', 'weekday', String(weekday), record);
  else appendRecord_('WeeklyHours', record);
  audit_('salon.weekly_hours_updated', owner.id, 'weekly_hours', String(weekday), record);
  return { status: 200, payload: { ok: true, weekday: weekday, isClosed: input.isClosed, intervals: intervals } };
}

function saveException_(input, owner) {
  var date = String(input.date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return error_(400, 'invalid_date', 'تاریخ معتبر نیست.');
  if (typeof input.isClosed !== 'boolean') return error_(400, 'invalid_request', 'وضعیت تعطیلی الزامی است.');
  var intervals = input.isClosed ? [] : normalizeIntervals_(input.intervals || [
    { startsAt: input.opensAt, endsAt: input.closesAt }
  ]);
  if (!input.isClosed && (!intervals || intervals.length === 0)) {
    return error_(400, 'invalid_intervals', 'ساعات کاری استثنا معتبر نیستند.');
  }
  var note = String(input.note || '').trim();
  if (note.length > 200) return error_(400, 'invalid_note', 'یادداشت بیش از حد طولانی است.');

  if (hasExceptionConflict_(date, intervals, input.isClosed)) {
    return error_(409, 'exception_conflict', 'ساعات استثنا با نوبت‌های ثبت‌شده این روز تداخل دارد.');
  }

  var current = findBy_('Exceptions', 'date', date);
  var record = {
    id: current ? current.id : uuid_(),
    date: date,
    isClosed: String(input.isClosed),
    intervalsJson: JSON.stringify(intervals),
    note: note,
    createdAt: current ? current.createdAt : nowIso_()
  };
  if (current) updateRecord_('Exceptions', 'id', current.id, record);
  else appendRecord_('Exceptions', record);
  audit_('salon.exception_saved', owner.id, 'exception', record.id, record);
  return { status: 200, payload: { ok: true, exception: record } };
}

function deleteException_(id, owner) {
  var current = findBy_('Exceptions', 'id', id);
  if (!current) return error_(404, 'exception_not_found', 'استثنا پیدا نشد.');
  deleteRecord_('Exceptions', 'id', id);
  audit_('salon.exception_deleted', owner.id, 'exception', id, { date: current.date });
  return { status: 200, payload: { ok: true } };
}

function hasWeeklyConflict_(weekday, intervals, isClosed) {
  var settings = getSettings_();
  var todayKey = getLocalDateKey_(new Date(), settings.timezone);
  var activeBookings = readTable_('Bookings').filter(function (row) {
    return ['pending', 'confirmed'].indexOf(String(row.status || '').toLowerCase()) !== -1 && row.date >= todayKey;
  });
  for (var index = 0; index < activeBookings.length; index += 1) {
    var booking = activeBookings[index];
    var instant = parseDateKey_(booking.date, booking.time, settings.timezone);
    if (!instant) continue;
    var day = getZonedParts_(instant, settings.timezone).weekday;
    if (day !== weekday) continue;
    if (findBy_('Exceptions', 'date', booking.date)) continue;
    if (isClosed || !fitsIntervals_(booking.time, Number(booking.durationMinutes), intervals)) return true;
  }
  return false;
}

function hasExceptionConflict_(date, intervals, isClosed) {
  var active = activeBookingsOnDate_(date);
  if (!active.length) return false;
  if (isClosed) return true;
  for (var i = 0; i < active.length; i += 1) {
    if (!fitsIntervals_(active[i].time, Number(active[i].durationMinutes), intervals)) return true;
  }
  return false;
}

function fitsIntervals_(time, durationMinutes, intervals) {
  if (!intervals || !intervals.length) return false;
  var parts = time.split(':');
  var start = Number(parts[0]) * 60 + Number(parts[1]);
  var end = start + durationMinutes;
  for (var index = 0; index < intervals.length; index += 1) {
    var openParts = intervals[index].startsAt.split(':');
    var closeParts = intervals[index].endsAt.split(':');
    var openMin = Number(openParts[0]) * 60 + Number(openParts[1]);
    var closeMin = Number(closeParts[0]) * 60 + Number(closeParts[1]);
    if (start >= openMin && end <= closeMin) return true;
  }
  return false;
}

function activeBookingsOnDate_(date) {
  return readTable_('Bookings').filter(function (row) {
    return row.date === date && ['pending', 'confirmed'].indexOf(String(row.status || '').toLowerCase()) !== -1;
  });
}

function getAvailability_(date, service, settings, isAdmin) {
  var duration = Number(service.durationMinutes);
  var windows = scheduleWindows_(date, settings);
  if (!windows.length) return [];

  var intervalMinutes = settings.slotIntervalMinutes || 15;
  var bufferMinutes = settings.bufferMinutes || 0;
  var minNoticeMs = (settings.minBookingNoticeMinutes || 0) * 60 * 1000;
  var now = new Date();
  var todayKey = getLocalDateKey_(now, settings.timezone);
  var horizonDays = settings.bookingWindowDays || 30;
  var maxDateKey = getLocalDateKey_(addDays_(now, horizonDays), settings.timezone);

  if (!isAdmin) {
    if (date < todayKey || date > maxDateKey) return [];
  }

  var existing = activeBookingsOnDate_(date);
  var blocks = readTable_('TimeBlocks').filter(function (row) { return row.date === date; });

  var slots = [];
  var seen = {};

  for (var w = 0; w < windows.length; w += 1) {
    var openParts = windows[w].startsAt.split(':');
    var closeParts = windows[w].endsAt.split(':');
    var openMin = Number(openParts[0]) * 60 + Number(openParts[1]);
    var closeMin = Number(closeParts[0]) * 60 + Number(closeParts[1]);

    for (var candidate = openMin; candidate + duration <= closeMin; candidate += intervalMinutes) {
      var clock = clockFromMinutes_(candidate);
      if (seen[clock]) continue;

      var slotInstant = parseDateKey_(date, clock, settings.timezone);
      if (!slotInstant) continue;
      if (!isAdmin && slotInstant.getTime() < now.getTime() + minNoticeMs) continue;

      var slotStartMs = slotInstant.getTime();
      var slotEndMs = slotStartMs + duration * 60 * 1000;
      var bufferedStartMs = slotStartMs - bufferMinutes * 60 * 1000;
      var bufferedEndMs = slotEndMs + bufferMinutes * 60 * 1000;

      var conflict = existing.some(function (b) {
        var bStart = rowStartMs_(b, settings.timezone);
        var bEnd = rowEndMs_(b, settings.timezone);
        return Math.max(bufferedStartMs, bStart) < Math.min(bufferedEndMs, bEnd);
      }) || blocks.some(function (blk) {
        var blkStart = rowStartMs_(blk, settings.timezone);
        var blkEnd = rowEndMs_(blk, settings.timezone);
        return Math.max(slotStartMs, blkStart) < Math.min(slotEndMs, blkEnd);
      });

      if (!conflict) {
        slots.push(clock);
        seen[clock] = true;
      }
    }
  }

  return slots;
}

function scheduleWindows_(date, settings) {
  var exception = findBy_('Exceptions', 'date', date);
  if (exception) {
    if (bool_(exception.isClosed)) return [];
    return exception.intervalsJson ? JSON.parse(exception.intervalsJson) : [];
  }

  var instant = parseDateKey_(date, '12:00', settings.timezone);
  if (!instant) return [];
  var weekday = getZonedParts_(instant, settings.timezone).weekday;
  var weekly = findBy_('WeeklyHours', 'weekday', String(weekday));
  if (!weekly || bool_(weekly.isClosed) || !weekly.intervalsJson) return [];
  return JSON.parse(weekly.intervalsJson);
}

function getSettings_() {
  var rows = readTable_('Settings');
  var map = {};
  rows.forEach(function (row) { map[row.key] = row.value; });
  return {
    timezone: map.local_timezone || IRAN_TIMEZONE_,
    slotIntervalMinutes: intSetting_(map.slot_interval_minutes, 15, 5, 120),
    minBookingNoticeMinutes: intSetting_(map.min_booking_notice_minutes, 120, 0, 10080),
    bookingWindowDays: intSetting_(map.booking_window_days, 30, 1, 365),
    bufferMinutes: intSetting_(map.buffer_minutes, 0, 0, 240)
  };
}

function intSetting_(value, fallback, min, max) {
  var parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}

function saveSetting_(key, value) {
  var current = findBy_('Settings', 'key', key);
  if (current) updateRecord_('Settings', 'key', key, { key: key, value: String(value) });
  else appendRecord_('Settings', { key: key, value: String(value) });
}

function scheduleWindowsDummy_(date, settings) {
  return scheduleWindows_(date, settings);
}

function getDatabase_() {
  if (REQUEST_SPREADSHEET_) return REQUEST_SPREADSHEET_;
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(DB_PROPERTY_);
  if (!id) throw new Error('Database is not initialized. Run setupSalonDatabase() first.');
  REQUEST_SPREADSHEET_ = SpreadsheetApp.openById(id);
  return REQUEST_SPREADSHEET_;
}

function getSheet_(name) {
  var db = getDatabase_();
  var sheet = db.getSheetByName(name);
  if (!sheet) throw new Error('Sheet ' + name + ' is missing from the database.');
  return sheet;
}

function readTable_(name) {
  if (REQUEST_TABLE_CACHE_[name]) return REQUEST_TABLE_CACHE_[name];
  var sheet = getSheet_(name);
  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();
  if (lastRow < 2 || lastColumn < 1) {
    REQUEST_TABLE_CACHE_[name] = [];
    return REQUEST_TABLE_CACHE_[name];
  }
  var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(String);
  var values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  var rows = values.map(function (row) {
    var record = {};
    for (var index = 0; index < headers.length; index += 1) {
      record[headers[index]] = normalizeSheetCell_(headers[index], row[index]);
    }
    return record;
  });
  REQUEST_TABLE_CACHE_[name] = rows;
  return rows;
}

function normalizeSheetCell_(column, value) {
  if (value instanceof Date) {
    var tz = REQUEST_SPREADSHEET_ ? REQUEST_SPREADSHEET_.getSpreadsheetTimeZone() : 'Asia/Tehran';
    if (column === 'date') return Utilities.formatDate(value, tz, 'yyyy-MM-dd');
    if (column === 'time') return Utilities.formatDate(value, tz, 'HH:mm');
    return value.toISOString();
  }
  return value === null || value === undefined ? '' : String(value);
}

function rowDateKey_(row, timezone) {
  if (row.date) return row.date;
  var timestamp = row.startsAt || row.createdAt;
  if (!timestamp) return '';
  return getLocalDateKey_(new Date(timestamp), timezone);
}

function rowClock_(row, timezone) {
  if (row.time) return row.time;
  var timestamp = row.startsAt || row.createdAt;
  if (!timestamp) return '';
  return clockForInstant_(new Date(timestamp), timezone);
}

function rowStartMs_(row, timezone) {
  if (row.startsAt) {
    var parsed = new Date(row.startsAt).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }
  var date = rowDateKey_(row, timezone);
  var time = rowClock_(row, timezone);
  var fallback = parseDateKey_(date, time, timezone);
  return fallback ? fallback.getTime() : 0;
}

function rowEndMs_(row, timezone) {
  if (row.endsAt) {
    var parsed = new Date(row.endsAt).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }
  return rowStartMs_(row, timezone) + Number(row.durationMinutes || 0) * 60 * 1000;
}

function appendRecord_(table, record) {
  var sheet = getSheet_(table);
  var headers = TABLES_[table];
  var row = headers.map(function (h) { return record[h] === undefined ? '' : String(record[h]); });
  sheet.appendRow(row);
  delete REQUEST_TABLE_CACHE_[table];
}

function findBy_(table, key, value) {
  return readTable_(table).find(function (row) { return row[key] === String(value); }) || null;
}

function updateRecord_(table, keyName, keyValue, record) {
  var sheet = getSheet_(table);
  var headers = TABLES_[table];
  var keyCol = headers.indexOf(keyName) + 1;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var keys = sheet.getRange(2, keyCol, lastRow - 1, 1).getValues();
  for (var index = 0; index < keys.length; index += 1) {
    if (String(keys[index][0]) === String(keyValue)) {
      var row = headers.map(function (h) { return record[h] === undefined ? '' : String(record[h]); });
      sheet.getRange(index + 2, 1, 1, headers.length).setValues([row]);
      delete REQUEST_TABLE_CACHE_[table];
      return;
    }
  }
}

function deleteRecord_(table, keyName, keyValue) {
  var sheet = getSheet_(table);
  var headers = TABLES_[table];
  var keyCol = headers.indexOf(keyName) + 1;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var keys = sheet.getRange(2, keyCol, lastRow - 1, 1).getValues();
  for (var index = 0; index < keys.length; index += 1) {
    if (String(keys[index][0]) === String(keyValue)) {
      sheet.deleteRow(index + 2);
      delete REQUEST_TABLE_CACHE_[table];
      return;
    }
  }
}

function sendBookingNotifications_(booking, service, source) {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty(EMAIL_NOTIFICATIONS_PROPERTY_) !== 'true') {
    // Email notifications disabled by owner.
  } else {
    var recipient = props.getProperty(NOTIFICATION_PROPERTY_);
    if (recipient) {
      try {
        sendBookingEmail_(recipient, booking, service, source);
      } catch (emailError) {
        Logger.log('Email delivery failed: ' + String(emailError));
      }
    }
  }

  try {
    sendPushNotifications_(booking, service);
  } catch (pushError) {
    Logger.log('Push dispatch skipped or failed: ' + String(pushError));
  }
}

function getNotificationSettings_() {
  var props = PropertiesService.getScriptProperties();
  var recipient = props.getProperty(NOTIFICATION_PROPERTY_) || '';
  var enabled = props.getProperty(EMAIL_NOTIFICATIONS_PROPERTY_) === 'true';
  return {
    status: 200,
    payload: {
      ok: true,
      emailNotifications: enabled,
      recipientEmail: recipient,
      firebaseProjectId: props.getProperty(FIREBASE_PROJECT_PROPERTY_) || ''
    }
  };
}

function saveNotificationSettings_(input, owner) {
  var props = PropertiesService.getScriptProperties();
  if (typeof input.emailNotifications === 'boolean') {
    props.setProperty(EMAIL_NOTIFICATIONS_PROPERTY_, String(input.emailNotifications));
  }
  if (input.recipientEmail !== undefined) {
    setSalonNotificationEmail(input.recipientEmail);
  }
  if (input.firebaseProjectId !== undefined) {
    props.setProperty(FIREBASE_PROJECT_PROPERTY_, String(input.firebaseProjectId).trim());
  }
  audit_('salon.notification_settings_updated', owner.id, 'settings', 'notifications', {
    emailNotifications: input.emailNotifications, recipientEmail: input.recipientEmail
  });
  return getNotificationSettings_();
}

function savePushSubscription_(input, owner) {
  var token = String(input.token || '').trim();
  if (!token) return error_(400, 'missing_token', 'توکن پیام‌رسان الزامی است.');
  var existing = findBy_('PushSubscriptions', 'token', token);
  var record = {
    token: token,
    device: String(input.device || 'android').trim(),
    isActive: 'true',
    createdAt: existing ? existing.createdAt : nowIso_(),
    updatedAt: nowIso_()
  };
  if (existing) updateRecord_('PushSubscriptions', 'token', token, record);
  else appendRecord_('PushSubscriptions', record);
  return { status: 200, payload: { ok: true } };
}

function removePushSubscription_(input, owner) {
  var token = String(input.token || '').trim();
  if (token) deleteRecord_('PushSubscriptions', 'token', token);
  return { status: 200, payload: { ok: true } };
}

function sendTestPush_(owner) {
  var count = sendPushPayload_({
    title: 'تست سامانه اعلان آرایشگاه شایان',
    body: 'این یک اعلان آزمایشی از پنل مدیریت است.'
  });
  return { status: 200, payload: { ok: true, deliveredDevices: count } };
}

function sendPushNotifications_(booking, service) {
  sendPushPayload_({
    title: 'نوبت جدید ثبت شد: ' + booking.name,
    body: service.name + ' · ' + booking.date + ' ساعت ' + booking.time + ' · ' + booking.phone,
    reference: booking.reference
  });
}

function sendPushPayload_(notification) {
  var projectId = PropertiesService.getScriptProperties().getProperty(FIREBASE_PROJECT_PROPERTY_);
  if (!projectId) return 0;

  var subscriptions = readTable_('PushSubscriptions').filter(function (row) { return bool_(row.isActive); });
  if (!subscriptions.length) return 0;

  var token;
  try {
    token = ScriptApp.getOAuthToken();
  } catch (error) {
    Logger.log('OAuth token generation failed: ' + String(error));
    return 0;
  }

  var url = 'https://fcm.googleapis.com/v1/projects/' + projectId + '/messages:send';
  var delivered = 0;

  subscriptions.forEach(function (sub) {
    try {
      var payload = {
        message: {
          token: sub.token,
          notification: {
            title: notification.title,
            body: notification.body
          },
          data: {
            reference: notification.reference || '',
            url: '/admin'
          }
        }
      };
      var response = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + token },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
      if (response.getResponseCode() >= 200 && response.getResponseCode() < 300) {
        delivered += 1;
      } else if (response.getResponseCode() === 404 || response.getResponseCode() === 410) {
        deleteRecord_('PushSubscriptions', 'token', sub.token);
      }
    } catch (deliveryError) {
      Logger.log('Push send error: ' + String(deliveryError));
    }
  });

  return delivered;
}

function sendBookingEmail_(toEmail, booking, service, source) {
  var subject = 'نوبت جدید آرایشگاه شایان: ' + booking.name + ' (' + booking.date + ' ' + booking.time + ')';
  var body = [
    'یک نوبت جدید در سامانه رزرو ثبت شد:',
    '',
    '• مراجع: ' + booking.name,
    '• شماره تماس: ' + booking.phone,
    '• خدمت: ' + service.name + ' (' + service.durationMinutes + ' دقیقه)',
    '• تاریخ و ساعت: ' + booking.date + ' ساعت ' + booking.time,
    '• کد رهگیری: ' + booking.reference,
    '• نوع ثبت: ' + (source === 'manual' ? 'تلفنی / دستی' : 'رزرو آنلاین وب‌سایت'),
    booking.note ? ('• یادداشت: ' + booking.note) : '',
    '',
    'این ایمیل به‌صورت خودکار از سوی سامانه رزرواسیون آرایشگاه شایان ارسال شده است.'
  ].filter(Boolean).join('\n');

  MailApp.sendEmail(toEmail, subject, body);
}

function audit_(action, actorId, entityType, entityId, details) {
  try {
    appendRecord_('AuditLog', {
      id: uuid_(),
      actorId: actorId || 'system',
      action: action,
      entityType: entityType,
      entityId: String(entityId),
      detailsJson: JSON.stringify(details || {}),
      createdAt: nowIso_()
    });
  } catch (error) {
    Logger.log('Audit log append failed: ' + String(error));
  }
}

function setSession_(user) {
  var sessionId = randomHex_() + randomHex_();
  var sessionHash = sha256_(sessionId);
  var expiresAt = new Date(Date.now() + SESSION_TTL_ * 1000).toISOString();
  var record = {
    sessionIdHash: sessionHash,
    userId: user.id,
    username: user.username,
    expiresAt: expiresAt,
    createdAt: nowIso_()
  };
  appendRecord_('AdminSessions', record);
  try {
    CacheService.getScriptCache().put(sessionKey_(sessionHash), JSON.stringify(record), SESSION_CACHE_TTL_);
  } catch (ignored) {}
  return { id: sessionId, record: record };
}

function getSession_(sessionId) {
  if (!sessionId) return null;
  var sessionHash = sha256_(sessionId);
  var key = sessionKey_(sessionHash);
  var cache = CacheService.getScriptCache();
  var cached = cache.get(key);
  var session;
  if (cached) {
    try { session = JSON.parse(cached); } catch (e) {}
  }
  if (!session) {
    session = findBy_('AdminSessions', 'sessionIdHash', sessionHash);
    if (session) {
      try { cache.put(key, JSON.stringify(session), SESSION_CACHE_TTL_); } catch (ignored) {}
    }
  }
  if (!session) return null;
  var expires = new Date(session.expiresAt).getTime();
  if (Number.isNaN(expires) || expires <= Date.now()) {
    deleteRecord_('AdminSessions', 'sessionIdHash', sessionHash);
    try { cache.remove(key); } catch (ignored) {}
    return null;
  }
  if (expires - Date.now() < SESSION_RENEWAL_WINDOW_) {
    var renewed = new Date(Date.now() + SESSION_TTL_ * 1000).toISOString();
    var updated = Object.assign({}, session, { expiresAt: renewed });
    updateRecord_('AdminSessions', 'sessionIdHash', sessionHash, updated);
    try { cache.put(key, JSON.stringify(updated), SESSION_CACHE_TTL_); } catch (ignored) {}
  }
  return { id: session.userId, username: session.username };
}

function revokeSession_(sessionId) {
  var sessionHash = sha256_(sessionId);
  deleteRecord_('AdminSessions', 'sessionIdHash', sessionHash);
  try { CacheService.getScriptCache().remove(sessionKey_(sessionHash)); } catch (ignored) {}
}

function sessionKey_(hash) {
  return 'sess_' + hash.slice(0, 32);
}

function rateLimit_(key, limit, windowSeconds) {
  return rateLimited_(key, limit, windowSeconds);
}

function rateLimited_(key, limit, windowSeconds) {
  try {
    var cache = CacheService.getScriptCache();
    var current = Number(cache.get('rl_' + key) || 0);
    if (current >= limit) return true;
    cache.put('rl_' + key, String(current + 1), windowSeconds);
    return false;
  } catch (error) {
    return false;
  }
}

function requireOwnerEditor_() {
  var user = Session.getEffectiveUser();
  if (!user || !user.getEmail()) {
    throw new Error('This operation must be executed by the script owner in the Google Apps Script editor.');
  }
}

function parseQuery_(raw) {
  var out = {};
  raw.split('&').forEach(function (pair) {
    if (!pair) return;
    var eq = pair.indexOf('=');
    var key = decodeURIComponent(eq === -1 ? pair : pair.slice(0, eq));
    var val = decodeURIComponent(eq === -1 ? '' : pair.slice(eq + 1));
    out[key] = val;
  });
  return out;
}

function normalizeHeaders_(raw) {
  var out = {};
  if (!raw || typeof raw !== 'object') return out;
  Object.keys(raw).forEach(function (k) { out[k.toLowerCase()] = raw[k]; });
  return out;
}

function parseJson_(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function result_(status, payload) {
  return { status: status, payload: payload };
}

function error_(status, error, message) {
  return { status: status, payload: { ok: false, error: error, message: message } };
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
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end) || start >= end) {
      return null;
    }
    result.push({ startsAt: start, endsAt: end });
  }
  result.sort(function (a, b) { return a.startsAt.localeCompare(b.startsAt); });
  for (var i = 1; i < result.length; i += 1) {
    if (result[i].startsAt < result[i - 1].endsAt) return null;
  }
  return result;
}

function parseDateKey_(dateKey, time, timezone) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  var parts = dateKey.split('-');
  var clock = time.split(':');
  var year = Number(parts[0]);
  var month = Number(parts[1]);
  var day = Number(parts[2]);
  var hour = Number(clock[0]);
  var minute = Number(clock[1]);
  return localDateTimeToUtc_(year, month, day, hour, minute, timezone);
}

function validTimezone_(name) {
  try {
    Utilities.formatDate(new Date(), name, 'yyyy');
    return true;
  } catch (e) {
    return false;
  }
}

function getZonedParts_(date, timezone) {
  var formatted = Utilities.formatDate(date, timezone, 'yyyy-MM-dd-HH-mm-ss-u');
  var p = formatted.split('-');
  return {
    year: Number(p[0]),
    month: Number(p[1]),
    day: Number(p[2]),
    hour: Number(p[3]),
    minute: Number(p[4]),
    second: Number(p[5]),
    weekday: Number(p[6]) % 7 // 1 (Mon)..7 (Sun) -> map Sunday 7 to 0
  };
}

function getLocalDateKey_(date, timezone) {
  return Utilities.formatDate(date, timezone, 'yyyy-MM-dd');
}

function getLocalMinuteOfDay_(date, timezone) {
  var p = getZonedParts_(date, timezone);
  return p.hour * 60 + p.minute;
}

function localDateTimeToUtc_(year, month, day, hour, minute, timezone) {
  var guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  for (var iteration = 0; iteration < 4; iteration += 1) {
    var parts = getZonedParts_(guess, timezone);
    var diffMinutes = (year - parts.year) * 525600 +
      (month - parts.month) * 43200 +
      (day - parts.day) * 1440 +
      (hour - parts.hour) * 60 +
      (minute - parts.minute);
    if (diffMinutes === 0) return guess;
    guess = new Date(guess.getTime() + diffMinutes * 60000);
  }
  return guess;
}

function addDays_(date, days) {
  return new Date(date.getTime() + days * 86400000);
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
