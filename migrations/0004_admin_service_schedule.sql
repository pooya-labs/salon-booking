-- Enforce one explicit override per salon-local calendar date.
CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_exceptions_local_date
  ON schedule_exceptions(local_date);
