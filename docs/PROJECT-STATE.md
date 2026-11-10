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
- Apps Script source in the repository: 1.5.5 in relay/Code.gs. The live Google deployment must be separately upgraded before the native app can connect.
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

## Native Android manager in progress

A separate Kotlin and Jetpack Compose app is being added for the salon owner. It reuses the existing Apps Script owner API and private Google Sheets database. Native FCM registration writes its token into the existing `PushSubscriptions` sheet; high-priority Android messages are rendered by a native notification channel. No second customer database or rewrite of the booking website is planned.

## Native Android manager status — 10 November 2026

- Native app PR: [#5](https://github.com/pooya-labs/salon-booking/pull/5).
- Android Gradle build, focused Kotlin unit tests and debug APK artifact passed: [Android workflow run 42794925474](https://github.com/pooya-labs/salon-booking/actions/runs/42794925474).
- The debug artifact was produced without `ANDROID_GOOGLE_SERVICES_JSON_BASE64`; remote Firebase registration and background delivery have not been verified on a physical device.
- The repository backend source is 1.5.5. The existing Google Apps Script Web App still needs to be republished to that source version while preserving its current `/exec` URL.
- Do not merge/publish the native app as production-ready until Firebase setup, Apps Script deployment and physical-device notification verification are complete.

## Known limitations and follow-up work

These do not block the current release:

- No independent third-party penetration test has been completed.
- A production backup-restore and rollback drill has not been recorded.
- Booking-data retention periods and a privacy contact still need the salon owner's formal decision.
- SMS, multi-staff scheduling and advanced analytics are outside the current scope.
- The native Android manager is under development in `android/`; FCM delivery must be verified on the manager's physical device before it is considered production-ready.

## Before changing production

- Keep the current Apps Script project and private spreadsheet.
- Preserve the existing /exec address when publishing a new Apps Script version.
- Do not put the one-time bootstrap token, session data or spreadsheet exports in the repository.
- Do not use local demo mode for real customer bookings.
- Check the relevant workflow runs after a code change.
- Update this file and ROADMAP.md when the release or deployment state changes.
