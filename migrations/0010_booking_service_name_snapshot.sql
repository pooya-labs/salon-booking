-- Preserve the service name displayed for the appointment as it was booked.
-- Older rows can only be backfilled from the current service catalog.
ALTER TABLE bookings
  ADD COLUMN service_name_snapshot TEXT NOT NULL DEFAULT '';

UPDATE bookings
SET service_name_snapshot = (
  SELECT services.name
  FROM services
  WHERE services.id = bookings.service_id
);
