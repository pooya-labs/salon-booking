import { handleAdminRequest, type AdminEnv } from './admin-api'
import {
  addMinutesToTime,
  getLocalDateKey,
  isValidIanaTimeZone,
  localDateTimeToUtc,
  minutesBetweenTimes,
  parseDateKey,
} from './scheduling'
import { createRateLimitBucketHash, getRateLimitWindow } from './rate-limit'
import {
  isBookingCancellable,
  isValidBookingReference,
  isValidIdempotencyKey,
  verifyBookingManagementToken,
} from './customer-booking-security'
import {
  isSameOriginRequest,
  sha256Hex,
} from './admin-security'

interface Env extends AdminEnv {
  ASSETS: { fetch(request: Request): Promise<Response> }
}

interface ServiceRow {
  id: string
  name: string
  description: string
  duration_minutes: number
  price_amount: number
  price_currency: string
}

interface Settings {
  timezone: string
  slotInterval: number
  minNotice: number
  maxDaysAhead: number
  bufferMinutes: number
}

interface BookingInput {
  serviceId?: unknown
  date?: unknown
  time?: unknown
  name?: unknown
  phone?: unknown
  note?: unknown
  reference?: unknown
  managementToken?: unknown
}

interface ManagedBookingRow {
  id: string
  reference_code: string
  client_manage_token_hash: string | null
  starts_at: string
  ends_at: string
  status: string
  service_name: string
  duration_minutes: number
}

interface OpeningHoursRow {
  opens_at: string | null
  closes_at: string | null
  is_closed: number
}

interface ExceptionRow {
  id: string
  starts_at: string | null
  ends_at: string | null
  is_closed: number
}

interface BookingRow {
  starts_at: string
  ends_at: string
}

const json = (data: unknown, status = 200, extraHeaders?: Record<string, string>) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      ...extraHeaders,
    },
  })

const errorResponse = (
  error: string,
  message: string,
  status: number,
  extraHeaders?: Record<string, string>,
) => json({ ok: false, error, message }, status, extraHeaders)

const enforcePublicRateLimit = async (
  db: D1Database,
  request: Request,
  secret: string | undefined,
  scope: 'availability' | 'booking' | 'booking_manage',
  limit: number,
  windowSeconds: number,
): Promise<Response | null> => {
  if (!secret || secret.length < 32) {
    return errorResponse('rate_limit_not_configured', 'تنظیمات امنیتی محدودسازی درخواست آماده نیست.', 503)
  }

  const ip = request.headers.get('cf-connecting-ip')?.trim()
  if (!ip || ip.length > 64) {
    return errorResponse('rate_limit_unavailable', 'اطلاعات لازم برای کنترل درخواست در دسترس نیست.', 503)
  }

  try {
    const now = Math.floor(Date.now() / 1000)
    const window = getRateLimitWindow(now, windowSeconds)
    const bucketHash = await createRateLimitBucketHash(secret, `public:${scope}`, ip)

    // Expiry is indexed; prune stale buckets so the table does not grow forever.
    await db.prepare('DELETE FROM public_rate_limits WHERE expires_at <= ?')
      .bind(now)
      .run()

    const result = await db.prepare(
      `INSERT INTO public_rate_limits (bucket_hash, window_started_at, attempts, expires_at)
       VALUES (?, ?, 1, ?)
       ON CONFLICT(bucket_hash) DO UPDATE SET
         attempts = CASE
           WHEN public_rate_limits.window_started_at = excluded.window_started_at
           THEN public_rate_limits.attempts + 1
           ELSE 1
         END,
         window_started_at = excluded.window_started_at,
         expires_at = excluded.expires_at
       RETURNING attempts`,
    ).bind(bucketHash, window.startedAt, window.expiresAt).first<{ attempts: number }>()

    if (!result) return errorResponse('rate_limit_unavailable', 'کنترل تعداد درخواست‌ها ممکن نیست.', 503)
    if (result.attempts > limit) {
      return errorResponse(
        'rate_limited',
        'تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.',
        429,
        { 'retry-after': String(window.retryAfter) },
      )
    }
    return null
  } catch {
    // Fail closed: never bypass abuse controls when the limiter/database fails.
    return errorResponse('rate_limit_unavailable', 'کنترل تعداد درخواست‌ها در حال حاضر ممکن نیست.', 503)
  }
}

const normalizeDigits = (value: string) =>
  value
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))

const normalizePhone = (value: string) => {
  const normalized = normalizeDigits(value).replace(/[\s()-]/g, '')
  return /^\+?[0-9]{8,15}$/.test(normalized) ? normalized : null
}

const getSettings = async (db: D1Database): Promise<Settings> => {
  const result = await db
    .prepare('SELECT setting_key, setting_value FROM salon_settings')
    .all<{ setting_key: string; setting_value: string }>()

  const values = Object.fromEntries(
    (result.results ?? []).map((row) => [row.setting_key, row.setting_value]),
  )

  const numberSetting = (key: string, fallback: number, min: number, max: number) => {
    const parsed = Number(values[key])
    return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback
  }

  const timezone = values.local_timezone ?? 'unset'
  if (timezone !== 'unset' && !isValidIanaTimeZone(timezone)) {
    throw new Error('invalid_salon_timezone')
  }

  return {
    timezone,
    slotInterval: numberSetting('slot_interval_minutes', 15, 5, 120),
    minNotice: numberSetting('min_booking_notice_minutes', 120, 0, 10080),
    maxDaysAhead: numberSetting('booking_window_days', 30, 1, 365),
    bufferMinutes: numberSetting('buffer_minutes', 0, 0, 240),
  }
}

const dateDayNumber = (dateKey: string) => {
  const date = parseDateKey(dateKey)
  return date ? Math.floor(Date.UTC(date.year, date.month - 1, date.day) / 86400000) : null
}

const getScheduleWindows = async (
  db: D1Database,
  dateKey: string,
): Promise<Array<{ start: string; end: string }> | null> => {
  const exception = await db
    .prepare('SELECT id, starts_at, ends_at, is_closed FROM schedule_exceptions WHERE local_date = ?')
    .bind(dateKey)
    .first<ExceptionRow>()

  if (exception) {
    if (exception.is_closed === 1) return null
    const intervals = await db
      .prepare('SELECT starts_at, ends_at FROM schedule_exception_intervals WHERE exception_id = ? ORDER BY position')
      .bind(exception.id)
      .all<{ starts_at: string; ends_at: string }>()
    const valid = (intervals.results ?? [])
      .filter((row) => minutesBetweenTimes(row.starts_at, row.ends_at) !== null)
      .map((row) => ({ start: row.starts_at, end: row.ends_at }))
    if (valid.length) return valid
    if (exception.starts_at && exception.ends_at && minutesBetweenTimes(exception.starts_at, exception.ends_at) !== null) {
      return [{ start: exception.starts_at, end: exception.ends_at }]
    }
    return null
  }

  const parts = parseDateKey(dateKey)
  if (!parts) return null
  const weekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()
  const hours = await db
    .prepare('SELECT opens_at, closes_at, is_closed FROM opening_hours WHERE weekday = ?')
    .bind(weekday)
    .first<OpeningHoursRow>()

  if (!hours || hours.is_closed === 1) return null
  const intervals = await db
    .prepare('SELECT starts_at, ends_at FROM opening_hour_intervals WHERE weekday = ? ORDER BY position')
    .bind(weekday)
    .all<{ starts_at: string; ends_at: string }>()
  const valid = (intervals.results ?? [])
    .filter((row) => minutesBetweenTimes(row.starts_at, row.ends_at) !== null)
    .map((row) => ({ start: row.starts_at, end: row.ends_at }))
  if (valid.length) return valid
  if (hours.opens_at && hours.closes_at && minutesBetweenTimes(hours.opens_at, hours.closes_at) !== null) {
    return [{ start: hours.opens_at, end: hours.closes_at }]
  }
  return null
}

const getAvailability = async (
  db: D1Database,
  settings: Settings,
  service: ServiceRow,
  dateKey: string,
): Promise<{ slots: string[]; date: string; timezone: string }> => {
  const parsedDate = parseDateKey(dateKey)
  if (!parsedDate) throw new Error('invalid_date')
  if (settings.timezone === 'unset') throw new Error('schedule_not_configured')

  const todayKey = getLocalDateKey(new Date(), settings.timezone)
  const todayNumber = dateDayNumber(todayKey)
  const requestedNumber = dateDayNumber(dateKey)
  if (todayNumber === null || requestedNumber === null) throw new Error('invalid_date')
  const daysAhead = requestedNumber - todayNumber
  if (daysAhead < 0 || daysAhead > settings.maxDaysAhead) throw new Error('date_out_of_range')

  const windows = await getScheduleWindows(db, dateKey)
  if (!windows?.length) return { slots: [], date: dateKey, timezone: settings.timezone }

  const dayStart = localDateTimeToUtc(dateKey, '00:00', settings.timezone)
  const nextDate = new Date(Date.UTC(parsedDate.year, parsedDate.month - 1, parsedDate.day + 1))
  const nextDateKey = [
    String(nextDate.getUTCFullYear()).padStart(4, '0'),
    String(nextDate.getUTCMonth() + 1).padStart(2, '0'),
    String(nextDate.getUTCDate()).padStart(2, '0'),
  ].join('-')
  const dayEnd = localDateTimeToUtc(nextDateKey, '00:00', settings.timezone)
  if (!dayStart || !dayEnd) throw new Error('invalid_salon_timezone')

  const bookings = await db
    .prepare(
      `SELECT starts_at, ends_at FROM bookings
       WHERE status IN ('pending', 'confirmed')
         AND starts_at < ? AND ends_at > ?`,
    )
    .bind(dayEnd.toISOString(), dayStart.toISOString())
    .all<BookingRow>()

  const occupied = (bookings.results ?? []).map((booking) => ({
    start: Date.parse(booking.starts_at),
    end: Date.parse(booking.ends_at),
  }))

  const bookingDuration = service.duration_minutes + settings.bufferMinutes
  const nowWithNotice = Date.now() + settings.minNotice * 60000
  const slotSet = new Set<string>()

  for (const window of windows) {
    const openMinutes = Number(window.start.slice(0, 2)) * 60 + Number(window.start.slice(3, 5))
    const closeMinutes = Number(window.end.slice(0, 2)) * 60 + Number(window.end.slice(3, 5))

    for (
      let startMinutes = openMinutes;
      startMinutes + bookingDuration <= closeMinutes;
      startMinutes += settings.slotInterval
    ) {
      const time = String(Math.floor(startMinutes / 60)).padStart(2, '0') + ':' + String(startMinutes % 60).padStart(2, '0')
      const endTime = addMinutesToTime(time, bookingDuration)
      if (!endTime) continue

      const start = localDateTimeToUtc(dateKey, time, settings.timezone)
      const end = localDateTimeToUtc(dateKey, endTime, settings.timezone)
      if (!start || !end || start.getTime() < nowWithNotice) continue

      const overlaps = occupied.some((booking) =>
        start.getTime() < booking.end && end.getTime() > booking.start,
      )
      if (!overlaps) slotSet.add(time)
    }
  }

  const slots = [...slotSet].sort()
  return { slots, date: dateKey, timezone: settings.timezone }
}

const makeReference = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(7))
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = 'SB-'
  for (const byte of bytes) result += alphabet[byte % alphabet.length]
  return result
}

const readJsonBody = async (request: Request): Promise<BookingInput | null> => {
  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) return null

  try {
    const raw = await request.text()
    if (raw.length > 8192) return null
    const body: unknown = JSON.parse(raw)
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null
    return body as BookingInput
  } catch {
    return null
  }
}

const handlePublicServices = async (db: D1Database) => {
  const result = await db
    .prepare(
      `SELECT id, name, description, duration_minutes, price_amount, price_currency
       FROM services WHERE is_active = 1 ORDER BY sort_order ASC, name COLLATE NOCASE ASC`,
    )
    .all<ServiceRow>()

  return json({
    ok: true,
    services: (result.results ?? []).map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description,
      durationMinutes: service.duration_minutes,
      priceAmount: service.price_amount,
      priceCurrency: service.price_currency,
    })),
  })
}

const handleAvailability = async (request: Request, db: D1Database) => {
  const url = new URL(request.url)
  const date = url.searchParams.get('date') ?? ''
  const serviceId = url.searchParams.get('serviceId') ?? ''

  if (!parseDateKey(date)) return errorResponse('invalid_date', 'تاریخ واردشده معتبر نیست.', 400)
  if (!serviceId || serviceId.length > 80) {
    return errorResponse('invalid_service', 'خدمت انتخاب‌شده معتبر نیست.', 400)
  }

  const service = await db
    .prepare(
      `SELECT id, name, description, duration_minutes, price_amount, price_currency
       FROM services WHERE id = ? AND is_active = 1`,
    )
    .bind(serviceId)
    .first<ServiceRow>()

  if (!service) return errorResponse('service_not_found', 'این خدمت در دسترس نیست.', 404)

  const settings = await getSettings(db)
  try {
    const availability = await getAvailability(db, settings, service, date)
    return json({ ok: true, ...availability })
  } catch (error) {
    if (error instanceof Error && error.message === 'date_out_of_range') {
      return errorResponse('date_out_of_range', 'این تاریخ خارج از بازه رزرو است.', 400)
    }
    if (error instanceof Error && error.message === 'schedule_not_configured') {
      return errorResponse('schedule_not_configured', 'برنامه کاری استودیو هنوز تنظیم نشده است.', 503)
    }
    throw error
  }
}

interface BookingIdempotencyRow {
  request_hash: string
  response_json: string
}

interface StoredBookingResponse {
  reference: string
  status: 'pending'
  serviceName: string
  date: string
  time: string
  durationMinutes: number
}

const replayIdempotentBooking = async (
  db: D1Database,
  idempotencyKeyHash: string,
  requestHash: string,
  idempotencyKey: string,
): Promise<Response | null> => {
  const record = await db.prepare(
    `SELECT request_hash, response_json
     FROM booking_idempotency
     WHERE idempotency_key_hash = ?
     LIMIT 1`,
  ).bind(idempotencyKeyHash).first<BookingIdempotencyRow>()

  if (!record) return null
  if (record.request_hash !== requestHash) {
    return errorResponse(
      'idempotency_key_reused',
      'کلید ثبت قبلاً برای اطلاعات دیگری استفاده شده است.',
      409,
    )
  }

  const booking = JSON.parse(record.response_json) as StoredBookingResponse
  const managementToken = await sha256Hex(`salon-booking-management-token:${idempotencyKey}`)

  return json({
    ok: true,
    booking: { ...booking, managementToken },
    replayed: true,
  }, 200)
}

const handleCreateBooking = async (request: Request, db: D1Database) => {
  const input = await readJsonBody(request)
  if (!input) return errorResponse('invalid_request', 'درخواست معتبر نیست.', 400)

  const idempotencyKey = request.headers.get('idempotency-key')
  if (!isValidIdempotencyKey(idempotencyKey)) {
    return errorResponse('idempotency_key_required', 'کلید یکتای ثبت نوبت معتبر نیست؛ دوباره تلاش کنید.', 400)
  }

  const serviceId = typeof input.serviceId === 'string' ? input.serviceId.trim() : ''
  const date = typeof input.date === 'string' ? input.date : ''
  const time = typeof input.time === 'string' ? input.time : ''
  const name = typeof input.name === 'string' ? input.name.trim().replace(/\s+/g, ' ') : ''
  const phone = typeof input.phone === 'string' ? normalizePhone(input.phone) : null
  const note = typeof input.note === 'string' ? input.note.trim().slice(0, 500) : ''

  if (!serviceId || serviceId.length > 80) {
    return errorResponse('invalid_service', 'خدمت انتخاب‌شده معتبر نیست.', 400)
  }
  if (!parseDateKey(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return errorResponse('invalid_datetime', 'تاریخ یا ساعت معتبر نیست.', 400)
  }
  if (name.length < 2 || name.length > 80) {
    return errorResponse('invalid_name', 'نام باید بین ۲ تا ۸۰ نویسه باشد.', 400)
  }
  if (!phone) return errorResponse('invalid_phone', 'شماره تماس معتبر نیست.', 400)
  if (typeof input.note === 'string' && input.note.length > 1000) {
    return errorResponse('invalid_note', 'متن توضیحات بیش از حد طولانی است.', 400)
  }

  // The client key contains 256 random bits. Domain-separated SHA-256 digests
  // let retries recover the same token without storing either raw key or PII.
  const idempotencyKeyHash = await sha256Hex(`salon-booking-idempotency:${idempotencyKey}`)
  const requestFingerprint = JSON.stringify({ serviceId, date, time, name, phone, note })
  const requestHash = await sha256Hex(`salon-booking-request:${idempotencyKey}:${requestFingerprint}`)
  const replay = await replayIdempotentBooking(
    db,
    idempotencyKeyHash,
    requestHash,
    idempotencyKey,
    )
  if (replay) return replay

  const service = await db
    .prepare(
      `SELECT id, name, description, duration_minutes, price_amount, price_currency
       FROM services WHERE id = ? AND is_active = 1`,
    )
    .bind(serviceId)
    .first<ServiceRow>()

  if (!service) return errorResponse('service_not_found', 'این خدمت در دسترس نیست.', 404)

  const settings = await getSettings(db)
  if (settings.timezone === 'unset') {
    return errorResponse('schedule_not_configured', 'برنامه کاری استودیو هنوز تنظیم نشده است.', 503)
  }

  let availability: { slots: string[]; date: string; timezone: string }
  try {
    availability = await getAvailability(db, settings, service, date)
  } catch (error) {
    if (error instanceof Error && error.message === 'date_out_of_range') {
      return errorResponse('date_out_of_range', 'این تاریخ خارج از بازه رزرو است.', 400)
    }
    if (error instanceof Error && error.message === 'schedule_not_configured') {
      return errorResponse('schedule_not_configured', 'برنامه کاری استودیو هنوز تنظیم نشده است.', 503)
    }
    throw error
  }

  if (!availability.slots.includes(time)) {
    return errorResponse('slot_unavailable', 'این زمان دیگر در دسترس نیست؛ زمان دیگری انتخاب کنید.', 409)
  }

  const endsAtTime = addMinutesToTime(time, service.duration_minutes + settings.bufferMinutes)
  const startsAt = localDateTimeToUtc(date, time, settings.timezone)
  const endsAt = endsAtTime ? localDateTimeToUtc(date, endsAtTime, settings.timezone) : null
  if (!startsAt || !endsAt) {
    return errorResponse('invalid_datetime', 'این ساعت در منطقه زمانی استودیو معتبر نیست.', 400)
  }

  const id = crypto.randomUUID()
  const reference = makeReference()
  const managementToken = await sha256Hex(`salon-booking-management-token:${idempotencyKey}`)
  const managementTokenHash = await sha256Hex(managementToken)
  const bookingResponse: StoredBookingResponse = {
    reference,
    status: 'pending',
    serviceName: service.name,
    date,
    time,
    durationMinutes: service.duration_minutes,
  }

  try {
    // D1 batch is transactional: the booking and its idempotency record either
    // commit together or roll back together if either unique constraint fails.
    await db.batch([
      db.prepare(
        `INSERT INTO bookings
          (id, reference_code, service_id, client_name, client_phone, starts_at, ends_at, status, client_note, client_manage_token_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      ).bind(
        id, reference, serviceId, name, phone,
        startsAt.toISOString(), endsAt.toISOString(), note, managementTokenHash,
      ),
      db.prepare(
        `INSERT INTO booking_idempotency
          (idempotency_key_hash, request_hash, booking_id, response_json)
         VALUES (?, ?, ?, ?)`,
      ).bind(idempotencyKeyHash, requestHash, id, JSON.stringify(bookingResponse)),
    ])
  } catch (error) {
    // A concurrent request with the same key may have committed first. Read
    // its result before interpreting the database error as a slot conflict.
    const concurrentReplay = await replayIdempotentBooking(
      db,
      idempotencyKeyHash,
      requestHash,
      idempotencyKey,
    )
    if (concurrentReplay) return concurrentReplay

    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('booking_time_conflict')) {
      return errorResponse('slot_unavailable', 'این زمان هم‌اکنون رزرو شده است؛ زمان دیگری انتخاب کنید.', 409)
    }
    if (message.toLowerCase().includes('unique')) {
      return errorResponse('booking_conflict', 'ثبت این نوبت انجام نشد؛ دوباره تلاش کنید.', 409)
    }
    throw error
  }

  return json({
    ok: true,
    booking: { ...bookingResponse, managementToken },
  }, 201)
}


const getManagedBooking = async (
  db: D1Database,
  referenceInput: unknown,
  managementTokenInput: unknown,
): Promise<ManagedBookingRow | null> => {
  const reference = typeof referenceInput === 'string' ? referenceInput.trim().toUpperCase() : ''
  const booking = isValidBookingReference(reference)
    ? await db.prepare(
      `SELECT bookings.id, bookings.reference_code, bookings.client_manage_token_hash,
              bookings.starts_at, bookings.ends_at, bookings.status,
              services.name AS service_name, services.duration_minutes
       FROM bookings
       INNER JOIN services ON services.id = bookings.service_id
       WHERE bookings.reference_code = ?
       LIMIT 1`,
    ).bind(reference).first<ManagedBookingRow>()
    : null

  // Token verification always hashes and compares a fixed-length value,
  // even when the reference is missing, to keep one generic public failure.
  const tokenMatches = await verifyBookingManagementToken(
    managementTokenInput,
    booking?.client_manage_token_hash ?? null,
  )
  if (!booking || !tokenMatches) return null
  return booking
}

const getSalonLocalDateTime = (isoTimestamp: string, timezone: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(isoTimestamp))
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  }
}

const managedBookingPayload = (booking: ManagedBookingRow, timezone: string) => {
  const local = getSalonLocalDateTime(booking.starts_at, timezone)
  const cancellable = isBookingCancellable(booking.status, booking.starts_at)
  return {
    reference: booking.reference_code,
    status: booking.status,
    serviceName: booking.service_name,
    date: local.date,
    time: local.time,
    durationMinutes: booking.duration_minutes,
    cancellable,
  }
}

const handleCustomerBookingManagement = async (
  request: Request,
  db: D1Database,
  action: 'lookup' | 'cancel',
) => {
  const input = await readJsonBody(request)
  if (!input) return errorResponse('invalid_request', 'درخواست معتبر نیست.', 400)

  const booking = await getManagedBooking(db, input.reference, input.managementToken)
  if (!booking) {
    return errorResponse('booking_access_invalid', 'کد پیگیری یا کلید محرمانه معتبر نیست.', 404)
  }

  const settings = await getSettings(db)
  if (settings.timezone === 'unset') {
    return errorResponse('schedule_not_configured', 'منطقه زمانی استودیو هنوز تنظیم نشده است.', 503)
  }

  if (action === 'lookup') {
    return json({ ok: true, booking: managedBookingPayload(booking, settings.timezone) })
  }

  if (booking.status === 'cancelled') {
    return json({ ok: true, alreadyCancelled: true, booking: managedBookingPayload(booking, settings.timezone) })
  }

  const now = new Date().toISOString()
  if (!isBookingCancellable(booking.status, booking.starts_at, Date.parse(now))) {
    return errorResponse('booking_not_cancellable', 'این نوبت دیگر از طریق سامانه قابل لغو نیست.', 409)
  }

  const updated = await db.prepare(
    `UPDATE bookings
     SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND status IN ('pending', 'confirmed') AND starts_at > ?`,
  ).bind(booking.id, now).run()

  if ((updated.meta.changes ?? 0) !== 1) {
    const refreshed = await db.prepare(
      `SELECT bookings.id, bookings.reference_code, bookings.client_manage_token_hash,
              bookings.starts_at, bookings.ends_at, bookings.status,
              services.name AS service_name, services.duration_minutes
       FROM bookings
       INNER JOIN services ON services.id = bookings.service_id
       WHERE bookings.id = ? LIMIT 1`,
    ).bind(booking.id).first<ManagedBookingRow>()
    if (refreshed?.status === 'cancelled') {
      return json({ ok: true, alreadyCancelled: true, booking: managedBookingPayload(refreshed, settings.timezone) })
    }
    return errorResponse('booking_not_cancellable', 'این نوبت دیگر از طریق سامانه قابل لغو نیست.', 409)
  }

  return json({
    ok: true,
    booking: managedBookingPayload({ ...booking, status: 'cancelled' }, settings.timezone),
  })
}

const handleWorkerRequest = async (request: Request, env: Env): Promise<Response> => {
    const url = new URL(request.url)

    const adminResponse = await handleAdminRequest(request, env)
    if (adminResponse) return adminResponse

    if (url.pathname === '/api/health') {
      return json({ ok: true, service: 'salon-booking-api', version: '0.6.0' })
    }

    if (url.pathname === '/api/public/config') {
      if (request.method !== 'GET') return errorResponse('method_not_allowed', 'روش درخواست پشتیبانی نمی‌شود.', 405)
      try {
        const settings = await getSettings(env.DB)
        return json({
          ok: true,
          configured: settings.timezone !== 'unset',
          timezone: settings.timezone === 'unset' ? null : settings.timezone,
          bookingWindowDays: settings.maxDaysAhead,
          slotIntervalMinutes: settings.slotInterval,
        })
      } catch {
        return errorResponse('configuration_unavailable', 'تنظیمات رزرو در دسترس نیست.', 503)
      }
    }

    if (url.pathname === '/api/public/services') {
      if (request.method !== 'GET') return errorResponse('method_not_allowed', 'روش درخواست پشتیبانی نمی‌شود.', 405)
      try {
        return await handlePublicServices(env.DB)
      } catch {
        return errorResponse('database_unavailable', 'دریافت خدمات در حال حاضر ممکن نیست.', 503)
      }
    }

    if (url.pathname === '/api/public/availability') {
      if (request.method !== 'GET') return errorResponse('method_not_allowed', 'روش درخواست پشتیبانی نمی‌شود.', 405)
      const limitResponse = await enforcePublicRateLimit(env.DB, request, env.SESSION_SECRET, 'availability', 180, 900)
      if (limitResponse) return limitResponse
      try {
        return await handleAvailability(request, env.DB)
      } catch (error) {
        if (error instanceof Error && error.message === 'schedule_not_configured') {
          return errorResponse('schedule_not_configured', 'برنامه کاری استودیو هنوز تنظیم نشده است.', 503)
        }
        return errorResponse('availability_unavailable', 'دریافت زمان‌های آزاد ممکن نیست.', 503)
      }
    }

    if (url.pathname === '/api/public/bookings') {
      if (request.method !== 'POST') return errorResponse('method_not_allowed', 'روش درخواست پشتیبانی نمی‌شود.', 405)
      const limitResponse = await enforcePublicRateLimit(env.DB, request, env.SESSION_SECRET, 'booking', 10, 900)
      if (limitResponse) return limitResponse
      try {
        return await handleCreateBooking(request, env.DB)
      } catch {
        return errorResponse('booking_unavailable', 'ثبت نوبت در حال حاضر ممکن نیست.', 503)
      }
    }

    if (url.pathname === '/api/public/bookings/lookup' || url.pathname === '/api/public/bookings/cancel') {
      if (request.method !== 'POST') return errorResponse('method_not_allowed', 'روش درخواست پشتیبانی نمی‌شود.', 405)
      if (!isSameOriginRequest(request)) return errorResponse('forbidden_origin', 'مبدأ درخواست معتبر نیست.', 403)
      const limitResponse = await enforcePublicRateLimit(env.DB, request, env.SESSION_SECRET, 'booking_manage', 20, 900)
      if (limitResponse) return limitResponse
      try {
        return await handleCustomerBookingManagement(
          request,
          env.DB,
          url.pathname.endsWith('/cancel') ? 'cancel' : 'lookup',
        )
      } catch {
        return errorResponse('booking_management_unavailable', 'مدیریت نوبت در حال حاضر ممکن نیست.', 503)
      }
    }


    if (url.pathname.startsWith('/api/')) {
      return errorResponse('not_found', 'این مسیر پیدا نشد.', 404)
    }

    if (url.pathname === '/admin' || url.pathname === '/admin/') {
      if (request.method !== 'GET') {
        return new Response('Method Not Allowed', { status: 405, headers: { allow: 'GET' } })
      }
      const target = new URL(request.url)
      target.pathname = '/'
      target.searchParams.set('admin', '1')
      return env.ASSETS.fetch(new Request(target.toString(), { method: 'GET', headers: request.headers }))
    }

    return env.ASSETS.fetch(request)
}

const withSecurityHeaders = (response: Response, request: Request): Response => {
  const headers = new Headers(response.headers)
  headers.set('x-content-type-options', 'nosniff')
  headers.set('x-frame-options', 'DENY')
  headers.set('referrer-policy', 'no-referrer')
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()')
  headers.set('cross-origin-resource-policy', 'same-origin')
  headers.set('cross-origin-opener-policy', 'same-origin')

  if (new URL(request.url).protocol === 'https:') {
    headers.set('strict-transport-security', 'max-age=31536000')
  }

  const contentType = headers.get('content-type') ?? ''
  if (contentType.toLowerCase().includes('text/html')) {
    headers.set(
      'content-security-policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; font-src 'self' data: https:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    )
  } else if (contentType.toLowerCase().includes('application/json')) {
    headers.set('content-security-policy', "default-src 'none'; base-uri 'none'; frame-ancestors 'none'")
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const response = await handleWorkerRequest(request, env)
    return withSecurityHeaders(response, request)
  },
}
