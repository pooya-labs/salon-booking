const WORKER_BASE_URL = 'https://salon-booking.pooyagame141.workers.dev'
const SESSION_CACHE_PREFIX = 'salon-booking-session:'
const SESSION_CACHE_TTL_SECONDS = 21600

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Bridge')
    .setTitle('Salon Booking Relay')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
}

function authorizeRelay() {
  const response = UrlFetchApp.fetch(WORKER_BASE_URL + '/api/health', {
    method: 'get',
    muteHttpExceptions: true,
  })
  Logger.log('Worker health HTTP ' + response.getResponseCode())
}

function proxyRequest(input) {
  if (!input || typeof input !== 'object') {
    return { status: 400, body: JSON.stringify({ message: 'درخواست معتبر نیست.' }) }
  }

  const path = String(input.path || '')
  const method = String(input.method || 'GET').toUpperCase()
  const sessionId = String(input.sessionId || '')
  if (!/^\/api\/[a-zA-Z0-9/_-]*(?:\?[^#]{0,1500})?$/.test(path) ||
      !['GET', 'POST', 'PATCH', 'DELETE'].includes(method) ||
      !/^[a-zA-Z0-9-]{24,64}$/.test(sessionId)) {
    return { status: 400, body: JSON.stringify({ message: 'مسیر یا روش درخواست معتبر نیست.' }) }
  }

  const url = WORKER_BASE_URL + path
  const cache = CacheService.getScriptCache()
  const cacheKey = SESSION_CACHE_PREFIX + sessionId
  const headers = {
    Accept: 'application/json',
    Origin: WORKER_BASE_URL,
    'X-Salon-Relay-Client': sessionId,
  }

  const allowedHeaders = ['content-type', 'idempotency-key', 'x-admin-bootstrap-token']
  const suppliedHeaders = input.headers && typeof input.headers === 'object' ? input.headers : {}
  Object.keys(suppliedHeaders).forEach(function (name) {
    if (allowedHeaders.indexOf(name.toLowerCase()) !== -1) {
      headers[name] = String(suppliedHeaders[name])
    }
  })

  const sessionCookie = cache.get(cacheKey)
  if (sessionCookie) headers.Cookie = '__Host-salon_session=' + sessionCookie

  const options = {
    method: method.toLowerCase(),
    headers: headers,
    contentType: String(headers['content-type'] || 'application/json'),
    muteHttpExceptions: true,
    followRedirects: false,
  }
  if (input.body !== null && input.body !== undefined && method !== 'GET') {
    options.payload = String(input.body)
  }

  try {
    const response = UrlFetchApp.fetch(url, options)
    const responseHeaders = response.getAllHeaders()
    let setCookie = ''
    Object.keys(responseHeaders).forEach(function (name) {
      if (name.toLowerCase() === 'set-cookie') {
        const value = responseHeaders[name]
        setCookie = Array.isArray(value) ? value.join('; ') : String(value)
      }
    })

    const cookieMatch = setCookie.match(/__Host-salon_session=([0-9a-f]{64})/i)
    if (cookieMatch) {
      cache.put(cacheKey, cookieMatch[1], SESSION_CACHE_TTL_SECONDS)
    } else if (/__Host-salon_session=;/.test(setCookie) ||
               (path === '/api/admin/me' && response.getResponseCode() === 401) ||
               path === '/api/admin/logout') {
      cache.remove(cacheKey)
    }

    return {
      status: response.getResponseCode(),
      body: response.getContentText(),
      sessionId: sessionId,
    }
  } catch (error) {
    return {
      status: 502,
      body: JSON.stringify({
        ok: false,
        error: 'worker_unreachable',
        message: 'ارتباط سرور واسط با سامانه رزرو برقرار نشد.',
      }),
      sessionId: sessionId,
    }
  }
}
