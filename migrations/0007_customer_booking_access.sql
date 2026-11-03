-- Secure customer self-service access for bookings created after this migration.
-- The plaintext management token is only returned once at booking creation.

ALTER TABLE bookings ADD COLUMN client_manage_token_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_bookings_reference_manage_token
  ON bookings(reference_code, client_manage_token_hash);

-- A minimal status history captures customer and owner cancellations without
-- duplicating customer names, phone numbers or notes.
CREATE TABLE IF NOT EXISTS booking_status_events (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  previous_status TEXT NOT NULL CHECK (previous_status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
  new_status TEXT NOT NULL CHECK (new_status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (previous_status <> new_status)
);

CREATE INDEX IF NOT EXISTS idx_booking_status_events_booking_created
  ON booking_status_events(booking_id, created_at);

CREATE TRIGGER IF NOT EXISTS bookings_status_history_after_update
AFTER UPDATE OF status ON bookings
WHEN OLD.status <> NEW.status
BEGIN
  INSERT INTO booking_status_events (id, booking_id, previous_status, new_status)
  VALUES (lower(hex(randomblob(16))), NEW.id, OLD.status, NEW.status);
END;
