interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> }
  DB: D1Database
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/health') {
      return json({ ok: true, service: 'salon-booking-api', version: '0.1.0' })
    }

    if (url.pathname.startsWith('/api/')) {
      return json({ error: 'not_found', message: 'این مسیر هنوز آماده نشده است.' }, 404)
    }

    return env.ASSETS.fetch(request)
  },
}
