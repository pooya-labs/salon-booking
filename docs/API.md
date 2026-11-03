# Public booking API

The API runs inside the Cloudflare Worker. All timestamps persisted in D1 are UTC ISO-8601 strings; client-facing dates and times are salon-local wall-clock values.

## Endpoints

### `GET /api/public/config`

Returns non-sensitive public scheduling configuration:

```json
{
  "ok": true,
  "configured": true,
  "timezone": "Europe/Berlin",
  "bookingWindowDays": 30,
  "slotIntervalMinutes": 15
}
```

When the timezone is still `unset`, `configured` is false and `timezone` is null. The client then falls back to the visitor timezone only to render a calendar; availability and booking remain unavailable until the salon timezone is configured.

### `GET /api/public/services`

Returns active services only.

```json
{
  "ok": true,
  "services": [
    {
      "id": "service-id",
      "name": "Service name",
      "description": "",
      "durationMinutes": 45,
      "priceAmount": 350000,
      "priceCurrency": "IRR"
    }
  ]
}
```

An empty array is valid until the salon's real service catalog is configured. Do not seed placeholder prices into production.

### `GET /api/public/availability?date=YYYY-MM-DD&serviceId=...`

The date is Gregorian in the URL (the browser can display its Jalali equivalent). The service duration, salon opening hours, date exceptions, notice period, booking horizon, buffer, timezone and existing active reservations are applied on the server.

```json
{
  "ok": true,
  "date": "2026-11-03",
  "timezone": "Europe/Berlin",
  "slots": ["09:00", "09:15", "10:00"]
}
```

Slots are local `HH:mm` strings. Cancelled, completed and no-show records do not block a slot; pending and confirmed records do. Dates outside the configured booking window are rejected.

### `POST /api/public/bookings`

Content type: `application/json`.

```json
{
  "serviceId": "service-id",
  "date": "2026-11-03",
  "time": "09:00",
  "name": "Client Name",
  "phone": "+491234567890",
  "note": ""
}
```

Success returns HTTP 201 with a random booking reference and `pending` status. The endpoint does not return client phone numbers or expose a client list. Client name, phone and note are length-validated; phone digits in Persian and Arabic-Indic numeral sets are normalized.

Common errors:
- `400`: invalid input or date outside the booking window.
- `404`: service does not exist or is inactive.
- `409 slot_unavailable`: slot is no longer available or conflicts with another booking.
- `503 schedule_not_configured`: the salon timezone or schedule is not ready.

## D1 configuration required before the API can create real bookings

Migration `0002_booking_engine.sql` creates `salon_settings` and overlap triggers. It deliberately sets `local_timezone` to `unset`; do not guess the salon's timezone. After the owner confirms the business location and Cloudflare D1 exists, set the IANA timezone, for example:

```sh
npx wrangler d1 execute salon-booking --remote --command "UPDATE salon_settings SET setting_value='Europe/Berlin' WHERE setting_key='local_timezone'"
```

The example is illustrative only. Replace it with the salon's confirmed IANA timezone.

Then configure the seven weekdays in `opening_hours`, create owner-approved service rows in `services`, and add holidays or one-off opening windows to `schedule_exceptions`. Never copy sample UI prices or hours into production without the owner's approval. The owner dashboard for managing these settings is a later phase.

## Conflict protection and current limitations

The D1 triggers reject overlapping inserts and updates for `pending` and `confirmed` bookings, including concurrent requests that both saw a time as free. The API rechecks availability before attempting the insert; the trigger remains the final database guard.

In the Cloudflare production build, the React client loads the public config and services, requests server-calculated slots, and submits the final booking to this API. Development and GitHub Pages builds deliberately use sample data and never submit customer information.

This initial public API does not yet include abuse/rate limiting, booking lookup, customer cancellation, owner authentication, notification delivery, or audit history. Do not treat this deployment as production-ready until the remaining security, privacy and operational roadmap gates pass. The GitHub Pages preview never invokes or hosts this API.


## Owner API

All /api/admin/* routes except GET /api/admin/setup-status require a valid owner session. Mutating requests must include a same-origin Origin header. No CORS allow-list is configured.

- GET /api/admin/setup-status: reports whether an owner account exists and whether one-time bootstrap is enabled. It reveals no account name or private data.
- POST /api/admin/bootstrap: creates the first owner only. Requires x-admin-bootstrap-token and JSON username/password; username 3–32 characters, password 12–128 characters. The insert is conditional on no existing owner.
- POST /api/admin/login: checks credentials and sets the owner session cookie.
- GET /api/admin/me: returns the current authenticated owner.
- POST /api/admin/logout: revokes the current session and clears its cookie.
- GET /api/admin/bookings?status=all: returns up to 200 appointments for the salon-local current day through six days ahead. An optional status filter is supported.
- PATCH /api/admin/bookings/{booking-uuid}/status: accepts confirmed, cancelled, completed or no_show subject to transition rules. Changes are written with an audit-log entry in a D1 batch transaction.

The cookie is named __Host-salon_session, with Path=/, HttpOnly, Secure and SameSite=Strict, and expires after 12 hours. Only a SHA-256 digest of the random 256-bit session token is stored in D1. Owner passwords are salted PBKDF2-HMAC-SHA-256 hashes (600,000 iterations), never plaintext. Login attempts are limited to 8 per IP-derived hashed bucket per 15 minutes; first-admin bootstrap is limited to 3 attempts per hour. The rate-limit table does not store raw IP addresses.

The owner interface is served at /admin by the Worker. On GitHub Pages, the same link opens a demo-only notice and never contacts the owner API.

Not yet implemented: owner service CRUD, weekly opening-hours/exception editing, client lookup/cancellation, password reset or multiple owner accounts. Public booking endpoint rate limiting and a full security review remain release blockers. See ADMIN.md.
