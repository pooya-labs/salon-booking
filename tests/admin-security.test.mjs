import test from 'node:test'
import assert from 'node:assert/strict'
import {
  clearSessionCookie,
  constantTimeEqual,
  createPasswordHash,
  createSessionToken,
  getSessionCookie,
  isSameOriginRequest,
  sessionCookie,
  sha256Hex,
  verifyPasswordHash,
  validAdminUsername,
} from '../worker/admin-security.ts'

test('password hashes are salted and verify without storing plaintext', async () => {
  const password = 'A-long-owner-password-2026!'
  const hash = await createPasswordHash(password)
  assert.match(hash, /^pbkdf2-sha256\$600000\$/)
  assert.notEqual(hash.includes(password), true)
  assert.equal(await verifyPasswordHash(password, hash), true)
  assert.equal(await verifyPasswordHash('a-different-password', hash), false)
  assert.equal(await verifyPasswordHash(password, 'not-a-valid-hash'), false)
})

test('session tokens are unpredictable-looking, 256-bit hex values', () => {
  const first = createSessionToken()
  const second = createSessionToken()
  assert.match(first, /^[0-9a-f]{64}$/)
  assert.notEqual(first, second)
})

test('session cookies use host-only secure attributes and expire cleanly', () => {
  const token = createSessionToken()
  const cookie = sessionCookie(token, 43200)
  assert.match(cookie, /^__Host-salon_session=/)
  assert.match(cookie, /Path=\//)
  assert.match(cookie, /HttpOnly/)
  assert.match(cookie, /Secure/)
  assert.match(cookie, /SameSite=Strict/)
  assert.match(clearSessionCookie(), /Max-Age=0/)
})

test('session parser ignores unrelated and malformed cookies', () => {
  const token = createSessionToken()
  const request = new Request('https://salon.example/admin', {
    headers: { cookie: `theme=dark; __Host-salon_session=${token}; other=value` },
  })
  assert.equal(getSessionCookie(request), token)
  const malformed = new Request('https://salon.example/admin', {
    headers: { cookie: '__Host-salon_session=not-a-token' },
  })
  assert.equal(getSessionCookie(malformed), null)
})

test('mutating requests require a matching origin', () => {
  const same = new Request('https://salon.example/api/admin/login', {
    method: 'POST',
    headers: { origin: 'https://salon.example', 'sec-fetch-site': 'same-origin' },
  })
  const cross = new Request('https://salon.example/api/admin/login', {
    method: 'POST',
    headers: { origin: 'https://attacker.example', 'sec-fetch-site': 'cross-site' },
  })
  const missing = new Request('https://salon.example/api/admin/login', { method: 'POST' })
  assert.equal(isSameOriginRequest(same), true)
  assert.equal(isSameOriginRequest(cross), false)
  assert.equal(isSameOriginRequest(missing), false)
})

test('constant-time token comparison and username validation reject malformed values', () => {
  assert.equal(constantTimeEqual('same-secret', 'same-secret'), true)
  assert.equal(constantTimeEqual('same-secret', 'wrong-secret'), false)
  assert.equal(constantTimeEqual('short', 'longer'), false)
  assert.equal(validAdminUsername('salon.owner_1'), true)
  assert.equal(validAdminUsername('x'), false)
  assert.equal(validAdminUsername('not a username'), false)
})


test('customer management credentials are random 256-bit secrets stored as one-way digests', async () => {
  const token = createSessionToken()
  const digest = await sha256Hex(token)
  assert.match(token, /^[0-9a-f]{64}$/)
  assert.match(digest, /^[0-9a-f]{64}$/)
  assert.notEqual(digest, token)
  assert.equal(await sha256Hex(token), digest)
})
