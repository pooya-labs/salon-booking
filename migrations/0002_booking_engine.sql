-- Salon Booking — booking engine settings and conflict protection.
-- The salon timezone is intentionally unset until the owner confirms the business location.

CREATE TABLE IF NOT EXISTS salon_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO salon_settings (setting_key, setting_value) VALUES
  ('local_timezone', 'unset'),
  ('slot_interval_minutes', '15'),
  ('min_booking_notice_minutes', '120'),
  ('booking_window_days', '30'),
  ('buffer_minutes', '0');

-- The database is the final authority for overlap prevention. This protects
-- simultaneous requests that both observed the same slot as available.
CREATE TRIGGER IF NOT EXISTS bookings_no_overlap_insert
BEFORE INSERT ON bookings
WHEN NEW.status IN ('pending', 'confirmed')
BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM bookings AS existing
    WHERE existing.status IN ('pending', 'confirmed')
      AND existing.starts_at < NEW.ends_at
      AND existing.ends_at > NEW.starts_at
  ) THEN RAISE(ABORT, 'booking_time_conflict') END;
END;

CREATE TRIGGER IF NOT EXISTS bookings_no_overlap_update
BEFORE UPDATE OF starts_at, ends_at, status ON bookings
WHEN NEW.status IN ('pending', 'confirmed')
BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM bookings AS existing
    WHERE existing.id <> NEW.id
      AND existing.status IN ('pending', 'confirmed')
      AND existing.starts_at < NEW.ends_at
      AND existing.ends_at > NEW.starts_at
  ) THEN RAISE(ABORT, 'booking_time_conflict') END;
END;
