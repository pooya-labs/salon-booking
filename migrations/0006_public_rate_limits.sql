-- Separate rate-limit buckets for public booking endpoints.
-- Only keyed HMACs are stored; raw client IP addresses are never persisted.

CREATE TABLE IF NOT EXISTS public_rate_limits (
  bucket_hash TEXT PRIMARY KEY,
  window_started_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL CHECK (attempts >= 0),
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_public_rate_limits_expiry
  ON public_rate_limits(expires_at);
