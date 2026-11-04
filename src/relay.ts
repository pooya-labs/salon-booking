const relayUrl = import.meta.env.VITE_SALON_RELAY_URL?.trim()

type RelayResult = {
  status: number
  body: string
  sessionId?: string
  error?: string
}

type PendingRequest = {
  resolve: (result: RelayResult) => void
  reject: (error: Error) => void
  signal?: AbortSignal
  abortHandler?: () => void
}

if (relayUrl && typeof window !== 'undefined') {
  const nativeFetch = window.fetch.bind(window)
  const pending = new Map<string, PendingRequest>()
  let frame: HTMLIFrameElement | null = null
  let frameReady: Promise<void> | null = null
  let memorySessionId = ''

  const createSessionId = () => {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
    return Array.from(crypto.getRandomValues(new Uint8Array(24)), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('')
  }

  const getSessionId = () => {
    try {
      let value = window.localStorage.getItem('salon-booking-relay-session')
      if (!value) {
        value = createSessionId()
        window.localStorage.setItem('salon-booking-relay-session', value)
      }
      return value
    } catch {
      if (!memorySessionId) memorySessionId = createSessionId()
      return memorySessionId
    }
  }

  const ensureFrame = () => {
    if (frameReady) return frameReady

    frameReady = new Promise<void>((resolve, reject) => {
      frame = document.createElement('iframe')
      frame.title = 'Salon booking API relay'
      frame.setAttribute('aria-hidden', 'true')
      frame.tabIndex = -1
      frame.style.display = 'none'
      frame.addEventListener('load', () => resolve(), { once: true })
      frame.addEventListener('error', () => reject(new Error('درگاه ارتباطی بارگذاری نشد.')), { once: true })
      frame.src = relayUrl
      document.body.appendChild(frame)

      window.setTimeout(() => reject(new Error('پاسخی از درگاه ارتباطی دریافت نشد.')), 20000)
    })

    return frameReady
  }

  window.addEventListener('message', (event: MessageEvent) => {
    if (!frame?.contentWindow || event.source !== frame.contentWindow) return
    const message = event.data as { type?: string; id?: string; result?: RelayResult }
    if (message?.type !== 'SALON_RELAY_RESPONSE' || !message.id) return

    const request = pending.get(message.id)
    if (!request) return
    pending.delete(message.id)
    if (request.signal && request.abortHandler) {
      request.signal.removeEventListener('abort', request.abortHandler)
    }
    request.resolve(message.result ?? { status: 502, body: '{"message":"پاسخ درگاه معتبر نیست."}' })
  })

  const relayRequest = async (request: Request): Promise<Response> => {
    try {
      await ensureFrame()
      if (!frame?.contentWindow) throw new Error('درگاه ارتباطی در دسترس نیست.')
      if (request.signal.aborted) throw new DOMException('درخواست لغو شد.', 'AbortError')

      const id = createSessionId()
      const sessionId = getSessionId()
      const headers = Object.fromEntries(request.headers.entries())
      delete headers.cookie
      delete headers.origin
      delete headers['sec-fetch-site']
      delete headers['content-length']

      const body = ['GET', 'HEAD'].includes(request.method) ? null : await request.clone().text()
      const result = await new Promise<RelayResult>((resolve, reject) => {
        const pendingRequest: PendingRequest = { resolve, reject, signal: request.signal }
        pendingRequest.abortHandler = () => {
          pending.delete(id)
          reject(new DOMException('درخواست لغو شد.', 'AbortError'))
        }
        request.signal.addEventListener('abort', pendingRequest.abortHandler, { once: true })
        pending.set(id, pendingRequest)

        frame?.contentWindow?.postMessage({
          type: 'SALON_RELAY_REQUEST',
          id,
          request: {
            path: new URL(request.url).pathname + new URL(request.url).search,
            method: request.method,
            headers,
            body,
            sessionId,
          },
        }, '*')
      })

      return new Response(result.body ?? '', {
        status: result.status >= 200 && result.status <= 599 ? result.status : 502,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        },
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      return new Response(JSON.stringify({
        ok: false,
        error: 'relay_unavailable',
        message: error instanceof Error ? error.message : 'ارتباط با درگاه واسط برقرار نشد.',
      }), {
        status: 502,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      })
    }
  }

  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init)
    const url = new URL(request.url)
    if (url.origin === window.location.origin && url.pathname.startsWith('/api/')) {
      return relayRequest(request)
    }
    return nativeFetch(input, init)
  }
}
