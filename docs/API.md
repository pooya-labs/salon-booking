# API reference

The active API is implemented in relay/Code.gs. The React frontend is served by GitHub Pages and forwards requests through the hidden Apps Script iframe bridge in relay/Bridge.html.

Apps Script runs in Google's V8 runtime, not in a browser or Node.js. Backend code must use Apps Script services rather than relying on browser APIs or Node built-ins.

## Data storage

setupSalonDatabase() creates or updates the private spreadsheet used by the application. Its main tabs are:

| Sheet | Purpose |
|---|---|
| Settings | Timezone, booking window, notice, slot interval and buffer |
| Services | Service names, categories, prices, durations and visibility |
| WeeklyHours | Opening intervals for each weekday |
| Exceptions | Date-specific closures and alternate hours |
| Bookings | Customer details, appointment data and booking status |
| PushSubscriptions | Registered manager browser/PWA devices |
| AdminUsers | Owner account information |
| AdminSessions | Hashed owner session identifiers and expiry |
| AuditLog | Owner actions and booking events |
| TimeBlocks | Periods reserved manually by the owner |

The timezone starts unset on a new installation. Public availability and booking should remain unavailable until the owner saves the salon's real timezone and schedule. For Shayan Barber Studio, the configured timezone is Asia/Tehran.

## Date and time format

- API dates use Gregorian YYYY-MM-DD.
- Times use the salon's local 24-hour HH:mm format.
- The website displays dates in the Jalali calendar.
- Availability and booking calculations use the salon timezone, not the visitor's device timezone.

## Public endpoints

### GET /api/health

Returns the service name and backend version.

### GET /api/public/config

Returns public scheduling settings and whether the salon's schedule has been configured.

### GET /api/public/services

Returns active services that are visible to customers.

### GET /api/public/availability?date=YYYY-MM-DD&serviceId=...

Returns available start times for the selected service and date. Availability is calculated from service duration, weekly hours, date exceptions, timezone, booking notice, booking horizon, buffer and existing active bookings.

### POST /api/public/bookings

Creates an appointment. Example body:

    {
      "serviceId": "service-id",
      "date": "2026-11-04",
      "time": "09:00",
      "name": "Client Name",
      "phone": "+989123456789",
      "note": ""
    }

The request must include an Idempotency-Key header containing 64 hexadecimal characters. Reuse the key only when retrying the same booking attempt.

A successful response includes a booking reference and a one-time customer management token. The backend stores hashes for the management token and idempotency data; the customer must keep the token to look up or cancel the appointment later.

Availability is checked again during submission. The final check and write run under the Apps Script script lock so two customers cannot claim overlapping time slots. A notification failure does not undo a booking that has already been saved.

### POST /api/public/bookings/lookup

Body:

    {
      "reference": "SB-ABCDEFG",
      "managementToken": "one-time-token"
    }

Returns the appointment's service, local date and time, duration and status. It does not return the customer's contact details.

### POST /api/public/bookings/cancel

Uses the same reference and management token. A future pending or confirmed appointment can be cancelled. Repeating a successful cancellation returns the cancelled state.

## Owner endpoints

All owner routes require a valid owner session, except the setup-status check and the one-time first-owner bootstrap.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/admin/setup-status | Check first-time setup state |
| POST | /api/admin/bootstrap | Create the first owner account |
| POST | /api/admin/login | Sign in |
| POST | /api/admin/logout | Revoke the current session |
| GET | /api/admin/me | Check the current session |
| GET | /api/admin/bookings | List appointments by date range and status |
| GET | /api/admin/day-schedule | Read a day's bookings and time blocks |
| POST | /api/admin/time-blocks | Block a period in the calendar |
| DELETE | /api/admin/time-blocks/{id} | Remove a time block |
| GET | /api/admin/availability | Read owner-side service availability |
| GET / PUT | /api/admin/notifications | Read or save notification settings |
| POST / DELETE | /api/admin/push-subscriptions | Register or remove a manager device |
| POST | /api/admin/notifications/test | Send a test push notification |
| PATCH | /api/admin/bookings/{id}/status | Change appointment status |
| DELETE | /api/admin/bookings/{id} | Delete an appointment |
| GET / POST | /api/admin/services | List or create services |
| PATCH | /api/admin/services/{id} | Edit a service |
| GET | /api/admin/schedule | Read schedule settings |
| PUT | /api/admin/settings | Save general schedule settings |
| PUT | /api/admin/schedule/weekly/{weekday} | Save weekly opening intervals |
| POST | /api/admin/schedule/exceptions | Add a date-specific schedule change |
| DELETE | /api/admin/schedule/exceptions/{id} | Remove a schedule exception |

Weekly schedules and date exceptions support multiple non-overlapping intervals. Changes that would conflict with active bookings are rejected.

## Native Android transport

The native manager app uses the same `/exec` Web App URL without a browser iframe. It sends one outer HTTP `POST` containing the same proxy envelope that the Pages bridge passes to `proxyRequest()`:

    {
      "path": "/api/admin/me",
      "method": "GET",
      "headers": { "accept": "application/json" },
      "body": null,
      "sessionId": "a-random-uuid"
    }

The outer request is always POST; `path`, inner `method`, `headers`, `body` and `sessionId` are passed to `proxyRequest()`. The response contains the application `status` and a JSON-string `body`. The app stores its session identifier encrypted using Android Keystore. Owner routes still require a valid session; this transport adds no alternate login or admin bypass.

## Sessions and notifications

Owner sessions have a rolling 30-day inactivity lifetime. The session identifier stored in the spreadsheet is hashed; the cache is an accelerator and is not the only record of an active session. Signing out revokes the current session.

Push notifications use Firebase Cloud Messaging. The Firebase web app, VAPID public key, matching Google Cloud project and required Apps Script permissions must be configured before a manager device can receive alerts. Email notifications are separate, optional and disabled by default.

For setup steps, see GITHUB-PAGES-RELAY.md. For the owner-facing workflows, see ADMIN.md.

## Legacy Cloudflare files

The Worker source, Wrangler configuration and D1 migrations are kept for historical reference and recovery only. They are not part of the active API. No D1 records are copied into Google Sheets automatically. Keep any old Cloudflare data until the owner has confirmed that it is no longer needed.
