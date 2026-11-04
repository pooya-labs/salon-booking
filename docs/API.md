# API reference — Google Apps Script

The active API lives in `relay/Code.gs`. GitHub Pages serves the React frontend; its hidden Apps Script iframe forwards same-origin `/api/*` calls through `google.script.run`. Apps Script executes as the deploying owner and stores application records in a private Google Spreadsheet.

The Apps Script V8 runtime is not a browser or Node.js environment. It does not provide browser APIs such as `URL`, `URLSearchParams`, `fetch` or `crypto.subtle`; this backend uses a small query parser and native Apps Script services instead. See [V8 runtime limitations](https://developers.google.com/apps-script/guides/v8-runtime).

## Spreadsheet tables

`setupSalonDatabase()` creates a private spreadsheet with these tabs:

- `Settings`: salon timezone, booking horizon, minimum notice, interval and buffer.
- `Services`: service catalog, price, duration and activation state.
- `WeeklyHours`: up to eight non-overlapping opening intervals per weekday.
- `Exceptions`: date-specific closures and alternate hours.
- `Bookings`: customer details, booking state, UTC instants, service snapshots and one-way credential hashes.
- `AdminUsers`: owner identity and salted password hash.
- `AdminSessions`: hashed browser session identifiers and expiry.
- `AuditLog`: owner-attributed changes and booking events.

The timezone starts as `unset`; public availability and booking stay disabled until the owner saves the salon's actual IANA timezone and working hours. For a salon in Iran, choose `Asia/Tehran`.

## Public endpoints

### `GET /api/health`

Returns the API service name and version.

### `GET /api/public/config`

Returns non-sensitive scheduling settings and whether the schedule is configured.

### `GET /api/public/services`

Returns active services only. An empty service list is valid until the owner configures the real catalog.

### `GET /api/public/availability?date=YYYY-MM-DD&serviceId=...`

The date is Gregorian; the frontend may display the Jalali equivalent. Slots are calculated from service duration, weekly/date-specific intervals, timezone, booking notice, booking horizon, buffer and existing pending/confirmed bookings. Returned times are salon-local `HH:mm`.

### `POST /api/public/bookings`

JSON body:

```json
{
  "serviceId": "service-id",
  "date": "2026-11-04",
  "time": "09:00",
  "name": "Client Name",
  "phone": "+989123456789",
  "note": ""
}
```

Requires `Idempotency-Key` with 64 hexadecimal characters. Reuse the same key only for a retry of the exact same attempt. A success returns a booking reference and a one-time 64-character customer management token. Sheets stores only the token hash and idempotency/request hashes.

The availability recheck and booking write run under `LockService.getScriptLock()` so simultaneous customers cannot reserve overlapping time. A booking is committed before its notification email is attempted; email failure does not undo the reservation.

### `POST /api/public/bookings/lookup`

Body: `{ "reference": "SB-ABCDEFG", "managementToken": "64-character-token" }`. Returns service, local date/time, duration and status; it never returns the customer's contact details.

### `POST /api/public/bookings/cancel`

Uses the same body and proof of possession. A pending or confirmed future booking can be cancelled. A repeated cancellation returns its already-cancelled state.

## Owner endpoints

All routes below require a live owner session except `GET /api/admin/setup-status` and first-owner bootstrap.

- `GET /api/admin/setup-status`
- `POST /api/admin/bootstrap` — requires `x-admin-bootstrap-token`, username and password.
- `POST /api/admin/login`
- `POST /api/admin/logout`
- `GET /api/admin/me`
- `GET /api/admin/bookings?from=YYYY-MM-DD&to=YYYY-MM-DD&status=all`
- `PATCH /api/admin/bookings/{booking-uuid}/status` — `confirmed`, `cancelled`, `completed` or `no_show`.
- `GET /api/admin/services`
- `POST /api/admin/services`
- `PATCH /api/admin/services/{service-uuid}`
- `GET /api/admin/schedule`
- `PUT /api/admin/settings`
- `PUT /api/admin/schedule/weekly/{weekday}` — Sunday=0 through Saturday=6.
- `POST /api/admin/schedule/exceptions`
- `DELETE /api/admin/schedule/exceptions/{exception-uuid}`

Weekly and exception schedules accept an `intervals` array of up to eight non-overlapping `{ "startsAt": "09:00", "endsAt": "13:00" }` ranges. Changes that conflict with active reservations are rejected. Booking status transitions are validated and audited.

## Sessions and notifications

Owner sessions expire after six hours. A SHA-256 hash of the browser's random relay session identifier is persisted in `AdminSessions`; CacheService is an acceleration layer, not the only session store.

After a booking is committed, Apps Script sends an email through MailApp to the manager address in Script Properties. Setup defaults to the script owner's effective email when available. Change it from the Apps Script editor with `setSalonNotificationEmail("manager@example.com")`. Gmail's published consumer-account MailApp allowance is currently 100 recipients per day; quotas are per account and may change. See [Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas).

## Legacy Cloudflare data

The former Worker source, Wrangler files and D1 SQL migrations remain only as historical recovery material. They are not called by the active GitHub Pages + Apps Script flow. No D1 data is automatically copied into Sheets; retain the old Cloudflare database until the owner confirms the new deployment and any required export/import.
