import {
  clearSessionCookie,
  constantTimeEqual,
  createPasswordHash,
  createSessionToken,
  getSessionCookie,
  hmacHex,
  isSameOriginRequest,
  sessionCookie,
  sha256Hex,
  validAdminUsername,
  verifyPasswordHash,
} from './admin-security'
import {
  getLocalDateKey,
  localDateTimeToUtc,
  parseDateKey,
  isValidIanaTimeZone,
  normalizeClockIntervals,
  type ClockInterval,
} from './scheduling'

export interface AdminEnv {
  DB: D1Database
  ADMIN_BOOTSTRAP_TOKEN?: string
  SESSION_SECRET?: string
}

interface AdminUser {
  id: string
  username: string
  password_hash: string
  is_active: number
}

interface AdminSessionUser {
  id: string
  username: string
}

interface BookingRow {
  id: string
  reference_code: string
  client_name: string
  client_phone: string
  starts_at: string
  ends_at: string
  status: string
  client_note: string
  service_name: string
  duration_minutes: number
}

interface AdminRequestBody {
  username?: unknown
  password?: unknown
  status?: unknown
  name?: unknown
  description?: unknown
  durationMinutes?: unknown
  priceAmount?: unknown
  priceCurrency?: unknown
  isActive?: unknown
  sortOrder?: unknown
  timezone?: unknown
  slotIntervalMinutes?: unknown
  minBookingNoticeMinutes?: unknown
  bookingWindowDays?: unknown
  bufferMinutes?: unknown
  weekday?: unknown
  opensAt?: unknown
  closesAt?: unknown
  date?: unknown
  startsAt?: unknown
  endsAt?: unknown
  note?: unknown
  isClosed?: unknown
  intervals?: unknown
}

const SESSION_TTL_SECONDS = 12 * 60 * 60

interface AdminServiceRow {
  id: string
  name: string
  description: string
  duration_minutes: number
  price_amount: number
  price_currency: string
  is_active: number
  sort_order: number
}

interface WeeklyHoursRow {
  weekday: number
  opens_at: string | null
  closes_at: string | null
  is_closed: number
}

interface ScheduleExceptionRow {
  id: string
  local_date: string
  starts_at: string | null
  ends_at: string | null
  is_closed: number
  note: string
}

interface WeeklyIntervalRow {
  weekday: number
  starts_at: string
  ends_at: string
  position: number
}

interface ExceptionIntervalRow {
  exception_id: string
  starts_at: string
  ends_at: string
  position: number
}

const WEEKDAY_NAMES = [
  'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه',
]
const WEEKDAY_ORDER = [6, 0, 1, 2, 3, 4, 5]

const readScheduleIntervals = (
  input: AdminRequestBody,
  legacyStart: unknown,
  legacyEnd: unknown,
): ClockInterval[] | null => {
  const source = Array.isArray(input.intervals)
    ? input.intervals
    : [{ startsAt: legacyStart, endsAt: legacyEnd }]
  const mapped: Array<{ start: unknown; end: unknown }> = []
  for (const item of source) {
    if (!item || typeof item !== 'object') return null
    const row = item as Record<string, unknown>
    mapped.push({ start: row.startsAt, end: row.endsAt })
  }
  return normalizeClockIntervals(mapped)
}

const readServiceValues = (
  input: AdminRequestBody,
  current?: AdminServiceRow,
): Omit<AdminServiceRow, 'id'> | null => {
  const name = input.name === undefined ? current?.name : input.name
  const description = input.description === undefined ? (current?.description ?? '') : input.description
  const duration = input.durationMinutes === undefined ? current?.duration_minutes : input.durationMinutes
  const price = input.priceAmount === undefined ? current?.price_amount : input.priceAmount
  const currency = input.priceCurrency === undefined ? current?.price_currency : input.priceCurrency
  const isActive = input.isActive === undefined ? (current ? current.is_active === 1 : true) : input.isActive
  const sortOrder = input.sortOrder === undefined ? current?.sort_order ?? 0 : input.sortOrder

  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) return null
  if (typeof description !== 'string' || description.length > 300) return null
  if (!Number.isInteger(duration) || Number(duration) < 5 || Number(duration) > 480) return null
  if (!Number.isSafeInteger(price) || Number(price) < 0 || Number(price) > 2_000_000_000) return null
  if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) return null
  if (typeof isActive !== 'boolean') return null
  if (!Number.isInteger(sortOrder) || Number(sortOrder) < 0 || Number(sortOrder) > 10000) return null

  return {
    name: name.trim(),
    description: description.trim(),
    duration_minutes: Number(duration),
    price_amount: Number(price),
    price_currency: currency,
    is_active: isActive ? 1 : 0,
    sort_order: Number(sortOrder),
  }
}

const writeAudit = (
  env: AdminEnv,
  user: AdminSessionUser,
  action: string,
  entityType: string,
  entityId: string,
  details: Record<string, unknown>,
) => env.DB.prepare(
  `INSERT INTO admin_audit_log
     (id, actor_user_id, action, entity_type, entity_id, details_json)
   VALUES (?, ?, ?, ?, ?, ?)`,
).bind(
  crypto.randomUUID(),
  user.id,
  action,
  entityType,
  entityId,
  JSON.stringify(details),
)

const readSettings = async (env: AdminEnv) => {
  const result = await env.DB.prepare(
    'SELECT setting_key, setting_value FROM salon_settings',
  ).all<{ setting_key: string; setting_value: string }>()
  const values = Object.fromEntries((result.results ?? []).map((row) => [row.setting_key, row.setting_value]))
  return {
    timezone: values.local_timezone ?? 'unset',
    slotIntervalMinutes: Number(values.slot_interval_minutes ?? 15),
    minBookingNoticeMinutes: Number(values.min_booking_notice_minutes ?? 120),
    bookingWindowDays: Number(values.booking_window_days ?? 30),
    bufferMinutes: Number(values.buffer_minutes ?? 0),
  }
}

const getAdminServices = async (env: AdminEnv) => {
  const result = await env.DB.prepare(
    `SELECT id, name, description, duration_minutes, price_amount, price_currency, is_active, sort_order
     FROM services ORDER BY is_active DESC, sort_order ASC, name COLLATE NOCASE ASC`,
  ).all<AdminServiceRow>()

  return json({
    ok: true,
    services: (result.results ?? []).map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description,
      durationMinutes: service.duration_minutes,
      priceAmount: service.price_amount,
      priceCurrency: service.price_currency,
      isActive: service.is_active === 1,
      sortOrder: service.sort_order,
    })),
  })
}

const createAdminService = async (request: Request, env: AdminEnv, user: AdminSessionUser) => {
  const input = await readBody(request)
  if (!input) return errorResponse('invalid_request', 'اطلاعات خدمت معتبر نیست.', 400)
  const values = readServiceValues(input)
  if (!values) return errorResponse('invalid_service', 'نام، مدت، قیمت یا واحد پول خدمت معتبر نیست.', 400)

  const id = crypto.randomUUID()
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO services
       (id, name, description, duration_minutes, price_amount, price_currency, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      id, values.name, values.description, values.duration_minutes, values.price_amount,
      values.price_currency, values.is_active, values.sort_order,
    ),
    writeAudit(env, user, 'service.created', 'service', id, {
      name: values.name, isActive: values.is_active === 1,
    }),
  ])
  return json({ ok: true, id }, 201)
}

const updateAdminService = async (
  request: Request,
  env: AdminEnv,
  user: AdminSessionUser,
  id: string,
) => {
  const input = await readBody(request)
  if (!input) return errorResponse('invalid_request', 'اطلاعات خدمت معتبر نیست.', 400)

  const current = await env.DB.prepare(
    `SELECT id, name, description, duration_minutes, price_amount, price_currency, is_active, sort_order
     FROM services WHERE id = ?`,
  ).bind(id).first<AdminServiceRow>()
  if (!current) return errorResponse('service_not_found', 'خدمت پیدا نشد.', 404)

  const values = readServiceValues(input, current)
  if (!values) return errorResponse('invalid_service', 'نام، مدت، قیمت یا واحد پول خدمت معتبر نیست.', 400)

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE services SET name = ?, description = ?, duration_minutes = ?,
        price_amount = ?, price_currency = ?, is_active = ?, sort_order = ?, updated_at = ?
       WHERE id = ?`,
    ).bind(
      values.name, values.description, values.duration_minutes, values.price_amount,
      values.price_currency, values.is_active, values.sort_order, new Date().toISOString(), id,
    ),
    writeAudit(env, user, 'service.updated', 'service', id, {
      name: values.name, isActive: values.is_active === 1,
    }),
  ])
  return json({ ok: true })
}

const localBookingClock = (value: string, timezone: string) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value))
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.hour}:${values.minute}`
}

const localWeekday = (value: string, timezone: string) => {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' })
    .format(new Date(value))
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name)
}

const hasOutOfHoursBookings = async (
  env: AdminEnv,
  timezone: string,
  weekday: number,
  intervals: ClockInterval[],
) => {
  const result = await env.DB.prepare(
    `SELECT starts_at, ends_at FROM bookings
     WHERE status IN ('pending', 'confirmed') AND starts_at >= ?
     ORDER BY starts_at ASC LIMIT 2000`,
  ).bind(new Date().toISOString()).all<BookingRow>()

  return (result.results ?? []).some((booking) => {
    if (localWeekday(booking.starts_at, timezone) !== weekday) return false
    if (intervals.length === 0) return true
    const start = localBookingClock(booking.starts_at, timezone)
    const end = localBookingClock(booking.ends_at, timezone)
    return !intervals.some((interval) => start >= interval.start && end <= interval.end)
  })
}

const getAdminSchedule = async (env: AdminEnv) => {
  const [settings, weekly, weeklyIntervals, exceptions, exceptionIntervals] = await Promise.all([
    readSettings(env),
    env.DB.prepare(
      'SELECT weekday, opens_at, closes_at, is_closed FROM opening_hours ORDER BY weekday',
    ).all<WeeklyHoursRow>(),
    env.DB.prepare(
      'SELECT weekday, starts_at, ends_at, position FROM opening_hour_intervals ORDER BY weekday, position',
    ).all<WeeklyIntervalRow>(),
    env.DB.prepare(
      `SELECT id, local_date, starts_at, ends_at, is_closed, note
       FROM schedule_exceptions ORDER BY local_date ASC LIMIT 180`,
    ).all<ScheduleExceptionRow>(),
    env.DB.prepare(
      `SELECT intervals.exception_id, intervals.starts_at, intervals.ends_at, intervals.position
       FROM schedule_exception_intervals AS intervals
       INNER JOIN schedule_exceptions AS exceptions ON exceptions.id = intervals.exception_id
       ORDER BY exceptions.local_date, intervals.position LIMIT 1440`,
    ).all<ExceptionIntervalRow>(),
  ])

  const byWeekday = new Map((weekly.results ?? []).map((row) => [row.weekday, row]))
  const intervalsByWeekday = new Map<number, ClockInterval[]>()
  for (const row of weeklyIntervals.results ?? []) {
    const current = intervalsByWeekday.get(row.weekday) ?? []
    current.push({ start: row.starts_at, end: row.ends_at })
    intervalsByWeekday.set(row.weekday, current)
  }

  const intervalsByException = new Map<string, ClockInterval[]>()
  for (const row of exceptionIntervals.results ?? []) {
    const current = intervalsByException.get(row.exception_id) ?? []
    current.push({ start: row.starts_at, end: row.ends_at })
    intervalsByException.set(row.exception_id, current)
  }

  return json({
    ok: true,
    settings,
    weeklyHours: WEEKDAY_ORDER.map((weekday) => {
      const name = WEEKDAY_NAMES[weekday]
      const row = byWeekday.get(weekday)
      const legacyIntervals = row && row.opens_at && row.closes_at
        ? [{ start: row.opens_at, end: row.closes_at }]
        : []
      const intervals = intervalsByWeekday.get(weekday) ?? legacyIntervals
      return {
        weekday,
        name,
        intervals: row?.is_closed === 1 ? [] : intervals.map((interval) => ({
          startsAt: interval.start, endsAt: interval.end,
        })),
        isClosed: row ? row.is_closed === 1 : intervals.length === 0,
        configured: Boolean(row),
      }
    }),
    exceptions: (exceptions.results ?? []).map((row) => {
      const legacyIntervals = row.starts_at && row.ends_at
        ? [{ start: row.starts_at, end: row.ends_at }]
        : []
      const intervals = intervalsByException.get(row.id) ?? legacyIntervals
      return {
        id: row.id,
        date: row.local_date,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        intervals: row.is_closed === 1 ? [] : intervals.map((interval) => ({
          startsAt: interval.start, endsAt: interval.end,
        })),
        isClosed: row.is_closed === 1,
        note: row.note,
      }
    }),
  })
}

const updateSalonSettings = async (request: Request, env: AdminEnv, user: AdminSessionUser) => {
  const input = await readBody(request)
  if (!input) return errorResponse('invalid_request', 'تنظیمات معتبر نیست.', 400)

  const settings = await readSettings(env)
  const timezone = input.timezone === undefined ? settings.timezone : input.timezone
  const slotInterval = input.slotIntervalMinutes === undefined ? settings.slotIntervalMinutes : input.slotIntervalMinutes
  const notice = input.minBookingNoticeMinutes === undefined ? settings.minBookingNoticeMinutes : input.minBookingNoticeMinutes
  const horizon = input.bookingWindowDays === undefined ? settings.bookingWindowDays : input.bookingWindowDays
  const buffer = input.bufferMinutes === undefined ? settings.bufferMinutes : input.bufferMinutes

  if (typeof timezone !== 'string' || (timezone !== 'unset' && !isValidIanaTimeZone(timezone))) {
    return errorResponse('invalid_timezone', 'منطقه زمانی باید یک شناسه معتبر مانند Europe/Berlin باشد.', 400)
  }
  if (!Number.isInteger(slotInterval) || Number(slotInterval) < 5 || Number(slotInterval) > 120) {
    return errorResponse('invalid_slot_interval', 'فاصله زمانی نوبت‌ها باید بین ۵ تا ۱۲۰ دقیقه باشد.', 400)
  }
  if (!Number.isInteger(notice) || Number(notice) < 0 || Number(notice) > 10080) {
    return errorResponse('invalid_notice', 'حداقل فاصله رزرو باید بین صفر تا ۷ روز باشد.', 400)
  }
  if (!Number.isInteger(horizon) || Number(horizon) < 1 || Number(horizon) > 365) {
    return errorResponse('invalid_horizon', 'بازه رزرو باید بین ۱ تا ۳۶۵ روز باشد.', 400)
  }
  if (!Number.isInteger(buffer) || Number(buffer) < 0 || Number(buffer) > 240) {
    return errorResponse('invalid_buffer', 'زمان فاصله بین نوبت‌ها باید بین صفر تا ۲۴۰ دقیقه باشد.', 400)
  }

  if (timezone !== settings.timezone) {
    const bookings = await env.DB.prepare(
      "SELECT COUNT(*) AS total FROM bookings WHERE status IN ('pending', 'confirmed') AND starts_at >= ?",
    ).bind(new Date().toISOString()).first<{ total: number }>()
    if ((bookings?.total ?? 0) > 0) {
      return errorResponse('timezone_has_bookings', 'تا زمانی که نوبت فعال آینده وجود دارد، تغییر منطقه زمانی مجاز نیست.', 409)
    }
  }

  const entries: Array<[string, string]> = [
    ['local_timezone', timezone],
    ['slot_interval_minutes', String(slotInterval)],
    ['min_booking_notice_minutes', String(notice)],
    ['booking_window_days', String(horizon)],
    ['buffer_minutes', String(buffer)],
  ]
  const statements = entries.map(([key, value]) => env.DB.prepare(
    `INSERT INTO salon_settings (setting_key, setting_value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = excluded.updated_at`,
  ).bind(key, value, new Date().toISOString()))
  statements.push(writeAudit(env, user, 'salon.settings_updated', 'salon', 'settings', {
    timezone, slotIntervalMinutes: slotInterval, minBookingNoticeMinutes: notice,
    bookingWindowDays: horizon, bufferMinutes: buffer,
  }))
  await env.DB.batch(statements)
  return json({ ok: true, settings: await readSettings(env) })
}

const updateWeeklyHours = async (
  request: Request,
  env: AdminEnv,
  user: AdminSessionUser,
  weekday: number,
) => {
  const input = await readBody(request)
  if (!input || typeof input.isClosed !== 'boolean') {
    return errorResponse('invalid_request', 'وضعیت روز کاری معتبر نیست.', 400)
  }

  const intervals = input.isClosed ? [] : readScheduleIntervals(input, input.opensAt, input.closesAt)
  if (!intervals || (!input.isClosed && intervals.length === 0)) {
    return errorResponse('invalid_hours', 'بازه‌های کاری معتبر نیستند؛ حداکثر ۸ بازه بدون هم‌پوشانی ثبت کنید.', 400)
  }

  const settings = await readSettings(env)
  if (settings.timezone === 'unset') {
    return errorResponse('schedule_not_configured', 'ابتدا منطقه زمانی استودیو را در تنظیمات ذخیره کنید.', 409)
  }

  if (await hasOutOfHoursBookings(env, settings.timezone, weekday, intervals)) {
    return errorResponse('hours_conflict', 'این تغییر با نوبت‌های فعال آینده تداخل دارد؛ ابتدا نوبت‌های مربوط را مدیریت کنید.', 409)
  }

  const first = intervals[0] ?? null
  const statements = [
    env.DB.prepare(
      `INSERT INTO opening_hours (id, weekday, opens_at, closes_at, is_closed)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(weekday) DO UPDATE SET
         opens_at = excluded.opens_at, closes_at = excluded.closes_at,
         is_closed = excluded.is_closed`,
    ).bind(crypto.randomUUID(), weekday, first?.start ?? null, first?.end ?? null, input.isClosed ? 1 : 0),
    env.DB.prepare('DELETE FROM opening_hour_intervals WHERE weekday = ?').bind(weekday),
    ...intervals.map((interval, position) => env.DB.prepare(
      `INSERT INTO opening_hour_intervals (id, weekday, position, starts_at, ends_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(crypto.randomUUID(), weekday, position, interval.start, interval.end)),
    writeAudit(env, user, 'schedule.weekday_updated', 'opening_hours', String(weekday), {
      weekday, isClosed: input.isClosed, intervals,
    }),
  ]
  await env.DB.batch(statements)
  return json({ ok: true })
}

const getDateWindowUtc = (date: string, timezone: string) => {
  const start = localDateTimeToUtc(date, '00:00', timezone)
  const nextDate = addDays(date, 1)
  const end = nextDate ? localDateTimeToUtc(nextDate, '00:00', timezone) : null
  return start && end ? { start, end } : null
}

const hasActiveBookingsOnDate = async (
  env: AdminEnv,
  date: string,
  timezone: string,
): Promise<BookingRow[]> => {
  const window = getDateWindowUtc(date, timezone)
  if (!window) throw new Error('invalid_exception_date_window')
  const result = await env.DB.prepare(
    `SELECT starts_at, ends_at FROM bookings
     WHERE status IN ('pending', 'confirmed') AND starts_at < ? AND ends_at > ?
     LIMIT 200`,
  ).bind(window.end.toISOString(), window.start.toISOString()).all<BookingRow>()
  return result.results ?? []
}

const createScheduleException = async (request: Request, env: AdminEnv, user: AdminSessionUser) => {
  const input = await readBody(request)
  if (!input || typeof input.date !== 'string' || !parseDateKey(input.date) || typeof input.isClosed !== 'boolean') {
    return errorResponse('invalid_exception', 'تاریخ یا نوع تعطیلی معتبر نیست.', 400)
  }
  const settings = await readSettings(env)
  if (settings.timezone === 'unset') return errorResponse('schedule_not_configured', 'ابتدا منطقه زمانی را تنظیم کنید.', 409)

  const date = input.date
  const today = getLocalDateKey(new Date(), settings.timezone)
  if (date < today || date > (addDays(today, 365) ?? today)) {
    return errorResponse('date_out_of_range', 'تاریخ استثنا باید از امروز تا یک سال آینده باشد.', 400)
  }

  const intervals = input.isClosed ? [] : readScheduleIntervals(input, input.startsAt, input.endsAt)
  if (!intervals || (!input.isClosed && intervals.length === 0)) {
    return errorResponse('invalid_exception_hours', 'بازه‌های ساعت استثنا معتبر نیستند؛ حداکثر ۸ بازه بدون هم‌پوشانی ثبت کنید.', 400)
  }
  const note = typeof input.note === 'string' ? input.note.trim() : ''
  if (note.length > 160) return errorResponse('invalid_note', 'توضیحات حداکثر ۱۶۰ نویسه است.', 400)

  const bookings = await hasActiveBookingsOnDate(env, date, settings.timezone)
  const conflicts = bookings.some((booking) => {
    if (input.isClosed || intervals.length === 0) return true
    const start = localBookingClock(booking.starts_at, settings.timezone)
    const end = localBookingClock(booking.ends_at, settings.timezone)
    return !intervals.some((interval) => start >= interval.start && end <= interval.end)
  })
  if (conflicts) return errorResponse('exception_has_bookings', 'این تغییر با نوبت‌های فعال این روز تداخل دارد.', 409)

  const first = intervals[0] ?? null
  const id = crypto.randomUUID()
  const statements = [
    env.DB.prepare(
      `INSERT INTO schedule_exceptions (id, local_date, starts_at, ends_at, is_closed, note)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(local_date) DO UPDATE SET
         starts_at = excluded.starts_at, ends_at = excluded.ends_at,
         is_closed = excluded.is_closed, note = excluded.note`,
    ).bind(id, date, first?.start ?? null, first?.end ?? null, input.isClosed ? 1 : 0, note),
    env.DB.prepare(
      'DELETE FROM schedule_exception_intervals WHERE exception_id = (SELECT id FROM schedule_exceptions WHERE local_date = ?)',
    ).bind(date),
    ...intervals.map((interval, position) => env.DB.prepare(
      `INSERT INTO schedule_exception_intervals (id, exception_id, position, starts_at, ends_at)
       VALUES (?, (SELECT id FROM schedule_exceptions WHERE local_date = ?), ?, ?, ?)`,
    ).bind(crypto.randomUUID(), date, position, interval.start, interval.end)),
    writeAudit(env, user, 'schedule.exception_saved', 'schedule_exception', date, {
      date, isClosed: input.isClosed, intervals, note,
    }),
  ]

  try {
    await env.DB.batch(statements)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.toLowerCase().includes('unique')) {
      return errorResponse('exception_conflict', 'برای این تاریخ قبلاً استثنا ثبت شده است.', 409)
    }
    if (message.includes('schedule_interval_overlap')) {
      return errorResponse('invalid_exception_hours', 'بازه‌های ساعت هم‌پوشانی دارند.', 400)
    }
    throw error
  }
  return json({ ok: true, date })
}

const deleteScheduleException = async (
  env: AdminEnv,
  user: AdminSessionUser,
  exceptionId: string,
) => {
  const exception = await env.DB.prepare(
    'SELECT id, local_date FROM schedule_exceptions WHERE id = ?',
  ).bind(exceptionId).first<{ id: string; local_date: string }>()
  if (!exception) return errorResponse('exception_not_found', 'استثنای برنامه پیدا نشد.', 404)

  const settings = await readSettings(env)
  if (settings.timezone === 'unset') return errorResponse('schedule_not_configured', 'منطقه زمانی تنظیم نشده است.', 409)
  const bookings = await hasActiveBookingsOnDate(env, exception.local_date, settings.timezone)
  if (bookings.length) return errorResponse('exception_has_bookings', 'تا زمانی که برای این تاریخ نوبت فعال وجود دارد، حذف استثنا مجاز نیست.', 409)

  await env.DB.batch([
    env.DB.prepare('DELETE FROM schedule_exceptions WHERE id = ?').bind(exceptionId),
    writeAudit(env, user, 'schedule.exception_deleted', 'schedule_exception', exception.local_date, {}),
  ])
  return json({ ok: true })
}


const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'cross-origin-resource-policy': 'same-origin',
}

const json = (data: unknown, status = 200, extraHeaders?: Record<string, string>) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  })

const errorResponse = (error: string, message: string, status: number, extraHeaders?: Record<string, string>) =>
  json({ ok: false, error, message }, status, extraHeaders)

const isSecurityReady = (env: AdminEnv): boolean =>
  Boolean(env.SESSION_SECRET && env.SESSION_SECRET.length >= 32)

const readBody = async (request: Request): Promise<AdminRequestBody | null> => {
  if (!(request.headers.get('content-type') ?? '').toLowerCase().includes('application/json')) return null
  try {
    const raw = await request.text()
    if (raw.length > 8192) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed as AdminRequestBody
  } catch {
    return null
  }
}

const rateLimit = async (
  env: AdminEnv,
  request: Request,
  scope: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; retryAfter: number }> => {
  if (!isSecurityReady(env) || !env.SESSION_SECRET) throw new Error('admin_security_not_configured')

  const now = Math.floor(Date.now() / 1000)
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds
  const ip = request.headers.get('cf-connecting-ip')?.trim()
  if (!ip || ip.length > 64) throw new Error('rate_limit_unavailable')

  await env.DB.prepare('DELETE FROM admin_rate_limits WHERE expires_at <= ?')
    .bind(now)
    .run()

  const key = await hmacHex(env.SESSION_SECRET, `${scope}:${ip}`)
  const result = await env.DB.prepare(
    `INSERT INTO admin_rate_limits (bucket_hash, window_started_at, attempts, expires_at)
     VALUES (?, ?, 1, ?)
     ON CONFLICT(bucket_hash) DO UPDATE SET
       attempts = CASE
         WHEN admin_rate_limits.window_started_at = excluded.window_started_at
         THEN admin_rate_limits.attempts + 1
         ELSE 1
       END,
       window_started_at = excluded.window_started_at,
       expires_at = excluded.expires_at
     RETURNING attempts`,
  )
    .bind(key, windowStart, windowStart + windowSeconds * 2)
    .first<{ attempts: number }>()

  if (!result) throw new Error('rate_limit_unavailable')
  return {
    allowed: result.attempts <= limit,
    retryAfter: Math.max(1, windowStart + windowSeconds - now),
  }
}

const issueSession = async (
  env: AdminEnv,
  userId: string,
  username: string,
): Promise<Response> => {
  const token = createSessionToken()
  const tokenHash = await sha256Hex(token)
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString()
  await env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?')
    .bind(new Date().toISOString())
    .run()
  await env.DB.prepare(
    'INSERT INTO admin_sessions (id_hash, admin_user_id, expires_at) VALUES (?, ?, ?)',
  )
    .bind(tokenHash, userId, expiresAt)
    .run()

  return json(
    { ok: true, user: { id: userId, username }, expiresAt },
    200,
    { 'set-cookie': sessionCookie(token, SESSION_TTL_SECONDS) },
  )
}

const getAdminSession = async (request: Request, env: AdminEnv): Promise<AdminSessionUser | null> => {
  const now = new Date().toISOString()
  await env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?')
    .bind(now)
    .run()

  const token = getSessionCookie(request)
  if (!token) return null

  const tokenHash = await sha256Hex(token)
  return env.DB.prepare(
    `SELECT users.id, users.username
     FROM admin_sessions AS sessions
     INNER JOIN admin_users AS users ON users.id = sessions.admin_user_id
     WHERE sessions.id_hash = ? AND sessions.expires_at > ? AND users.is_active = 1
     LIMIT 1`,
  )
    .bind(tokenHash, now)
    .first<AdminSessionUser>()
}

const getAdminCount = async (env: AdminEnv): Promise<number> => {
  const result = await env.DB.prepare('SELECT COUNT(*) AS total FROM admin_users')
    .first<{ total: number }>()
  return result?.total ?? 0
}

const addDays = (dateKey: string, amount: number): string | null => {
  const parts = parseDateKey(dateKey)
  if (!parts) return null
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + amount))
  return [
    String(date.getUTCFullYear()).padStart(4, '0'),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

const getAdminBookings = async (request: Request, env: AdminEnv) => {
  const settings = await env.DB.prepare(
    "SELECT setting_value FROM salon_settings WHERE setting_key = 'local_timezone'",
  ).first<{ setting_value: string }>()
  const timezone = settings?.setting_value ?? 'unset'
  if (timezone === 'unset') {
    return errorResponse('schedule_not_configured', 'منطقه زمانی استودیو هنوز تنظیم نشده است.', 503)
  }

  const url = new URL(request.url)
  const today = getLocalDateKey(new Date(), timezone)
  const from = url.searchParams.get('from') ?? today
  const to = url.searchParams.get('to') ?? addDays(today, 6)

  if (!to || !parseDateKey(from) || !parseDateKey(to)) {
    return errorResponse('invalid_date_range', 'بازه تاریخ معتبر نیست.', 400)
  }
  const fromNumber = Date.parse(`${from}T00:00:00Z`)
  const toNumber = Date.parse(`${to}T00:00:00Z`)
  if (toNumber < fromNumber || toNumber - fromNumber > 31 * 86400000) {
    return errorResponse('invalid_date_range', 'بازه نمایش نمی‌تواند بیشتر از ۳۱ روز باشد.', 400)
  }

  const nextDay = addDays(to, 1)
  if (!nextDay) return errorResponse('invalid_date_range', 'بازه تاریخ معتبر نیست.', 400)
  const start = localDateTimeToUtc(from, '00:00', timezone)
  const end = localDateTimeToUtc(nextDay, '00:00', timezone)
  if (!start || !end) return errorResponse('invalid_timezone', 'تنظیم منطقه زمانی معتبر نیست.', 503)

  const requestedStatus = url.searchParams.get('status') ?? 'all'
  const allowedStatuses = new Set(['all', 'pending', 'confirmed', 'cancelled', 'completed', 'no_show'])
  if (!allowedStatuses.has(requestedStatus)) {
    return errorResponse('invalid_status', 'فیلتر وضعیت معتبر نیست.', 400)
  }

  const query = requestedStatus === 'all'
    ? `SELECT b.id, b.reference_code, b.client_name, b.client_phone,
              b.starts_at, b.ends_at, b.status, b.client_note,
              s.name AS service_name, s.duration_minutes
       FROM bookings AS b INNER JOIN services AS s ON s.id = b.service_id
       WHERE b.starts_at >= ? AND b.starts_at < ?
       ORDER BY b.starts_at ASC LIMIT 200`
    : `SELECT b.id, b.reference_code, b.client_name, b.client_phone,
              b.starts_at, b.ends_at, b.status, b.client_note,
              s.name AS service_name, s.duration_minutes
       FROM bookings AS b INNER JOIN services AS s ON s.id = b.service_id
       WHERE b.starts_at >= ? AND b.starts_at < ? AND b.status = ?
       ORDER BY b.starts_at ASC LIMIT 200`

  const statement = env.DB.prepare(query)
  const result = requestedStatus === 'all'
    ? await statement.bind(start.toISOString(), end.toISOString()).all<BookingRow>()
    : await statement.bind(start.toISOString(), end.toISOString(), requestedStatus).all<BookingRow>()

  return json({
    ok: true,
    timezone,
    from,
    to,
    bookings: (result.results ?? []).map((booking) => ({
      id: booking.id,
      reference: booking.reference_code,
      name: booking.client_name,
      phone: booking.client_phone,
      startsAt: booking.starts_at,
      endsAt: booking.ends_at,
      status: booking.status,
      note: booking.client_note,
      service: booking.service_name,
      durationMinutes: booking.duration_minutes,
    })),
  })
}

const allowedTransition = (from: string, to: string): boolean => {
  const transitions: Record<string, string[]> = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['completed', 'cancelled', 'no_show'],
    cancelled: [],
    completed: [],
    no_show: [],
  }
  return transitions[from]?.includes(to) ?? false
}

const updateBookingStatus = async (
  request: Request,
  env: AdminEnv,
  user: AdminSessionUser,
  bookingId: string,
) => {
  const input = await readBody(request)
  if (!input || typeof input.status !== 'string') {
    return errorResponse('invalid_request', 'درخواست معتبر نیست.', 400)
  }
  const nextStatus = input.status
  if (!['confirmed', 'cancelled', 'completed', 'no_show'].includes(nextStatus)) {
    return errorResponse('invalid_status', 'وضعیت انتخاب‌شده معتبر نیست.', 400)
  }

  const booking = await env.DB.prepare('SELECT status FROM bookings WHERE id = ?')
    .bind(bookingId)
    .first<{ status: string }>()
  if (!booking) return errorResponse('booking_not_found', 'نوبت پیدا نشد.', 404)
  if (!allowedTransition(booking.status, nextStatus)) {
    return errorResponse('invalid_transition', 'تغییر وضعیت از این مرحله مجاز نیست.', 409)
  }

  const updatedAt = new Date().toISOString()
  const auditId = crypto.randomUUID()
  const results = await env.DB.batch([
    env.DB.prepare(
      'UPDATE bookings SET status = ?, updated_at = ? WHERE id = ? AND status = ? RETURNING id',
    ).bind(nextStatus, updatedAt, bookingId, booking.status),
    env.DB.prepare(
      `INSERT INTO admin_audit_log
         (id, actor_user_id, action, entity_type, entity_id, details_json)
       SELECT ?, ?, 'booking.status_changed', 'booking', ?, ?
       WHERE changes() = 1`,
    ).bind(
      auditId,
      user.id,
      bookingId,
      JSON.stringify({ from: booking.status, to: nextStatus }),
    ),
  ])

  if ((results[0]?.results?.length ?? 0) !== 1) {
    return errorResponse('booking_changed', 'این نوبت هم‌زمان تغییر کرده است؛ فهرست را تازه‌سازی کنید.', 409)
  }

  return json({ ok: true, status: nextStatus, updatedAt })
}

const handleBootstrap = async (request: Request, env: AdminEnv) => {
  if (!isSameOriginRequest(request)) return errorResponse('forbidden_origin', 'مبدأ درخواست معتبر نیست.', 403)
  if (!env.ADMIN_BOOTSTRAP_TOKEN || !isSecurityReady(env)) {
    return errorResponse('bootstrap_unavailable', 'راه‌اندازی اولیه هنوز توسط مدیر سامانه پیکربندی نشده است.', 503)
  }

  const rate = await rateLimit(env, request, 'bootstrap', 3, 3600)
  if (!rate.allowed) {
    return errorResponse('rate_limited', 'تعداد تلاش‌ها بیش از حد مجاز است.', 429, { 'retry-after': String(rate.retryAfter) })
  }

  const providedToken = request.headers.get('x-admin-bootstrap-token') ?? ''
  if (!constantTimeEqual(providedToken, env.ADMIN_BOOTSTRAP_TOKEN)) {
    return errorResponse('invalid_bootstrap_token', 'کلید راه‌اندازی معتبر نیست.', 401)
  }

  const input = await readBody(request)
  if (!input || typeof input.username !== 'string' || typeof input.password !== 'string') {
    return errorResponse('invalid_request', 'نام کاربری و گذرواژه الزامی هستند.', 400)
  }

  const username = input.username.trim()
  const password = input.password
  if (!validAdminUsername(username)) {
    return errorResponse('invalid_username', 'نام کاربری باید ۳ تا ۳۲ نویسه و بدون فاصله باشد.', 400)
  }
  if (password.length < 12 || password.length > 128) {
    return errorResponse('weak_password', 'گذرواژه باید حداقل ۱۲ و حداکثر ۱۲۸ نویسه داشته باشد.', 400)
  }

  const passwordHash = await createPasswordHash(password)
  const userId = crypto.randomUUID()
  const inserted = await env.DB.prepare(
    `INSERT INTO admin_users (id, username, password_hash, is_active)
     SELECT ?, ?, ?, 1 WHERE NOT EXISTS (SELECT 1 FROM admin_users)`,
  )
    .bind(userId, username, passwordHash)
    .run()

  if ((inserted.meta.changes ?? 0) !== 1) {
    return errorResponse('already_initialized', 'حساب مدیر قبلاً ساخته شده است؛ از صفحه ورود استفاده کنید.', 409)
  }

  return issueSession(env, userId, username)
}

const handleLogin = async (request: Request, env: AdminEnv) => {
  if (!isSameOriginRequest(request)) return errorResponse('forbidden_origin', 'مبدأ درخواست معتبر نیست.', 403)
  if (!isSecurityReady(env)) {
    return errorResponse('admin_security_not_configured', 'تنظیمات امنیتی مدیر هنوز آماده نیست.', 503)
  }

  const rate = await rateLimit(env, request, 'login', 8, 900)
  if (!rate.allowed) {
    return errorResponse('rate_limited', 'تلاش‌های ورود بیش از حد مجاز است. کمی بعد دوباره امتحان کنید.', 429, { 'retry-after': String(rate.retryAfter) })
  }

  const input = await readBody(request)
  if (!input || typeof input.username !== 'string' || typeof input.password !== 'string') {
    return errorResponse('invalid_request', 'نام کاربری و گذرواژه الزامی هستند.', 400)
  }

  const username = input.username.trim()
  const password = input.password.slice(0, 128)
  const user = await env.DB.prepare(
    'SELECT id, username, password_hash, is_active FROM admin_users WHERE username = ? LIMIT 1',
  )
    .bind(username)
    .first<AdminUser>()

  const dummyHash = 'pbkdf2-sha256$600000$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000'
  const passwordMatches = await verifyPasswordHash(password, user?.password_hash ?? dummyHash)
  if (!user || user.is_active !== 1 || !passwordMatches) {
    return errorResponse('invalid_credentials', 'نام کاربری یا گذرواژه اشتباه است.', 401)
  }

  return issueSession(env, user.id, user.username)
}

export const handleAdminRequest = async (request: Request, env: AdminEnv): Promise<Response | null> => {
  const url = new URL(request.url)
  if (!url.pathname.startsWith('/api/admin/')) return null

  try {
    if (url.pathname === '/api/admin/setup-status') {
      if (request.method !== 'GET') return errorResponse('method_not_allowed', 'روش درخواست پشتیبانی نمی‌شود.', 405)
      const initialized = (await getAdminCount(env)) > 0
      return json({
        ok: true,
        initialized,
        bootstrapAvailable: !initialized && Boolean(env.ADMIN_BOOTSTRAP_TOKEN) && isSecurityReady(env),
      })
    }

    if (url.pathname === '/api/admin/bootstrap') {
      if (request.method !== 'POST') return errorResponse('method_not_allowed', 'روش درخواست پشتیبانی نمی‌شود.', 405)
      return await handleBootstrap(request, env)
    }

    if (url.pathname === '/api/admin/login') {
      if (request.method !== 'POST') return errorResponse('method_not_allowed', 'روش درخواست پشتیبانی نمی‌شود.', 405)
      return await handleLogin(request, env)
    }

    if (url.pathname === '/api/admin/logout') {
      if (request.method !== 'POST') return errorResponse('method_not_allowed', 'روش درخواست پشتیبانی نمی‌شود.', 405)
      if (!isSameOriginRequest(request)) return errorResponse('forbidden_origin', 'مبدأ درخواست معتبر نیست.', 403)
      const token = getSessionCookie(request)
      if (token) {
        await env.DB.prepare('DELETE FROM admin_sessions WHERE id_hash = ?')
          .bind(await sha256Hex(token))
          .run()
      }
      return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie() })
    }

    if (url.pathname === '/api/admin/me') {
      if (request.method !== 'GET') return errorResponse('method_not_allowed', 'روش درخواست پشتیبانی نمی‌شود.', 405)
      const user = await getAdminSession(request, env)
      if (!user) return errorResponse('unauthorized', 'برای ادامه وارد پنل مدیریت شوید.', 401)
      return json({ ok: true, user })
    }

    const user = await getAdminSession(request, env)
    if (!user) return errorResponse('unauthorized', 'برای ادامه وارد پنل مدیریت شوید.', 401)

    if (url.pathname === '/api/admin/bookings') {
      if (request.method !== 'GET') return errorResponse('method_not_allowed', 'روش درخواست پشتیبانی نمی‌شود.', 405)
      return await getAdminBookings(request, env)
    }

    if (url.pathname === '/api/admin/services') {
      if (request.method === 'GET') return await getAdminServices(env)
      if (request.method === 'POST') {
        if (!isSameOriginRequest(request)) return errorResponse('forbidden_origin', 'مبدأ درخواست معتبر نیست.', 403)
        return await createAdminService(request, env, user)
      }
      return errorResponse('method_not_allowed', 'روش درخواست پشتیبانی نمی‌شود.', 405)
    }

    const serviceMatch = /^\/api\/admin\/services\/([a-f0-9-]{36})$/i.exec(url.pathname)
    if (serviceMatch) {
      if (request.method !== 'PATCH') return errorResponse('method_not_allowed', 'روش درخواست پشتیبانی نمی‌شود.', 405)
      if (!isSameOriginRequest(request)) return errorResponse('forbidden_origin', 'مبدأ درخواست معتبر نیست.', 403)
      return await updateAdminService(request, env, user, serviceMatch[1])
    }

    if (url.pathname === '/api/admin/schedule') {
      if (request.method === 'GET') return await getAdminSchedule(env)
      return errorResponse('method_not_allowed', 'روش درخواست پشتیبانی نمی‌شود.', 405)
    }

    if (url.pathname === '/api/admin/settings') {
      if (request.method !== 'PUT') return errorResponse('method_not_allowed', 'روش درخواست پشتیبانی نمی‌شود.', 405)
      if (!isSameOriginRequest(request)) return errorResponse('forbidden_origin', 'مبدأ درخواست معتبر نیست.', 403)
      return await updateSalonSettings(request, env, user)
    }

    const weekdayMatch = /^\/api\/admin\/schedule\/weekly\/(\d)$/i.exec(url.pathname)
    if (weekdayMatch) {
      if (request.method !== 'PUT') return errorResponse('method_not_allowed', 'روش درخواست پشتیبانی نمی‌شود.', 405)
      if (!isSameOriginRequest(request)) return errorResponse('forbidden_origin', 'مبدأ درخواست معتبر نیست.', 403)
      const weekday = Number(weekdayMatch[1])
      if (weekday < 0 || weekday > 6) return errorResponse('invalid_weekday', 'روز هفته معتبر نیست.', 400)
      return await updateWeeklyHours(request, env, user, weekday)
    }

    if (url.pathname === '/api/admin/schedule/exceptions') {
      if (request.method !== 'POST') return errorResponse('method_not_allowed', 'روش درخواست پشتیبانی نمی‌شود.', 405)
      if (!isSameOriginRequest(request)) return errorResponse('forbidden_origin', 'مبدأ درخواست معتبر نیست.', 403)
      return await createScheduleException(request, env, user)
    }

    const exceptionMatch = /^\/api\/admin\/schedule\/exceptions\/([a-f0-9-]{36})$/i.exec(url.pathname)
    if (exceptionMatch) {
      if (request.method !== 'DELETE') return errorResponse('method_not_allowed', 'روش درخواست پشتیبانی نمی‌شود.', 405)
      if (!isSameOriginRequest(request)) return errorResponse('forbidden_origin', 'مبدأ درخواست معتبر نیست.', 403)
      return await deleteScheduleException(env, user, exceptionMatch[1])
    }

    const statusMatch = /^\/api\/admin\/bookings\/([a-f0-9-]{36})\/status$/i.exec(url.pathname)
    if (statusMatch) {
      if (request.method !== 'PATCH') return errorResponse('method_not_allowed', 'روش درخواست پشتیبانی نمی‌شود.', 405)
      if (!isSameOriginRequest(request)) return errorResponse('forbidden_origin', 'مبدأ درخواست معتبر نیست.', 403)
      return await updateBookingStatus(request, env, user, statusMatch[1])
    }

    return errorResponse('not_found', 'این مسیر پیدا نشد.', 404)
  } catch {
    return errorResponse('admin_service_unavailable', 'سرویس مدیریت در حال حاضر در دسترس نیست.', 503)
  }
}
