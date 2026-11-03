import assert from 'node:assert/strict'
import test from 'node:test'
import worker from '../worker/index.ts'
import { createSessionToken, sha256Hex } from '../worker/admin-security.ts'

class FakeStatement {
  constructor(db, sql) {
    this.db = db
    this.sql = sql
    this.values = []
  }

  bind(...values) {
    this.values = values
    return this
  }

  async all() {
    if (this.sql.includes('FROM salon_settings')) {
      return {
        results: [
          { setting_key: 'local_timezone', setting_value: 'Europe/Berlin' },
          { setting_key: 'slot_interval_minutes', setting_value: '15' },
          { setting_key: 'min_booking_notice_minutes', setting_value: '0' },
          { setting_key: 'booking_window_days', setting_value: '30' },
          { setting_key: 'buffer_minutes', setting_value: '0' },
        ],
      }
    }
    return { results: [] }
  }

  async first() {
    if (this.sql.includes('RETURNING attempts')) return { attempts: 1 }
    if (this.sql.includes('WHERE bookings.reference_code = ?')) {
      return this.db.booking?.reference_code === this.values[0] ? { ...this.db.booking } : null
    }
    if (this.sql.includes('WHERE bookings.id = ?')) {
      return this.db.booking?.id === this.values[0] ? { ...this.db.booking } : null
    }
    return null
  }

  async run() {
    if (this.sql.includes('DELETE FROM public_rate_limits')) return { meta: { changes: 0 } }
    if (this.sql.includes('UPDATE bookings')) {
      const [id, now] = this.values
      const booking = this.db.booking
      if (
        booking?.id === id &&
        ['pending', 'confirmed'].includes(booking.status) &&
        booking.starts_at > now
      ) {
        booking.status = 'cancelled'
        return { meta: { changes: 1 } }
      }
      return { meta: { changes: 0 } }
    }
    return { meta: { changes: 0 } }
  }
}

class FakeDatabase {
  constructor(booking) {
    this.booking = booking
  }

  prepare(sql) {
    return new FakeStatement(this, sql)
  }
}

const createBooking = async ({ status = 'pending', startsAt, tokenHash } = {}) => ({
  id: 'booking-id',
  reference_code: 'SB-ABCDEFG',
  client_manage_token_hash: tokenHash ?? await sha256Hex(createSessionToken()),
  starts_at: startsAt ?? new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  ends_at: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
  status,
  service_name: 'Test service',
  duration_minutes: 30,
  client_name: 'Private Customer',
  client_phone: '+491234567890',
  client_note: 'Private note',
})

const makeRequest = (path, payload, { origin = 'https://salon.example' } = {}) => new Request(
  `https://salon.example/api/public/bookings/${path}`,
  {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': '203.0.113.12',
      ...(origin ? { origin, 'sec-fetch-site': 'same-origin' } : {}),
    },
    body: JSON.stringify(payload),
  },
)

const callWorker = (request, db) => worker.fetch(request, {
  DB: db,
  SESSION_SECRET: 'unit-test-session-secret-that-is-long-enough-64-bytes',
  ASSETS: { fetch: async () => new Response('not found', { status: 404 }) },
})

test('customer lookup requires both secrets and returns only a minimal booking summary', async () => {
  const token = createSessionToken()
  const booking = await createBooking({ tokenHash: await sha256Hex(token) })
  const response = await callWorker(
    makeRequest('lookup', { reference: booking.reference_code, managementToken: token }),
    new FakeDatabase(booking),
  )
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.equal(payload.booking.reference, booking.reference_code)
  assert.equal(payload.booking.serviceName, 'Test service')
  assert.equal(payload.booking.status, 'pending')
  assert.equal(payload.booking.cancellable, true)
  assert.equal('client_name' in payload.booking, false)
  assert.equal('client_phone' in payload.booking, false)
  assert.equal('client_note' in payload.booking, false)
})

test('invalid reference and wrong management token share the same not-found response', async () => {
  const token = createSessionToken()
  const booking = await createBooking({ tokenHash: await sha256Hex(token) })
  const db = new FakeDatabase(booking)
  const wrongTokenResponse = await callWorker(
    makeRequest('lookup', { reference: booking.reference_code, managementToken: createSessionToken() }),
    db,
  )
  const missingReferenceResponse = await callWorker(
    makeRequest('lookup', { reference: 'SB-AAAAAAA', managementToken: token }),
    db,
  )
  assert.equal(wrongTokenResponse.status, 404)
  assert.deepEqual(await wrongTokenResponse.json(), await missingReferenceResponse.json())
})

test('customer cancellation changes only a future pending or confirmed booking', async () => {
  const token = createSessionToken()
  const booking = await createBooking({ status: 'confirmed', tokenHash: await sha256Hex(token) })
  const response = await callWorker(
    makeRequest('cancel', { reference: booking.reference_code, managementToken: token }),
    new FakeDatabase(booking),
  )
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.equal(booking.status, 'cancelled')
  assert.equal(payload.booking.status, 'cancelled')
  assert.equal(payload.booking.cancellable, false)
})

test('customer cancellation refuses an appointment that has already started', async () => {
  const token = createSessionToken()
  const booking = await createBooking({
    status: 'pending',
    startsAt: new Date(Date.now() - 60 * 1000).toISOString(),
    tokenHash: await sha256Hex(token),
  })
  const response = await callWorker(
    makeRequest('cancel', { reference: booking.reference_code, managementToken: token }),
    new FakeDatabase(booking),
  )
  const payload = await response.json()

  assert.equal(response.status, 409)
  assert.equal(payload.error, 'booking_not_cancellable')
  assert.equal(booking.status, 'pending')
})

test('customer booking management rejects cross-origin requests', async () => {
  const token = createSessionToken()
  const booking = await createBooking({ tokenHash: await sha256Hex(token) })
  const response = await callWorker(
    makeRequest('lookup', { reference: booking.reference_code, managementToken: token }, { origin: null }),
    new FakeDatabase(booking),
  )
  assert.equal(response.status, 403)
})
