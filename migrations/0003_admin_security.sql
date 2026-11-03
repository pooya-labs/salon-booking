-- Salon Booking — admin security, rate limits and operational audit log.

CREATE TABLE IF NOT EXISTS admin_rate_limits (
  bucket_hash TEXT PRIMARY KEY,
  window_started_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL CHECK (attempts >= 0),
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_rate_limits_expiry
  ON admin_rate_limits(expires_at);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT NOT NULL REFERENCES admin_users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_actor_created
  ON admin_audit_log(actor_user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_admin_audit_entity_created
  ON admin_audit_log(entity_type, entity_id, created_at);
