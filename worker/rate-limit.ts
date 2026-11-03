export interface RateLimitWindow {
  startedAt: number
  expiresAt: number
  retryAfter: number
}

export const getRateLimitWindow = (nowSeconds: number, windowSeconds: number): RateLimitWindow => {
  if (!Number.isSafeInteger(nowSeconds) || nowSeconds < 0) throw new Error('invalid_rate_limit_time')
  if (!Number.isSafeInteger(windowSeconds) || windowSeconds < 1) throw new Error('invalid_rate_limit_window')
  const startedAt = Math.floor(nowSeconds / windowSeconds) * windowSeconds
  return {
    startedAt,
    expiresAt: startedAt + windowSeconds * 2,
    retryAfter: Math.max(1, startedAt + windowSeconds - nowSeconds),
  }
}

export const createRateLimitBucketHash = async (
  secret: string,
  scope: string,
  identity: string,
): Promise<string> => {
  if (secret.length < 32 || !scope || !identity) throw new Error('invalid_rate_limit_input')
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${scope}:${identity}`),
  )
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
