const textEncoder = new TextEncoder()

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

const sha256Hex = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(value))
  return toHex(new Uint8Array(digest))
}

const constantTimeEqual = (left: string, right: string) => {
  const a = textEncoder.encode(left)
  const b = textEncoder.encode(right)
  if (a.length !== b.length) return false
  let difference = 0
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index]
  return difference === 0
}

export const isValidBookingReference = (value: unknown): value is string =>
  typeof value === 'string' && /^SB-[A-HJ-NP-Z2-9]{7}$/.test(value)

export const verifyBookingManagementToken = async (
  submitted: unknown,
  storedHash: string | null,
): Promise<boolean> => {
  const token = typeof submitted === 'string' ? submitted.trim().toLowerCase() : ''
  const validToken = /^[0-9a-f]{64}$/.test(token)
  const submittedHash = await sha256Hex(validToken ? token : '')
  const expectedHash = storedHash ?? '0'.repeat(64)
  const matches = constantTimeEqual(submittedHash, expectedHash)
  return Boolean(storedHash && validToken && matches)
}

export const isBookingCancellable = (
  status: string,
  startsAt: string,
  nowMilliseconds = Date.now(),
): boolean => {
  if (!['pending', 'confirmed'].includes(status)) return false
  const startMilliseconds = Date.parse(startsAt)
  return Number.isFinite(startMilliseconds) && startMilliseconds > nowMilliseconds
}

/** Accept only high-entropy UUID v4 keys generated for one booking attempt. */
export const isValidIdempotencyKey = (value: unknown): value is string =>
  typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
