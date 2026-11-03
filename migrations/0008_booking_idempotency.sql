-- Server-side replay protection for customer booking creation.
-- Only keyed hashes are stored; no idempotency key or customer payload is persisted.

CREATE TABLE IF NOT EXISTS booking_idempotency (
  idempotency_key_hash TEXT PRIMARY KEY,
  request_hash TEXT NOT NULL,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_booking_idempotency_booking
  ON booking_idempotency(booking_id);
