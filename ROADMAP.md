# Salon Booking — Version 1.0.0

This is the release record for the first production version. Active architecture: **GitHub Pages + Google Apps Script + private Google Sheets + Firebase Cloud Messaging**. Cloudflare Workers and D1 are legacy recovery material only.

## Release status

**Version 1.0.0 — owner accepted**

- Release date: 2026-11-05
- Default branch: main
- Public site: https://pooya-labs.github.io/salon-booking/
- Apps Script source backend version: 1.5.3 (relay/Code.gs)
- Product/package version: 1.0.0
- Owner acceptance: owner confirmed the operational setup and end-to-end checks are correct.
- Release main head: 56ff5cde573eccb3febd7efe2de270f9ded2b7e5.

## Version 1.0.0 scope and completion

### R1 — Brand and public experience

- [x] Shayan Barber Studio identity, owner-supplied logo assets and obsidian / antique-gold visual system.
- [x] Persian RTL customer experience, responsive navigation, mobile booking entry and salon information.
- [x] Service catalogue, service details, duration and owner-managed prices.
- [x] Jalali date presentation and salon timezone pinned to Asia/Tehran.
- [x] Booking review, customer details, reference code and customer self-service lookup/cancellation.
- [x] Loading, validation, success and error feedback across customer and owner flows.
- [x] Final customer-facing content and salon details reviewed by the owner.

### R2 — Booking and scheduling engine

- [x] Live availability calculated by Apps Script from active services, working hours, exceptions, reservations and manager time blocks.
- [x] Reservation creation with conflict protection, locking and safe retry behavior.
- [x] Customer booking lookup and cancellation using a one-time management credential.
- [x] Owner-configurable service catalogue, duration, prices, weekly hours, breaks and date-specific exceptions.
- [x] Visual daily calendar showing bookings, available periods and manager-created blocked intervals.
- [x] Manager time blocking without creating fake customer records or collecting unnecessary customer details.
- [x] Iran timezone and 24-hour time presentation.

### R3 — Owner workspace and notifications

- [x] Owner bootstrap, sign-in, sign-out and persistent rolling 30-day sessions.
- [x] Responsive owner dashboard, appointment list and daily calendar.
- [x] Owner appointment deletion with confirmation and audit history.
- [x] Firebase project, web push configuration and manager-device registration.
- [x] Owner-confirmed manager push notifications.
- [x] Optional email notifications remain off by default and can be enabled separately.

### R4 — Privacy, security and operations

- [x] Private Google Sheets database and owner-only management routes.
- [x] Owner authorization checks and session revocation.
- [x] Input validation, conflict checks, audit events and operational error handling.
- [x] Privacy and data-retention procedures documented.
- [x] No customer records or secrets included in automated test fixtures.
- [x] OAuth test-user access and active Apps Script Web App access verified by the owner.
- [x] Production deployment uses the existing Apps Script /exec endpoint and private spreadsheet.

### R5 — Quality and release acceptance

- [x] Linux CI: lint, unit tests, SQLite migration regressions, TypeScript/build, public browser QA and owner-dashboard browser QA.
- [x] Windows CI: desktop browser QA and Android-touch responsive simulation for public and owner flows.
- [x] Responsive viewport coverage, RTL, Persian digits, Jalali date behavior, keyboard navigation and automated accessibility checks.
- [x] Latest CI passed on the pre-release main head: [run 42086718663](https://github.com/pooya-labs/salon-booking/actions/runs/42085423627).
- [x] GitHub Pages deployment succeeded: [run 42086718821](https://github.com/pooya-labs/salon-booking/actions/runs/42085423471).
- [x] Pages workflow live Apps Script relay smoke passed without writing customer or booking data.
- [x] Owner confirmed the remaining real-world configuration and acceptance checks are correct.
- [x] Owner acceptance for Version 1.0.0 recorded in this release.

## Verification evidence

| Check | Result | Evidence |
|---|---|---|
| Linux CI | Passed | [42085423627](https://github.com/pooya-labs/salon-booking/actions/runs/42085423627) |
| Windows desktop + Android-touch browser QA | Passed | [42085423627](https://github.com/pooya-labs/salon-booking/actions/runs/42085423627) |
| GitHub Pages build and deployment | Passed | [42085423471](https://github.com/pooya-labs/salon-booking/actions/runs/42085423471) |
| Live Apps Script relay smoke (read-only) | Passed | [42085423471](https://github.com/pooya-labs/salon-booking/actions/runs/42085423471) |
| Owner operational and end-to-end acceptance | Owner-confirmed | 2026-11-05 |

The live relay smoke is deliberately read-only. It verifies that the published site reaches the configured Apps Script bridge and backend without creating bookings or changing customer data. Real booking and notification acceptance is recorded separately as owner-confirmed, not misrepresented as an automated CI test.

## Explicitly outside Version 1.0.0

These are optional future enhancements, not launch blockers:

- SMS reminders or paid messaging-provider integrations.
- WhatsApp automation beyond ordinary user-initiated links.
- Multiple staff members, chairs or branches.
- Advanced analytics and additional languages.
- Optional PWA refinements.
- Independent third-party penetration test.
- Periodic production backup-restore and rollback drills.

No claim is made that an independent penetration test or a destructive production restore drill has been performed. These remain sensible operational follow-ups.

## Architecture and release policy

- GitHub Pages hosts the public customer site and owner workspace.
- A nested Apps Script iframe bridges browser API requests to the owner's Google Apps Script Web App.
- Apps Script contains the API and persists records in the owner's private Google Spreadsheet.
- Firebase Cloud Messaging delivers manager push notifications to registered devices.
- Email notifications are optional and disabled by default.
- Cloudflare Worker/D1 files remain historical recovery material only. Do not re-enable them as part of routine operation.

## Post-release maintenance

Version 1.0.0 is complete and the project is in maintenance mode. No feature roadmap is active. Only verified bug fixes, security updates and essential compatibility changes should be considered. Any such change must update this file and docs/PROJECT-STATE.md, pass the relevant checks and be released as a patch version. Do not reopen completed Version 1.0.0 work without a reproducible issue.

## Handoff protocol

For every future release, record the current commit, files changed, tests actually run, deployment result, known limitations and any owner action. Never infer a successful production action from source code alone.
