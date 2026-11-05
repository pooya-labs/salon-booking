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
  timeoutId?: number
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
      const nextFrame = document.createElement('iframe')
      let loadTimeout = 0
      const fail = (message: string) => {
        window.clearTimeout(loadTimeout)
        if (frame === nextFrame) {
          frame = null
          frameReady = null
          nextFrame.remove()
        }
        reject(new Error(message))
      }

      frame = nextFrame
      nextFrame.title = 'Salon booking API relay'
      nextFrame.setAttribute('aria-hidden', 'true')
      nextFrame.tabIndex = -1
      nextFrame.style.display = 'none'
      nextFrame.addEventListener('load', () => {
        window.clearTimeout(loadTimeout)
        if (frame === nextFrame) resolve()
      }, { once: true })
      nextFrame.addEventListener('error', () => fail('درگاه ارتباطی بارگذاری نشد.'), { once: true })
      nextFrame.src = relayUrl
      document.body.appendChild(nextFrame)

      loadTimeout = window.setTimeout(() => {
        fail('پاسخی از درگاه ارتباطی دریافت نشد.')
      }, 20000)
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
    if (request.timeoutId !== undefined) window.clearTimeout(request.timeoutId)
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
        const cleanup = () => {
          if (pendingRequest.timeoutId !== undefined) window.clearTimeout(pendingRequest.timeoutId)
          if (request.signal && pendingRequest.abortHandler) {
            request.signal.removeEventListener('abort', pendingRequest.abortHandler)
          }
        }
        pendingRequest.abortHandler = () => {
          pending.delete(id)
          cleanup()
          reject(new DOMException('درخواست لغو شد.', 'AbortError'))
        }
        pendingRequest.timeoutId = window.setTimeout(() => {
          pending.delete(id)
          cleanup()
          reject(new Error('پاسخی از سامانه رزرو دریافت نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.'))
        }, 30000)
        request.signal.addEventListener('abort', pendingRequest.abortHandler, { once: true })
        pending.set(id, pendingRequest)

        try {
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
        } catch (error) {
          pending.delete(id)
          cleanup()
          reject(error instanceof Error ? error : new Error('ارسال درخواست به درگاه رزرو ممکن نشد.'))
        }
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
    const requestUrl = input instanceof Request
      ? input.url
      : new URL(String(input), window.location.href).toString()
    const request = input instanceof Request ? new Request(input, init) : new Request(requestUrl, init)
    const url = new URL(request.url)
    if (url.origin === window.location.origin && url.pathname.startsWith('/api/')) {
      return relayRequest(request)
    }
    return nativeFetch(input, init)
  }
}
