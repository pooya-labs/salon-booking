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

# Split working windows are normalized, ordered and protected from overlap.
db.execute(
    "INSERT INTO opening_hour_intervals (id, weekday, position, starts_at, ends_at) VALUES (?, ?, ?, ?, ?)",
    ("hours-a", 1, 0, "09:00", "13:00"),
)
db.execute(
    "INSERT INTO opening_hour_intervals (id, weekday, position, starts_at, ends_at) VALUES (?, ?, ?, ?, ?)",
    ("hours-b", 1, 1, "15:00", "19:00"),
)
try:
    db.execute(
        "INSERT INTO opening_hour_intervals (id, weekday, position, starts_at, ends_at) VALUES (?, ?, ?, ?, ?)",
        ("hours-c", 1, 2, "12:00", "16:00"),
    )
    raise AssertionError("overlapping weekly interval unexpectedly succeeded")
except sqlite3.IntegrityError as error:
    assert "schedule_interval_overlap" in str(error)

# Schedule exceptions are unique by salon-local date.
db.execute(
    "INSERT INTO schedule_exceptions (id, local_date, is_closed, note) VALUES (?, ?, ?, ?)",
    ("exception-a", "2026-12-25", 1, "Holiday"),
)
try:
    db.execute(
        "INSERT INTO schedule_exceptions (id, local_date, is_closed, note) VALUES (?, ?, ?, ?)",
        ("exception-b", "2026-12-25", 1, "Duplicate"),
    )
    raise AssertionError("duplicate schedule exception unexpectedly succeeded")
except sqlite3.IntegrityError:
    pass

db.execute(
    "INSERT INTO schedule_exception_intervals (id, exception_id, position, starts_at, ends_at) VALUES (?, ?, ?, ?, ?)",
    ("exception-window-a", "exception-a", 0, "10:00", "13:00"),
)
try:
    db.execute(
        "INSERT INTO schedule_exception_intervals (id, exception_id, position, starts_at, ends_at) VALUES (?, ?, ?, ?, ?)",
        ("exception-window-b", "exception-a", 1, "12:00", "14:00"),
    )
    raise AssertionError("overlapping exception interval unexpectedly succeeded")
except sqlite3.IntegrityError as error:
    assert "schedule_interval_overlap" in str(error)

db.execute(
    "INSERT INTO services (id, name, duration_minutes, price_amount) VALUES (?, ?, ?, ?)",
    ("service-test", "Test service", 30, 100),
)


def insert_booking(identifier, reference, starts_at, ends_at, status="pending"):
    service_duration = db.execute(
        "SELECT duration_minutes FROM services WHERE id = 'service-test'"
    ).fetchone()[0]
    db.execute(
        """INSERT INTO bookings
           (id, reference_code, service_id, client_name, client_phone, starts_at, ends_at, status, service_duration_minutes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (identifier, reference, "service-test", "Test Client", "+491234567890", starts_at, ends_at, status, service_duration),
    )


insert_booking("booking-a", "SB-AAAAAAA", "2026-11-03T09:00:00.000Z", "2026-11-03T10:00:00.000Z")

# Booking idempotency stores keyed request identifiers and response metadata only.
db.execute(
    """INSERT INTO booking_idempotency
       (idempotency_key_hash, request_hash, booking_id, response_json)
       VALUES (?, ?, ?, ?)""",
    ("idem-key-hash-a", "request-hash-a", "booking-a",
     '{"reference":"SB-AAAAAAA","status":"pending","serviceName":"Test service"}'),
)
idempotency_columns = {row[1] for row in db.execute("PRAGMA table_info(booking_idempotency)")}
assert {"idempotency_key_hash", "request_hash", "booking_id", "response_json", "created_at"} <= idempotency_columns
assert not any(token in column.lower() for column in idempotency_columns for token in ("name", "phone", "note", "email"))
idempotency_foreign_keys = db.execute("PRAGMA foreign_key_list(booking_idempotency)").fetchall()
assert any(row[2] == "bookings" and row[6].upper() == "CASCADE" for row in idempotency_foreign_keys)
insert_booking("booking-b", "SB-BBBBBBB", "2026-11-03T10:00:00.000Z", "2026-11-03T11:00:00.000Z")
try:
    db.execute(
        """INSERT INTO booking_idempotency
           (idempotency_key_hash, request_hash, booking_id, response_json)
           VALUES (?, ?, ?, ?)""",
        ("idem-key-hash-a", "different-request-hash", "booking-b", "{}"),
    )
    raise AssertionError("duplicate idempotency key unexpectedly succeeded")
except sqlite3.IntegrityError:
    pass
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
status_event = db.execute(
    "SELECT previous_status, new_status FROM booking_status_events WHERE booking_id = 'booking-a'"
).fetchone()
assert status_event == ("pending", "cancelled")

# Status history intentionally contains no customer identity/contact fields and cascades on booking erasure.
event_columns = {row[1] for row in db.execute("PRAGMA table_info(booking_status_events)")}
assert {"id", "booking_id", "previous_status", "new_status", "created_at"} <= event_columns
assert not any(token in column.lower() for column in event_columns for token in ("name", "phone", "note", "email", "address"))
event_foreign_keys = db.execute("PRAGMA foreign_key_list(booking_status_events)").fetchall()
assert any(row[2] == "bookings" and row[6].upper() == "CASCADE" for row in event_foreign_keys)

# The sample audit detail stores only a state transition, never client contact or note data.
audit_details = db.execute("SELECT details_json FROM admin_audit_log WHERE id = 'audit-test'").fetchone()[0]
assert "Test Client" not in audit_details
assert "+491234567890" not in audit_details
assert "private client note" not in audit_details

insert_booking("booking-c", "SB-CCCCCCC", "2026-11-03T09:30:00.000Z", "2026-11-03T09:45:00.000Z")
db.execute("DELETE FROM bookings WHERE id = 'booking-a'")
assert db.execute("SELECT COUNT(*) FROM booking_status_events WHERE booking_id = 'booking-a'").fetchone()[0] == 0
assert db.execute("SELECT COUNT(*) FROM booking_idempotency WHERE booking_id = 'booking-a'").fetchone()[0] == 0

print("PASS: D1 migrations, overlap triggers, rate-limit buckets, privacy-minimal status history, cascading booking erasure, audit log and unique schedule exceptions behave as expected.")


# Migration 0009 backfills a duration snapshot and later service edits do not rewrite it.
snapshot_db = sqlite3.connect(":memory:")
snapshot_db.execute("PRAGMA foreign_keys = ON")
for migration in sorted(MIGRATIONS.glob("*.sql")):
    if migration.name in {"0009_booking_service_duration_snapshot.sql", "0010_booking_service_name_snapshot.sql"}:
        continue
    snapshot_db.executescript(migration.read_text(encoding="utf-8"))
snapshot_db.execute(
    "INSERT INTO services (id, name, duration_minutes, price_amount) VALUES (?, ?, ?, ?)",
    ("snapshot-service", "Snapshot service", 45, 250),
)
snapshot_db.execute(
    """INSERT INTO bookings
       (id, reference_code, service_id, client_name, client_phone, starts_at, ends_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
    ("snapshot-booking", "SB-SNAP000", "snapshot-service", "Test Client", "+491234567890",
     "2027-02-01T09:00:00.000Z", "2027-02-01T09:45:00.000Z", "pending"),
)
snapshot_db.executescript((MIGRATIONS / "0009_booking_service_duration_snapshot.sql").read_text(encoding="utf-8"))
assert snapshot_db.execute(
    "SELECT service_duration_minutes FROM bookings WHERE id = 'snapshot-booking'"
).fetchone()[0] == 45
snapshot_db.executescript((MIGRATIONS / "0010_booking_service_name_snapshot.sql").read_text(encoding="utf-8"))
assert snapshot_db.execute(
    "SELECT service_name_snapshot FROM bookings WHERE id = 'snapshot-booking'"
).fetchone()[0] == "Snapshot service"
snapshot_db.execute("UPDATE services SET name = 'Renamed snapshot service', duration_minutes = 90 WHERE id = 'snapshot-service'")
assert snapshot_db.execute(
    "SELECT service_duration_minutes, service_name_snapshot FROM bookings WHERE id = 'snapshot-booking'"
).fetchone() == (45, "Snapshot service")
snapshot_db.close()


# Migration 0005 preserves legacy one-window weekly schedules and date overrides.
legacy_db = sqlite3.connect(":memory:")
legacy_db.execute("PRAGMA foreign_keys = ON")
for migration in sorted(MIGRATIONS.glob("*.sql")):
    if migration.name == "0005_multi_interval_schedule.sql":
        continue
    legacy_db.executescript(migration.read_text(encoding="utf-8"))
legacy_db.execute(
    "INSERT INTO opening_hours (id, weekday, opens_at, closes_at, is_closed) VALUES (?, ?, ?, ?, ?)",
    ("legacy-hours", 1, "08:30", "16:30", 0),
)
legacy_db.execute(
    "INSERT INTO schedule_exceptions (id, local_date, starts_at, ends_at, is_closed, note) VALUES (?, ?, ?, ?, ?, ?)",
    ("legacy-date", "2027-01-02", "10:00", "14:00", 0, "Legacy override"),
)
legacy_db.executescript((MIGRATIONS / "0005_multi_interval_schedule.sql").read_text(encoding="utf-8"))
assert legacy_db.execute(
    "SELECT starts_at, ends_at FROM opening_hour_intervals WHERE weekday = 1"
).fetchone() == ("08:30", "16:30")
assert legacy_db.execute(
    "SELECT starts_at, ends_at FROM schedule_exception_intervals WHERE exception_id = 'legacy-date'"
).fetchone() == ("10:00", "14:00")
legacy_db.close()


# Public booking rate-limit buckets are separate and support atomic fixed-window increments.
public_attempts = db.execute(
    """INSERT INTO public_rate_limits (bucket_hash, window_started_at, attempts, expires_at)
       VALUES (?, ?, 1, ?)
       ON CONFLICT(bucket_hash) DO UPDATE SET
         attempts = CASE WHEN public_rate_limits.window_started_at = excluded.window_started_at
                         THEN public_rate_limits.attempts + 1 ELSE 1 END,
         window_started_at = excluded.window_started_at,
         expires_at = excluded.expires_at
       RETURNING attempts""",
    ("public-hmac-bucket", 900, 2700),
).fetchone()[0]
assert public_attempts == 1
public_attempts = db.execute(
    """INSERT INTO public_rate_limits (bucket_hash, window_started_at, attempts, expires_at)
       VALUES (?, ?, 1, ?)
       ON CONFLICT(bucket_hash) DO UPDATE SET
         attempts = CASE WHEN public_rate_limits.window_started_at = excluded.window_started_at
                         THEN public_rate_limits.attempts + 1 ELSE 1 END,
         window_started_at = excluded.window_started_at,
         expires_at = excluded.expires_at
       RETURNING attempts""",
    ("public-hmac-bucket", 900, 2700),
).fetchone()[0]
assert public_attempts == 2
db.execute("DELETE FROM public_rate_limits WHERE expires_at <= ?", (2700,))
assert db.execute("SELECT COUNT(*) FROM public_rate_limits").fetchone()[0] == 0
