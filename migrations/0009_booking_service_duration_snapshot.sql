-- Preserve the service length that the customer actually booked.
-- Historical rows can only be backfilled from the current service catalog.
ALTER TABLE bookings
  ADD COLUMN service_duration_minutes INTEGER NOT NULL DEFAULT 5
  CHECK (service_duration_minutes BETWEEN 5 AND 480);

UPDATE bookings
SET service_duration_minutes = (
  SELECT services.duration_minutes
  FROM services
  WHERE services.id = bookings.service_id
);
