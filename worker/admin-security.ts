const textEncoder = new TextEncoder()
const PASSWORD_ITERATIONS = 600_000

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

const fromHex = (value: string): Uint8Array | null => {
  if (!/^(?:[0-9a-f]{2})+$/i.test(value)) return null
  const bytes = new Uint8Array(value.length / 2)
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16)
  }
  return bytes
}

const derivePassword = async (password: string, salt: Uint8Array, iterations: number) => {
  const material = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    256,
  )
  return new Uint8Array(bits)
}

export const createPasswordHash = async (password: string): Promise<string> => {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const derived = await derivePassword(password, salt, PASSWORD_ITERATIONS)
  return `pbkdf2-sha256$${PASSWORD_ITERATIONS}$${toHex(salt)}$${toHex(derived)}`
}

export const verifyPasswordHash = async (password: string, encoded: string): Promise<boolean> => {
  const [algorithm, iterationText, saltText, hashText, extra] = encoded.split('$')
  if (extra !== undefined || algorithm !== 'pbkdf2-sha256' || Number(iterationText) !== PASSWORD_ITERATIONS) {
    return false
  }

  const salt = fromHex(saltText)
  const expected = fromHex(hashText)
  if (!salt || salt.length !== 16 || !expected || expected.length !== 32) return false

  const actual = await derivePassword(password, salt, PASSWORD_ITERATIONS)
  let difference = 0
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected[index] ^ actual[index]
  }
  return difference === 0
}

export const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(value))
  return toHex(new Uint8Array(digest))
}

export const hmacHex = async (secret: string, value: string): Promise<string> => {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(value))
  return toHex(new Uint8Array(signature))
}

export const constantTimeEqual = (left: string, right: string): boolean => {
  const a = textEncoder.encode(left)
  const b = textEncoder.encode(right)
  if (a.length !== b.length) return false

  let difference = 0
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index]
  return difference === 0
}

export const createSessionToken = (): string =>
  toHex(crypto.getRandomValues(new Uint8Array(32)))

export const getSessionCookie = (request: Request): string | null => {
  const cookie = request.headers.get('cookie') ?? ''
  for (const part of cookie.split(';')) {
    const separator = part.indexOf('=')
    if (separator < 0) continue
    const name = part.slice(0, separator).trim()
    const value = part.slice(separator + 1).trim()
    if (name === '__Host-salon_session' && /^[0-9a-f]{64}$/i.test(value)) return value
  }
  return null
}

export const sessionCookie = (token: string, maxAgeSeconds: number): string =>
  `__Host-salon_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAgeSeconds}`

export const clearSessionCookie = (): string =>
  '__Host-salon_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'

export const isSameOriginRequest = (request: Request): boolean => {
  const origin = request.headers.get('origin')
  if (!origin) return false

  try {
    if (new URL(origin).origin !== new URL(request.url).origin) return false
  } catch {
    return false
  }

  return request.headers.get('sec-fetch-site') !== 'cross-site'
}

export const validAdminUsername = (value: string): boolean =>
  /^[\p{L}\p{N}_.-]{3,32}$/u.test(value)
