import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "migrations"

db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys = ON")

for migration in sorted(MIGRATIONS.glob("*.sql")):
    db.executescript(migration.read_text(encoding="utf-8"))

settings = dict(db.execute("SELECT setting_key, setting_value FROM salon_settings"))
assert settings["local_timezone"] == "unset"
assert settings["slot_interval_minutes"] == "15"
assert settings["min_booking_notice_minutes"] == "120"

# Admin security migration creates hashed-IP rate-limit buckets and an audit trail.
db.execute(
    "INSERT INTO admin_rate_limits (bucket_hash, window_started_at, attempts, expires_at) VALUES (?, ?, ?, ?)",
    ("rate-limit-test", 1000, 1, 2000),
)
attempt_count = db.execute(
    """INSERT INTO admin_rate_limits (bucket_hash, window_started_at, attempts, expires_at)
       VALUES (?, ?, 1, ?)
       ON CONFLICT(bucket_hash) DO UPDATE SET
         attempts = CASE WHEN admin_rate_limits.window_started_at = excluded.window_started_at
                         THEN admin_rate_limits.attempts + 1 ELSE 1 END,
         window_started_at = excluded.window_started_at,
         expires_at = excluded.expires_at
       RETURNING attempts""",
    ("rate-limit-test", 1000, 2000),
).fetchone()[0]
assert attempt_count == 2
next_window_count = db.execute(
    """INSERT INTO admin_rate_limits (bucket_hash, window_started_at, attempts, expires_at)
       VALUES (?, ?, 1, ?)
       ON CONFLICT(bucket_hash) DO UPDATE SET
         attempts = CASE WHEN admin_rate_limits.window_started_at = excluded.window_started_at
                         THEN admin_rate_limits.attempts + 1 ELSE 1 END,
         window_started_at = excluded.window_started_at,
         expires_at = excluded.expires_at
       RETURNING attempts""",
    ("rate-limit-test", 2000, 3000),
).fetchone()[0]
assert next_window_count == 1

db.execute(
    "INSERT INTO admin_users (id, username, password_hash) VALUES (?, ?, ?)",
    ("admin-test", "owner-test", "test-hash"),
)
db.execute(
    """INSERT INTO admin_audit_log
       (id, actor_user_id, action, entity_type, entity_id, details_json)
       VALUES (?, ?, ?, ?, ?, ?)""",
    ("audit-test", "admin-test", "booking.status_changed", "booking", "booking-a", '{"from":"pending","to":"confirmed"}'),
)
assert db.execute("SELECT COUNT(*) FROM admin_audit_log").fetchone()[0] == 1

db.execute(
    "INSERT INTO services (id, name, duration_minutes, price_amount) VALUES (?, ?, ?, ?)",
    ("service-test", "Test service", 30, 100),
)


def insert_booking(identifier, reference, starts_at, ends_at, status="pending"):
    db.execute(
        """INSERT INTO bookings
           (id, reference_code, service_id, client_name, client_phone, starts_at, ends_at, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (identifier, reference, "service-test", "Test Client", "+491234567890", starts_at, ends_at, status),
    )


insert_booking("booking-a", "SB-AAAAAAA", "2026-11-03T09:00:00.000Z", "2026-11-03T10:00:00.000Z")
insert_booking("booking-b", "SB-BBBBBBB", "2026-11-03T10:00:00.000Z", "2026-11-03T11:00:00.000Z")

try:
    insert_booking("booking-c", "SB-CCCCCCC", "2026-11-03T09:30:00.000Z", "2026-11-03T09:45:00.000Z")
    raise AssertionError("overlapping insert unexpectedly succeeded")
except sqlite3.IntegrityError as error:
    assert "booking_time_conflict" in str(error)

try:
    db.execute(
        "UPDATE bookings SET starts_at = ?, ends_at = ? WHERE id = ?",
        ("2026-11-03T09:45:00.000Z", "2026-11-03T10:30:00.000Z", "booking-b"),
    )
    raise AssertionError("overlapping update unexpectedly succeeded")
except sqlite3.IntegrityError as error:
    assert "booking_time_conflict" in str(error)

db.execute("UPDATE bookings SET status = 'cancelled' WHERE id = 'booking-a'")
insert_booking("booking-c", "SB-CCCCCCC", "2026-11-03T09:30:00.000Z", "2026-11-03T09:45:00.000Z")

print("PASS: all D1 migrations, defaults, overlap triggers, rate-limit buckets and audit-log schema behave as expected.")
