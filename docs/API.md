# API reference

The API runs inside the Cloudflare Worker. Timestamps persisted in D1 are UTC ISO-8601 strings; dates and clock times accepted from clients are salon-local values. The salon timezone must be explicitly configured before availability or booking is enabled.

## Public endpoints

### `GET /api/public/config`

Returns non-sensitive scheduling settings:

```json
{
  "ok": true,
  "configured": true,
  "timezone": "Europe/Berlin",
  "bookingWindowDays": 30,
  "slotIntervalMinutes": 15
}
```

When the timezone is `unset`, `configured` is false and `timezone` is null. The visitor timezone may be used to render a calendar only; availability and booking remain unavailable.

### `GET /api/public/services`

Returns active services only. An empty array is valid until the salon owner configures the real service catalog. Never seed placeholder prices into production.

### `GET /api/public/availability?date=YYYY-MM-DD&serviceId=...`

The URL date is Gregorian (the UI may display a Jalali equivalent). The server applies service duration, all weekly or date-specific opening intervals, booking notice, booking horizon, buffer, salon timezone and active reservations.

Example:

```json
{
  "ok": true,
  "date": "2026-11-03",
  "timezone": "Europe/Berlin",
  "slots": ["09:00", "09:15", "10:00", "15:00"]
}
```

Slots are salon-local `HH:mm` strings. A proposed appointment including its configured buffer must fit entirely inside one opening interval; a slot cannot bridge a break. Cancelled, completed and no-show bookings do not block availability; pending and confirmed bookings do.

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

Success returns HTTP 201 with a random booking reference, a one-time 256-bit management token, and `pending` status. The management token is shown to the client only in this response; D1 stores only its SHA-256 digest. The token is a bearer credential: anyone holding both it and the booking reference can view or cancel that booking. The endpoint does not expose a client list or return phone numbers. Name, phone and note are validated; Persian and Arabic-Indic phone digits are normalized.

Keep both returned values. The management token cannot be recovered or displayed again. Bookings created before migration 0007 have no management token and cannot use customer self-service.

Common errors:
- `400`: invalid input or date outside the booking window.
- `404`: service does not exist or is inactive.
- `409 slot_unavailable`: slot is no longer available or conflicts with another booking.
- `503 schedule_not_configured`: salon timezone or schedule is not ready.

### `POST /api/public/bookings/lookup`

Requires a same-origin request and the following JSON body:

```json
{
  "reference": "SB-ABCDEFG",
  "managementToken": "64-character-random-hex-token"
}
```

Returns only the booking reference, service name, salon-local date and time, duration and status. It never returns customer name, phone number or notes. A missing reference and an invalid token share the same HTTP 404 response to reduce booking enumeration.

### `POST /api/public/bookings/cancel`

Uses the same body and proof of possession as lookup. It cancels a booking only while its status is `pending` or `confirmed` and its start time is still in the future. A repeated cancellation returns the already-cancelled state. Started, completed or no-show appointments cannot be cancelled through this endpoint.

Both customer-management endpoints share a separate limit of 20 requests per IP per fixed 15-minute window. Failed and successful lookup/cancel attempts count toward the limit. Requests must include a matching same-origin `Origin` header.

## Owner endpoints

All `/api/admin/*` routes except `GET /api/admin/setup-status` require a valid owner session. Mutating requests require a matching same-origin `Origin` header.

### Authentication and appointments

- `GET /api/admin/setup-status`: reports whether the owner is initialized and whether first-owner bootstrap is enabled; reveals no account name or private data.
- `POST /api/admin/bootstrap`: creates the first owner only. Requires `x-admin-bootstrap-token` and JSON username/password. Username is 3–32 characters; password is 12–128 characters.
- `POST /api/admin/login`: validates credentials and sets the owner session cookie.
- `GET /api/admin/me`: returns the authenticated owner.
- `POST /api/admin/logout`: revokes the current session and clears its cookie.
- `GET /api/admin/bookings?status=all`: returns up to 200 appointments for the salon-local current day through six days ahead. Status filter: `all`, `pending`, `confirmed`, `cancelled`, `completed`, or `no_show`.
- `PATCH /api/admin/bookings/{booking-uuid}/status`: accepts `confirmed`, `cancelled`, `completed` or `no_show`, subject to state-transition rules. Successful changes are audited.

### Services

- `GET /api/admin/services`: lists active and inactive services.
- `POST /api/admin/services`: creates a service. Fields: `name`, `description`, `durationMinutes`, `priceAmount`, `priceCurrency`, optional `isActive`, optional `sortOrder`.
- `PATCH /api/admin/services/{service-uuid}`: updates service fields and/or activation state. Deactivation does not delete existing bookings.

Validation: service name 2–80 characters, description up to 300, duration 5–480 minutes, non-negative safe integer price, three-letter currency code, and integer sort order 0–10000.

### Schedule

- `GET /api/admin/schedule`: returns salon settings, weekly hours (Saturday first in the UI), and up to 180 date exceptions.
- `PUT /api/admin/settings`: updates timezone, slot interval (5–120 minutes), minimum booking notice (0–10080), booking horizon (1–365 days), and buffer (0–240 minutes). Timezone changes are rejected while active future reservations exist.
- `PUT /api/admin/schedule/weekly/{weekday}`: saves one weekday. `weekday` is Sunday=0 through Saturday=6. Body:
  
  ```json
  {
    "isClosed": false,
    "intervals": [
      { "startsAt": "09:00", "endsAt": "13:00" },
      { "startsAt": "15:00", "endsAt": "19:00" }
    ]
  }
  ```

- `POST /api/admin/schedule/exceptions`: creates or replaces the exception for a salon-local date. Supports `isClosed`, up to eight non-overlapping `intervals`, and an optional note.
- `DELETE /api/admin/schedule/exceptions/{exception-uuid}`: removes an exception only when no pending/confirmed booking exists on that date.

Weekly and exception intervals are sorted and checked server-side. Overlapping or malformed ranges are rejected. Weekly changes are blocked if they would place a future active appointment outside the allowed hours; exception changes are similarly checked against that date's active bookings. Each implemented owner mutation writes an audit record.

For backward compatibility, weekly/exception update endpoints still accept the earlier single-window fields (`opensAt`/`closesAt` and `startsAt`/`endsAt`). New clients should send `intervals`.

## Database migrations

Apply every migration in order:
1. `0001_initial_schema.sql`
2. `0002_booking_engine.sql`
3. `0003_admin_security.sql`
4. `0004_admin_service_schedule.sql`
5. `0005_multi_interval_schedule.sql`
6. `0006_public_rate_limits.sql`
7. `0007_customer_booking_access.sql`

Migration 0005 creates normalized weekly/date interval tables, prevents overlapping intervals with SQLite triggers and backfills existing single-window schedules. Migration 0006 creates the public API rate-limit bucket table and expiry index. Migration 0007 adds the customer-management token hash, a minimal booking status history and an automatic status-change trigger. Existing bookings remain intact, but only bookings created after migration 0007 receive a customer management token.

## Runtime and preview boundaries

The Cloudflare production build connects to the Worker and D1. GitHub Pages and local Vite development deliberately use sample data and never submit customer information. Pages does not host this API or the owner backend.

The implementation is not production-ready yet: notifications, retention/export/deletion policy, backups, full security review, a confirmed cancellation policy, and Cloudflare production provisioning remain incomplete. Do not collect real customer data until those gates pass.
