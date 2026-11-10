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

## Native Android manager — implementation complete, release pending

A separate Kotlin and Jetpack Compose manager app is implemented for the salon owner. It reuses the existing Apps Script owner API, private Google Sheets database and Firebase project. Native FCM registration writes its token into the existing `PushSubscriptions` sheet; high-priority Android messages are rendered by a native notification channel. The app includes the graphical weekly calendar, Jalali manual time-block entry, full owner workflows, Pooya Labs branding and biometric quick sign-in. No second customer database or rewrite of the booking website is introduced.

## Native Android UX redesign — 10 November 2026

The native manager now includes persistent System / Light / Dark modes. The light palette uses cool off-white (#F4F7FA), white cards, deep ink (#17212F), slate secondary text and accessible teal/cyan accents; the dark palette retains obsidian/graphite and cyan-mint. The selected mode is stored in app-private preferences, and Android status/navigation bars adapt their contrast. Login, loading, dashboard, calendar, cards and dialogs use the active Material 3 palette. The floating animated navigation and restrained page transitions remain in place.

The notification implementation was intentionally not edited. `Notifications.kt`, `PushTokenSync.kt`, `SalonMessagingService.kt` and `AndroidManifest.xml` were checked against `main`; their Git blob SHAs match exactly. No FCM callback, channel, rendering, boot reconciliation, WorkManager retry, permission or server-registration code was changed. See [docs/ANDROID-UX-REDESIGN.md](ANDROID-UX-REDESIGN.md).

PR #8 was squash-merged into `main` as `619c044c0b8c473fbc02b51829746f72f15a4db4`. Automated tests and local Gradle builds were not manually run for this iteration at the owner's request; repository CI may run automatically after merge. The latest appearance modes and unchanged notification behavior still require final verification before another APK is published.

## Native Android manager status — 10 November 2026

- Native app PR: [#5](https://github.com/pooya-labs/salon-booking/pull/5).
- Android Gradle build, focused Kotlin unit tests and debug APK artifact passed: [Android workflow run 42794925474](https://github.com/pooya-labs/salon-booking/actions/runs/42794925474).
- The owner confirmed on 10 November 2026 that the Android app was registered in the existing Firebase project, the `ANDROID_GOOGLE_SERVICES_JSON_BASE64` repository secret was added, and Apps Script source 1.5.5 was republished to the existing Web App deployment while preserving its `/exec` URL.
- Android workflow [run 42801068973](https://github.com/pooya-labs/salon-booking/actions/runs/42801068973) passed with Firebase configuration injected: `processDebugGoogleServices`, focused Kotlin unit tests, and `assembleDebug` all completed successfully. Artifact: `salon-manager-android-debug` (artifact ID `13755747528`).
- Repository CI [run 42801069055](https://github.com/pooya-labs/salon-booking/actions/runs/42801069055) passed on both Linux and Windows, including Windows desktop/mobile visual QA.
- The owner confirmed on the physical Android phone that real booking notifications arrive while the app is open, after it is swiped away from Recents, and after a full device reboot **without opening the app**.
- The reboot fix adds a `BOOT_COMPLETED` receiver and a network-constrained WorkManager task that reconciles the current FCM token with the Apps Script subscription endpoint and retries transient failures.
- The owner also set the app battery mode to Unrestricted and excluded it from Samsung background-sleep lists.
- Android workflow [run 42805853496](https://github.com/pooya-labs/salon-booking/actions/runs/42805853496) passed with the Firebase secret injected, including source-contract tests, Firebase configuration processing, Kotlin unit tests, APK assembly and artifact upload. Artifact ID: `13758393036` (`salon-manager-android-debug`).
- Repository CI [run 42805854365](https://github.com/pooya-labs/salon-booking/actions/runs/42805854365) passed on Linux and Windows.
- Latest UI/biometric feature branch: [PR #6](https://github.com/pooya-labs/salon-booking/pull/6), head `f153ad79fbcf5b4f3fb33daa3bd384e34f7e32bf`.
- Firebase-configured Android build, source-contract tests, focused Kotlin tests and APK artifact upload passed: [run 42820405938](https://github.com/pooya-labs/salon-booking/actions/runs/42820405938), artifact `13766596540`.
- Repository CI passed on Linux and Windows: [run 42820405870](https://github.com/pooya-labs/salon-booking/actions/runs/42820405870).
- The owner has now confirmed successful installation and launch of the latest APK on the target phone.
- PR #6 was squash-merged into main as `2274f5810c5f12c1a5eab5bd86cdb8977e0f29b0`.
- GitHub prerelease [v1.1.0](https://github.com/pooya-labs/salon-booking/releases/tag/v1.1.0) is published with the tested debug-signed APK ([direct download](https://github.com/pooya-labs/salon-booking/releases/download/v1.1.0/app-debug.apk)). Release build and upload workflow passed: [run 42822741628](https://github.com/pooya-labs/salon-booking/actions/runs/42822741628). Production signing and Play Store distribution are optional future work, not blockers for the current direct-install use case.

## Android 1.1.0 final release checklist

- [x] Android implementation and automated verification complete.
- [x] Firebase-configured debug APK uploaded to GitHub Actions.
- [x] Owner confirmed latest APK installs and launches on the target phone.
- [x] Merge PR #6 into main.
- [x] Publish GitHub prerelease v1.1.0 with debug-signed APK.
- [ ] Optional future task: configure production signing and publish stable signed APK/AAB.

## Known limitations and follow-up work

These do not block the current release:

- No independent third-party penetration test has been completed.
- A production backup-restore and rollback drill has not been recorded.
- Booking-data retention periods and a privacy contact still need the salon owner's formal decision.
- SMS, multi-staff scheduling and advanced analytics are outside the current scope.
- The native Android manager is implemented under `android/`; FCM receipt has been confirmed on the manager's physical device in foreground, after swiping the app away, and after reboot. Android force-stop, revoked notification permission, unavailable network, Do Not Disturb and OEM background restrictions remain OS-level exceptions.

## Before changing production

- Keep the current Apps Script project and private spreadsheet.
- Preserve the existing /exec address when publishing a new Apps Script version.
- Do not put the one-time bootstrap token, session data or spreadsheet exports in the repository.
- Do not use local demo mode for real customer bookings.
- Check the relevant workflow runs after a code change.
- Update this file and ROADMAP.md when the release or deployment state changes.


## Shayan Barber Studio Android 1.2.0 — 10 November 2026

The Android system display name and biometric prompt now read **Shayan Barber Studio**. The package/application ID remains `com.pooyalabs.salonmanager`; Firebase registration and existing installs therefore keep the same app identity. Gradle version is 1.2.0 / versionCode 3.

The current Android code includes persistent System / Light / Dark themes, an engineered high-contrast light palette, adaptive status/navigation bars and restrained login/navigation motion. No changes were made to Apps Script, Google Sheets, Firebase routing, credential encryption or notification delivery code.

Verification on the current UI code:
- Android source-contract tests passed, including app label, launcher asset, theme persistence and notification contracts.
- Firebase configuration injection succeeded.
- Focused Kotlin unit tests and debug APK assembly passed; artifact ID 13785568487 in [Android workflow run 42863648949](https://github.com/pooya-labs/salon-booking/actions/runs/42863648949).
- Repository CI passed on Linux and Windows, including lint, unit tests, migrations, typecheck/build, responsive/RTL browser QA and owner-dashboard date-range QA: [run 42863648998](https://github.com/pooya-labs/salon-booking/actions/runs/42863648998).

Remaining acceptance is physical-device-only: install this exact APK, verify all three appearance modes and restart persistence, then confirm biometric login, calendar interactions and the already-working FCM notifications. The automated tests do not replace this real-device check. The v1.2.0 GitHub prerelease is now published as a debug-signed owner-validation build: [release page](https://github.com/pooya-labs/salon-booking/releases/tag/v1.2.0) · [direct APK](https://github.com/pooya-labs/salon-booking/releases/download/v1.2.0/app-debug.apk). The release workflow [42864377838](https://github.com/pooya-labs/salon-booking/actions/runs/42864377838) completed its Firebase-configured build and Kotlin tests successfully. Complete the physical-device smoke test before wider distribution.

## Latest Android release asset refresh — 10 November 2026

The startup/loading screen's Pooya monogram now sits on a pure-black tile (`#000000`) so the mint mark is legible against the light loading background. The change is intentionally limited to the logo surface plus a source-contract regression test. The monogram artwork, loading spinner/copy, Firebase configuration, notification delivery files, Apps Script API and booking data path were not modified.

- Source change and regression test are included in main commit `10a11211992441eef4a13af64cc62b424e33bf83`.
- Firebase-configured Android build, focused Android tests and release-asset upload all succeeded: [workflow run 42867684705](https://github.com/pooya-labs/salon-booking/actions/runs/42867684705).
- The existing [v1.2.0 GitHub prerelease](https://github.com/pooya-labs/salon-booking/releases/tag/v1.2.0) now contains the refreshed `app-debug.apk` (22,279,497 bytes; asset timestamp 10 November 2026, 17:44 UTC): [direct APK download](https://github.com/pooya-labs/salon-booking/releases/download/v1.2.0/app-debug.apk).
- The release workflow completed successfully. Main-branch repository CI and Pages deployment triggered by the documentation commit are tracked separately; do not report them as passed until their runs finish.
- Owner-side acceptance remains pending for this exact APK: startup logo contrast, all three themes and persistence, biometric quick sign-in, calendar interactions and the existing FCM notification flow.

The APK is a debug-signed owner-validation build. Production signing and Play Store distribution remain out of scope. The live booking website remains version 1.0.0; Android manager version 1.2.0 is a separate companion-app release.
