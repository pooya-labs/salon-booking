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
}

const SESSION_TTL_SECONDS = 12 * 60 * 60
const SESSION_COOKIE_NAME = '__Host-salon_session'
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
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'
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
    .bind(tokenHash, new Date().toISOString())
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
      'UPDATE bookings SET status = ?, updated_at = ? WHERE id = ? AND status = ?',
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

  if ((results[0]?.meta.changes ?? 0) !== 1) {
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
