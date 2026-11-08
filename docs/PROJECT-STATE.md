# Project state

## At a glance

- **Product:** Shayan Barber Booking
- **Version:** 1.0.0
- **Release:** [v1.0.0](https://github.com/pooya-labs/salon-booking/releases/tag/v1.0.0)
- **Release date:** 5 November 2026
- **Repository:** [pooya-labs/salon-booking](https://github.com/pooya-labs/salon-booking)
- **Default branch:** main
- **Website:** https://pooya-labs.github.io/salon-booking/
- **Owner panel:** https://pooya-labs.github.io/salon-booking/?admin=1
- **Project creator:** Pooya Goodarzi
- **Product owner:** Shayan Barber Studio

The salon owner accepted the live booking and management setup on 5 November 2026. Version 1.0.0 is released and the project is in maintenance mode.

## Live architecture

The production request path is:

1. GitHub Pages serves the customer website and owner workspace.
2. A hidden iframe passes API requests to the salon's Google Apps Script Web App.
3. Apps Script runs the backend and reads or writes the owner's private Google Spreadsheet.
4. Firebase Cloud Messaging sends push notifications to registered manager devices.
5. Email notifications are optional and remain off by default.

Cloudflare Workers and D1 are not used by this version. Their files remain in the repository as legacy recovery material. There is no automatic data transfer between D1 and Google Sheets.

## Version numbers

- Product and npm package: 1.0.0.
- Apps Script source: 1.5.3 in relay/Code.gs.
- The Google Apps Script deployment number is managed separately by Google. Keep the existing Web App deployment and its address ending in /exec when updating the backend.

## Current deployment evidence

- The latest main-branch Pages workflow completed the build and deployment successfully, then passed its read-only Apps Script relay check: [run 42395770865](https://github.com/pooya-labs/salon-booking/actions/runs/42395770865).
- The original v1.0.0 CI run passed on both Linux and Windows: [run 42086718663](https://github.com/pooya-labs/salon-booking/actions/runs/42086718663).
- The original release Pages deployment also passed: [run 42086718821](https://github.com/pooya-labs/salon-booking/actions/runs/42086718821).

The relay check does not submit bookings or modify customer data. Owner confirmation covers the real-world operational checks and notification delivery.

## Delivered features

- Persian RTL booking website with responsive layouts.
- Service catalogue and owner-managed prices and durations.
- Jalali date presentation and Tehran timezone.
- Live availability and conflict-safe booking creation.
- Customer appointment lookup and cancellation.
- Owner sign-in with persistent sessions.
- Booking list, status management and daily visual calendar.
- Weekly hours, breaks, closures, exceptions and manual time blocks.
- Firebase manager push notifications and optional email alerts.
- Deployment, API, privacy and owner-operation documentation.

## Known limitations and follow-up work

These do not block the current release:

- No independent third-party penetration test has been completed.
- A production backup-restore and rollback drill has not been recorded.
- Booking-data retention periods and a privacy contact still need the salon owner's formal decision.
- SMS, multi-staff scheduling and advanced analytics are outside the current scope.
- Automated Android checks are browser simulations rather than physical-device certification.

## Before changing production

- Keep the current Apps Script project and private spreadsheet.
- Preserve the existing /exec address when publishing a new Apps Script version.
- Do not put the one-time bootstrap token, session data or spreadsheet exports in the repository.
- Do not use local demo mode for real customer bookings.
- Check the relevant workflow runs after a code change.
- Update this file and ROADMAP.md when the release or deployment state changes.
