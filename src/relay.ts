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
  let bridgeWindow: Window | null = null
  let bridgeOrigin = ''
  let bridgeReadyPromise: Promise<void> | null = null
  let bridgeReadyResolve: (() => void) | null = null
  let bridgeReadyTimer: number | undefined

  const createSessionId = () => {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
    return Array.from(crypto.getRandomValues(new Uint8Array(24)), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('')
  }

  const isAppsScriptOrigin = (origin: string): boolean => {
    try {
      const url = new URL(origin)
      return url.protocol === 'https:' &&
        (url.hostname === 'script.googleusercontent.com' ||
          /^[a-z0-9-]+-script\.googleusercontent\.com$/i.test(url.hostname))
    } catch {
      return false
    }
  }

  const isNestedFrameWindow = (source: MessageEventSource | null): source is Window => {
    if (!source || !frame?.contentWindow) return false

    const queue: Window[] = [frame.contentWindow]
    const visited = new Set<Window>()
    while (queue.length) {
      const current = queue.shift()
      if (!current || visited.has(current)) continue
      if (current === source) return current !== frame.contentWindow
      visited.add(current)

      // Cross-origin WindowProxy exposes a limited frame-navigation surface.
      // Read child frame references only; never access a cross-origin document.
      try {
        for (let index = 0; index < current.length; index += 1) {
          const child = current.frames[index]
          if (child) queue.push(child)
        }
      } catch {
        // A child may navigate while the Apps Script wrapper is redirecting.
      }
    }
    return false
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
          bridgeWindow = null
          bridgeOrigin = ''
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
    const message = event.data as { type?: string; id?: string; result?: RelayResult } | null
    if (!message || typeof message.type !== 'string') return

    if (message.type === 'SALON_RELAY_READY') {
      if (!isAppsScriptOrigin(event.origin) || !isNestedFrameWindow(event.source)) return
      bridgeWindow = event.source
      bridgeOrigin = event.origin
      if (bridgeReadyTimer !== undefined) window.clearTimeout(bridgeReadyTimer)
      bridgeReadyTimer = undefined
      bridgeReadyResolve?.()
      return
    }

    if (
      message.type !== 'SALON_RELAY_RESPONSE' ||
      !message.id ||
      event.source !== bridgeWindow ||
      event.origin !== bridgeOrigin
    ) return

    const request = pending.get(message.id)
    if (!request) return
    pending.delete(message.id)
    if (request.timeoutId !== undefined) window.clearTimeout(request.timeoutId)
    if (request.signal && request.abortHandler) {
      request.signal.removeEventListener('abort', request.abortHandler)
    }
    request.resolve(message.result ?? { status: 502, body: '{"message":"پاسخ درگاه معتبر نیست."}' })
  })

  const waitForBridge = async () => {
    if (bridgeWindow) return
    if (!bridgeReadyPromise) {
      bridgeReadyPromise = new Promise<void>((resolve, reject) => {
        bridgeReadyResolve = resolve
        bridgeReadyTimer = window.setTimeout(() => {
          const staleFrame = frame
          frame = null
          frameReady = null
          bridgeWindow = null
          bridgeOrigin = ''
          staleFrame?.remove()
          reject(new Error('پل ارتباطی Google Apps Script آماده نشد. نسخهٔ Web App را بررسی و دوباره منتشر کنید.'))
        }, 25000)
      })
    }

    try {
      await bridgeReadyPromise
    } finally {
      if (bridgeReadyTimer !== undefined) window.clearTimeout(bridgeReadyTimer)
      bridgeReadyTimer = undefined
      bridgeReadyPromise = null
      bridgeReadyResolve = null
    }
  }

  const relayRequest = async (request: Request): Promise<Response> => {
    try {
      await ensureFrame()
      await waitForBridge()
      if (!bridgeWindow) throw new Error('پل ارتباطی Google Apps Script در دسترس نیست.')
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
          bridgeWindow?.postMessage({
            type: 'SALON_RELAY_REQUEST',
            id,
            request: {
              path: new URL(request.url).pathname + new URL(request.url).search,
              method: request.method,
              headers,
              body,
              sessionId,
            },
          }, bridgeOrigin)
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
