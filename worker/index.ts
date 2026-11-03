import {
  addMinutesToTime,
  getLocalDateKey,
  isValidIanaTimeZone,
  localDateTimeToUtc,
  minutesBetweenTimes,
  parseDateKey,
} from './scheduling'

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> }
  DB: D1Database
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
}

interface OpeningHoursRow {
  opens_at: string | null
  closes_at: string | null
  is_closed: number
}

interface ExceptionRow {
  starts_at: string | null
  ends_at: string | null
  is_closed: number
}

interface BookingRow {
  starts_at: string
  ends_at: string
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
    },
  })

const errorResponse = (error: string, message: string, status: number) =>
  json({ ok: false, error, message }, status)

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

const getScheduleWindow = async (
  db: D1Database,
  dateKey: string,
): Promise<{ start: string; end: string } | null> => {
  const exception = await db
    .prepare('SELECT starts_at, ends_at, is_closed FROM schedule_exceptions WHERE local_date = ?')
    .bind(dateKey)
    .first<ExceptionRow>()

  if (exception) {
    if (exception.is_closed === 1 || !exception.starts_at || !exception.ends_at) return null
    if (minutesBetweenTimes(exception.starts_at, exception.ends_at) === null) return null
    return { start: exception.starts_at, end: exception.ends_at }
  }

  const parts = parseDateKey(dateKey)
  if (!parts) return null
  const weekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()

  const hours = await db
    .prepare('SELECT opens_at, closes_at, is_closed FROM opening_hours WHERE weekday = ?')
    .bind(weekday)
    .first<OpeningHoursRow>()

  if (!hours || hours.is_closed === 1 || !hours.opens_at || !hours.closes_at) return null
  if (minutesBetweenTimes(hours.opens_at, hours.closes_at) === null) return null
  return { start: hours.opens_at, end: hours.closes_at }
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

  const window = await getScheduleWindow(db, dateKey)
  if (!window) return { slots: [], date: dateKey, timezone: settings.timezone }

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

  const openMinutes = Number(window.start.slice(0, 2)) * 60 + Number(window.start.slice(3, 5))
  const closeMinutes = Number(window.end.slice(0, 2)) * 60 + Number(window.end.slice(3, 5))
  const bookingDuration = service.duration_minutes + settings.bufferMinutes
  const nowWithNotice = Date.now() + settings.minNotice * 60000
  const slots: string[] = []

  for (
    let startMinutes = openMinutes;
    startMinutes + bookingDuration <= closeMinutes;
    startMinutes += settings.slotInterval
  ) {
    const time = `${String(Math.floor(startMinutes / 60)).padStart(2, '0')}:${String(startMinutes % 60).padStart(2, '0')}`
    const endTime = addMinutesToTime(time, bookingDuration)
    if (!endTime) continue

    const start = localDateTimeToUtc(dateKey, time, settings.timezone)
    const end = localDateTimeToUtc(dateKey, endTime, settings.timezone)
    if (!start || !end || start.getTime() < nowWithNotice) continue

    const overlaps = occupied.some((booking) =>
      start.getTime() < booking.end && end.getTime() > booking.start,
    )
    if (!overlaps) slots.push(time)
  }

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

const handleCreateBooking = async (request: Request, db: D1Database) => {
  const input = await readJsonBody(request)
  if (!input) return errorResponse('invalid_request', 'درخواست معتبر نیست.', 400)

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
  try {
    await db
      .prepare(
        `INSERT INTO bookings
          (id, reference_code, service_id, client_name, client_phone, starts_at, ends_at, status, client_note)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      )
      .bind(id, reference, serviceId, name, phone, startsAt.toISOString(), endsAt.toISOString(), note)
      .run()
  } catch (error) {
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
    booking: {
      reference,
      status: 'pending',
      serviceName: service.name,
      date,
      time,
      durationMinutes: service.duration_minutes,
    },
  }, 201)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/health') {
      return json({ ok: true, service: 'salon-booking-api', version: '0.2.0' })
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
      try {
        return await handleCreateBooking(request, env.DB)
      } catch {
        return errorResponse('booking_unavailable', 'ثبت نوبت در حال حاضر ممکن نیست.', 503)
      }
    }

    if (url.pathname.startsWith('/api/')) {
      return errorResponse('not_found', 'این مسیر پیدا نشد.', 404)
    }

    return env.ASSETS.fetch(request)
  },
}
