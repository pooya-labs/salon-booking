import assert from 'node:assert/strict'
import test from 'node:test'
import { createSessionToken, sha256Hex, isSameOriginRequest } from '../worker/admin-security.ts'
import {
  isBookingCancellable,
  isValidBookingReference,
  isValidIdempotencyKey,
  verifyBookingManagementToken,
} from '../worker/customer-booking-security.ts'

test('booking references accept only the generated unambiguous alphabet and format', () => {
  assert.equal(isValidBookingReference('SB-ABCDEFG'), true)
  assert.equal(isValidBookingReference('sb-ABCDEFG'), false)
  assert.equal(isValidBookingReference('SB-ABC0EFG'), false)
  assert.equal(isValidBookingReference('SB-ABCDEFG-extra'), false)
  assert.equal(isValidBookingReference(null), false)
})

test('management token verifier accepts only the stored one-time secret digest', async () => {
  const token = createSessionToken()
  const digest = await sha256Hex(token)

  assert.equal(await verifyBookingManagementToken(token, digest), true)
  assert.equal(await verifyBookingManagementToken(token.toUpperCase(), digest), true)
  assert.equal(await verifyBookingManagementToken(createSessionToken(), digest), false)
  assert.equal(await verifyBookingManagementToken('not-a-token', digest), false)
  assert.equal(await verifyBookingManagementToken(token, null), false)
  assert.equal(await verifyBookingManagementToken(null, null), false)
})

test('booking management token is a random 256-bit secret and only its hash is persisted', async () => {
  const token = createSessionToken()
  const digest = await sha256Hex(token)

  assert.match(token, /^[0-9a-f]{64}$/)
  assert.match(digest, /^[0-9a-f]{64}$/)
  assert.notEqual(digest, token)
  assert.equal(await sha256Hex(token), digest)
})

test('only pending and confirmed future appointments can be cancelled', () => {
  const future = new Date(Date.now() + 60_000).toISOString()
  const past = new Date(Date.now() - 60_000).toISOString()

  assert.equal(isBookingCancellable('pending', future), true)
  assert.equal(isBookingCancellable('confirmed', future), true)
  assert.equal(isBookingCancellable('cancelled', future), false)
  assert.equal(isBookingCancellable('completed', future), false)
  assert.equal(isBookingCancellable('no_show', future), false)
  assert.equal(isBookingCancellable('pending', past), false)
  assert.equal(isBookingCancellable('unknown', future), false)
  assert.equal(isBookingCancellable('pending', 'not-a-date'), false)
})

test('customer management mutations require same-origin requests', () => {
  const same = new Request('https://salon.example/api/public/bookings/cancel', {
    method: 'POST',
    headers: { origin: 'https://salon.example', 'sec-fetch-site': 'same-origin' },
  })
  const cross = new Request('https://salon.example/api/public/bookings/cancel', {
    method: 'POST',
    headers: { origin: 'https://attacker.example', 'sec-fetch-site': 'cross-site' },
  })
  const missing = new Request('https://salon.example/api/public/bookings/cancel', { method: 'POST' })

  assert.equal(isSameOriginRequest(same), true)
  assert.equal(isSameOriginRequest(cross), false)
  assert.equal(isSameOriginRequest(missing), false)
})

test('booking idempotency accepts UUID v4 keys and rejects malformed or low-entropy values', () => {
  assert.equal(isValidIdempotencyKey('550e8400-e29b-41d4-a716-446655440000'), true)
  assert.equal(isValidIdempotencyKey('550E8400-E29B-41D4-A716-446655440000'), true)
  assert.equal(isValidIdempotencyKey('booking-attempt-1'), false)
  assert.equal(isValidIdempotencyKey('550e8400-e29b-11d4-a716-446655440000'), false)
  assert.equal(isValidIdempotencyKey('550e8400-e29b-41d4-c716-446655440000'), false)
  assert.equal(isValidIdempotencyKey(null), false)
})
