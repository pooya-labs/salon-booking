-- Support split shifts and breaks without losing existing single-window schedules.

CREATE TABLE IF NOT EXISTS opening_hour_intervals (
  id TEXT PRIMARY KEY,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 7),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  UNIQUE (weekday, position),
  CHECK (
    length(starts_at) = 5 AND starts_at GLOB '[0-2][0-9]:[0-5][0-9]'
    AND substr(starts_at, 1, 2) <= '23'
    AND length(ends_at) = 5 AND ends_at GLOB '[0-2][0-9]:[0-5][0-9]'
    AND substr(ends_at, 1, 2) <= '23'
    AND starts_at < ends_at
  )
);

CREATE INDEX IF NOT EXISTS idx_opening_hour_intervals_weekday
  ON opening_hour_intervals(weekday, position);

CREATE TABLE IF NOT EXISTS schedule_exception_intervals (
  id TEXT PRIMARY KEY,
  exception_id TEXT NOT NULL REFERENCES schedule_exceptions(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 7),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  UNIQUE (exception_id, position),
  CHECK (
    length(starts_at) = 5 AND starts_at GLOB '[0-2][0-9]:[0-5][0-9]'
    AND substr(starts_at, 1, 2) <= '23'
    AND length(ends_at) = 5 AND ends_at GLOB '[0-2][0-9]:[0-5][0-9]'
    AND substr(ends_at, 1, 2) <= '23'
    AND starts_at < ends_at
  )
);

CREATE INDEX IF NOT EXISTS idx_schedule_exception_intervals_parent
  ON schedule_exception_intervals(exception_id, position);

-- Backfill every legacy open interval. Closed days and closed exceptions remain empty.
INSERT OR IGNORE INTO opening_hour_intervals (id, weekday, position, starts_at, ends_at)
SELECT 'legacy-weekday-' || weekday, weekday, 0, opens_at, closes_at
FROM opening_hours
WHERE is_closed = 0 AND opens_at IS NOT NULL AND closes_at IS NOT NULL AND opens_at < closes_at;

INSERT OR IGNORE INTO schedule_exception_intervals (id, exception_id, position, starts_at, ends_at)
SELECT 'legacy-exception-' || id, id, 0, starts_at, ends_at
FROM schedule_exceptions
WHERE is_closed = 0 AND starts_at IS NOT NULL AND ends_at IS NOT NULL AND starts_at < ends_at;

CREATE TRIGGER IF NOT EXISTS opening_hour_intervals_no_overlap_insert
BEFORE INSERT ON opening_hour_intervals
WHEN EXISTS (
  SELECT 1 FROM opening_hour_intervals AS current
  WHERE current.weekday = NEW.weekday
    AND current.starts_at < NEW.ends_at
    AND current.ends_at > NEW.starts_at
)
BEGIN
  SELECT RAISE(ABORT, 'schedule_interval_overlap');
END;

CREATE TRIGGER IF NOT EXISTS opening_hour_intervals_no_overlap_update
BEFORE UPDATE OF weekday, starts_at, ends_at ON opening_hour_intervals
WHEN EXISTS (
  SELECT 1 FROM opening_hour_intervals AS current
  WHERE current.id <> NEW.id
    AND current.weekday = NEW.weekday
    AND current.starts_at < NEW.ends_at
    AND current.ends_at > NEW.starts_at
)
BEGIN
  SELECT RAISE(ABORT, 'schedule_interval_overlap');
END;

CREATE TRIGGER IF NOT EXISTS schedule_exception_intervals_no_overlap_insert
BEFORE INSERT ON schedule_exception_intervals
WHEN EXISTS (
  SELECT 1 FROM schedule_exception_intervals AS current
  WHERE current.exception_id = NEW.exception_id
    AND current.starts_at < NEW.ends_at
    AND current.ends_at > NEW.starts_at
)
BEGIN
  SELECT RAISE(ABORT, 'schedule_interval_overlap');
END;

CREATE TRIGGER IF NOT EXISTS schedule_exception_intervals_no_overlap_update
BEFORE UPDATE OF exception_id, starts_at, ends_at ON schedule_exception_intervals
WHEN EXISTS (
  SELECT 1 FROM schedule_exception_intervals AS current
  WHERE current.id <> NEW.id
    AND current.exception_id = NEW.exception_id
    AND current.starts_at < NEW.ends_at
    AND current.ends_at > NEW.starts_at
)
BEGIN
  SELECT RAISE(ABORT, 'schedule_interval_overlap');
END;
