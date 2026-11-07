# Project State — Version 1.0.0 released

## Current status

- **Product:** Shayan Barber Booking
- **Release:** 1.0.0
- **Release date:** 2026-11-05
- **Repository:** https://github.com/pooya-labs/salon-booking
- **Default branch:** main
- **Live site:** https://pooya-labs.github.io/salon-booking/
- **Owner panel:** https://pooya-labs.github.io/salon-booking/?admin=1
- **Product owner:** salon owner
- **Engineering / creator:** Pooya
- **Owner acceptance:** confirmed by the owner on 2026-11-05.

Version 1.0.0 is complete and owner-accepted. The project is in maintenance mode; no feature work is planned. Reopen implementation only for a reproducible defect, a security update or an essential compatibility fix.

## Active production architecture

1. GitHub Pages hosts the public customer experience and manager panel.
2. A nested Apps Script iframe bridges frontend API requests to the owner's Google Apps Script Web App.
3. Apps Script contains the backend logic and stores data in the owner's private Google Spreadsheet.
4. Firebase Cloud Messaging sends push notifications to the registered manager device.
5. Optional email notifications are disabled by default.

Cloudflare Workers and D1 are legacy recovery material only. They are not in the active request path and must not be redeployed as part of normal operation.

## Version identifiers

- Product/package version: 1.0.0.
- Apps Script source backend version: 1.5.3 in relay/Code.gs.
- The Apps Script deployment's numeric deployment version is a separate Google-managed identifier; preserve the owner's active deployment and existing /exec URL.

## Latest automated verification

Release main head: 56ff5cde573eccb3febd7efe2de270f9ded2b7e5.

- CI run [42085423627](https://github.com/pooya-labs/salon-booking/actions/runs/42085423627): passed.
  - Linux build job: lint, unit tests, SQLite migration/conflict checks, TypeScript/build, responsive/RTL/keyboard/browser QA and owner-dashboard browser QA.
  - Windows visual job: desktop browser QA, Android-touch responsive simulation and owner-dashboard desktop/mobile QA.
- Pages run [42085423471](https://github.com/pooya-labs/salon-booking/actions/runs/42085423471): passed.
  - Production Pages build and deployment succeeded.
  - The live Apps Script relay smoke test completed successfully.
  - The smoke test is read-only and does not create customer or booking records.
- Owner confirmed the real operational setup and end-to-end checks are correct, including the owner workspace and manager notification delivery.

Automated browser Android coverage is a touch/device-context simulation, not a claim of physical-device certification. The owner has separately confirmed the practical acceptance checks.

## Delivered product capabilities

- Shayan branding and responsive Persian RTL website.
- Owner-managed services, prices and durations.
- Jalali calendar, Asia/Tehran timezone and 24-hour schedule controls.
- Live server-calculated availability and conflict-safe bookings.
- Customer booking lookup and cancellation.
- Owner authentication with rolling persistent sessions.
- Daily visual calendar, weekly hours, breaks, exceptions and manager time blocks.
- Owner booking management and audit history.
- Firebase manager push notifications; optional email is off by default.
- Privacy, deployment and owner-operation documentation.

## Known non-blocking follow-ups

These do not block Version 1.0.0 and are intentionally deferred:

- Independent third-party penetration test.
- A scheduled production backup-restore and rollback drill.
- Optional SMS, richer PWA, multi-staff and analytics capabilities.

No independent penetration test or destructive production restore drill is claimed as completed.

## Release handoff

- Read ROADMAP.md for the release scope and verification evidence.
- Read README.md for architecture, setup and operator links.
- Preserve the current Apps Script project, private spreadsheet, Firebase project and /exec URL.
- Do not use demo mode for real customer information.
- Any future maintenance change must be narrowly scoped, pass the relevant tests and update the release record before publication.
