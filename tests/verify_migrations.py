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

print("PASS: all D1 migrations apply; settings defaults and insert/update overlap triggers behave as expected.")
