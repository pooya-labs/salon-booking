import assert from 'node:assert/strict'
import test from 'node:test'
import { createRateLimitBucketHash, getRateLimitWindow } from '../worker/rate-limit.ts'

test('rate-limit windows reset on fixed boundaries and expose a retry duration', () => {
  assert.deepEqual(getRateLimitWindow(1700, 900), {
    startedAt: 900,
    expiresAt: 2700,
    retryAfter: 100,
  })
})

test('rate-limit windows reject invalid inputs', () => {
  assert.throws(() => getRateLimitWindow(-1, 60), /invalid_rate_limit_time/)
  assert.throws(() => getRateLimitWindow(100, 0), /invalid_rate_limit_window/)
})

test('IP bucket identifiers are HMAC-only, stable and scope-separated', async () => {
  const secret = '0123456789abcdef0123456789abcdef'
  const first = await createRateLimitBucketHash(secret, 'public:booking', '203.0.113.10')
  const repeated = await createRateLimitBucketHash(secret, 'public:booking', '203.0.113.10')
  const anotherScope = await createRateLimitBucketHash(secret, 'public:availability', '203.0.113.10')

  assert.equal(first, repeated)
  assert.notEqual(first, anotherScope)
  assert.match(first, /^[a-f0-9]{64}$/)
  assert.equal(first.includes('203.0.113.10'), false)
  await assert.rejects(
    createRateLimitBucketHash('short', 'public:booking', '203.0.113.10'),
    /invalid_rate_limit_input/,
  )
})
