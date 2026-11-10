# Shayan Barber Studio — Android App

Native owner app displayed on Android as **Shayan Barber Studio**. The customer booking website remains on GitHub Pages. The app reuses the existing Apps Script owner API, session model, private Google Sheet and Firebase project; it does not create a second database.

## Requirements

- Android Studio with JDK 17 and Android SDK 36.
- The existing Apps Script Web App must be upgraded to source version 1.5.5 (see `../relay/Code.gs`) and keep its current `/exec` URL.
- Add the Android application `com.pooyalabs.salonmanager` inside the same Firebase project that sends the salon's booking notifications.

## Firebase setup

1. Add an Android app with package `com.pooyalabs.salonmanager` in the existing Firebase project.
2. Download `google-services.json` and place it in `android/app/`. Never commit this file.
3. For GitHub Actions, save the Base64-encoded JSON as repository secret `ANDROID_GOOGLE_SERVICES_JSON_BASE64`.
4. Keep the existing `SALON_RELAY_URL` repository Actions variable pointing to the active Apps Script `/exec` endpoint.

Without Firebase configuration the project still compiles and the local notification preview works, but remote FCM registration is unavailable. The automated build reports this as a warning; do not use such an APK as the production manager app.

## Interface design and themes

The native manager offers three persistent appearance modes: **System**, **Light** and **Dark**. System follows Android's current appearance setting. Light uses a cool off-white canvas, white cards, deep ink typography, slate secondary text and accessible teal/cyan accents; Dark retains the obsidian/graphite and cyan-mint identity. The selected mode is stored in app-private preferences and survives restarts. Login, loading, dashboard, calendar, booking cards, dialogs and system bars adapt to the active palette.

The UX redesign did not modify the notification delivery implementation. `Notifications.kt`, `PushTokenSync.kt`, `SalonMessagingService.kt` and `AndroidManifest.xml` were compared with `main` and have matching Git blob SHAs. FCM handling, channels, reboot reconciliation, WorkManager retry, permissions and server registration remain unchanged.

See [Android UX redesign notes](../docs/ANDROID-UX-REDESIGN.md). The day/night theme implementation was merged through [PR #8](https://github.com/pooya-labs/salon-booking/pull/8) (`619c044c0b8c473fbc02b51829746f72f15a4db4`). Final verification is intentionally pending until the owner completes the remaining changes.

## Build

Open the `android/` folder in Android Studio, let Gradle sync, then run the `app` configuration. To build from a machine with Gradle 8.13 installed:

    gradle -p android :app:testDebugUnitTest :app:assembleDebug

The debug APK is created at:

    android/app/build/outputs/apk/debug/app-debug.apk

The Android GitHub Actions workflow runs the focused source-contract and Kotlin unit tests, then uploads the APK as an artifact.

## Notification behavior

The app creates a native high-importance Android channel with the system notification sound, vibration, and heads-up presentation. FCM messages are data-only; `SalonMessagingService` posts the notification immediately in the background, including when the app process is not running. Android force-stop, denied notifications, no connectivity, Do Not Disturb and manufacturer battery restrictions remain system-level exceptions. The app provides a shortcut to the Android channel settings so the owner can select a preferred sound.

## Admin capabilities

- Sign in and sign out using the existing manager account.
- Booking list, date range, customer phone, status changes and deletion.
- Daily calendar, booked periods, free working hours and manual time blocks.
- Service catalogue creation and editing.
- Weekly hours, breaks, date exceptions and booking rules.
- Firebase device registration, local sound test, remote test push and email preference.
## Production setup checkpoint — 10 November 2026

The repository owner confirmed that the Android app was registered in the existing Firebase project, the `ANDROID_GOOGLE_SERVICES_JSON_BASE64` Actions secret was added, and Apps Script source 1.5.5 was published to the existing Web App deployment while preserving its `/exec` URL. Firebase configuration injection was subsequently verified by Android workflow runs 42805853496 and 42820405938. Earlier physical-device checks confirmed manager sign-in, FCM subscription and notification delivery in foreground, after dismissing the app from Recents, and after reboot. The final smoke test for the latest calendar, biometric and notification visual changes remains pending.


## Modern branding, calendar and biometric sign-in

The app uses the official Pooya Labs monogram artwork from the platform brand directory and a dark graphite / mint interface. The weekly calendar provides a seven-day selector, appointment counts, a visual daily timeline, booking details, and manual time blocking. Booking, services, weekly hours, exceptions, booking rules, notification settings and account operations remain available in their own manager sections.

To enable one-tap sign-in, sign in manually and select **ذخیره ورود با اثر انگشت**. After successful login, confirm the biometric prompt. The username and password are encrypted with AES-GCM and a non-exportable Android Keystore key that requires strong biometric authentication for every cryptographic operation. They are never stored as plaintext. On later visits, use **ورود سریع با اثر انگشت**. If biometric enrollment changes or the device key is invalidated, remove the saved credentials and sign in again manually.


## Release status — 10 November 2026

**Implementation status: feature-complete; production release: pending final acceptance.**

The latest branch commit is `f153ad79fbcf5b4f3fb33daa3bd384e34f7e32bf`. The Firebase-configured Android workflow passed, including source-contract tests, Google Services configuration processing, focused Kotlin unit tests, APK assembly and artifact upload: [workflow run 42820405938](https://github.com/pooya-labs/salon-booking/actions/runs/42820405938). Repository CI passed on Linux and Windows: [workflow run 42820405870](https://github.com/pooya-labs/salon-booking/actions/runs/42820405870).

The workflow artifact is named `salon-manager-android-debug` and contains `app-debug.apk`. It is a debug variant and must be treated as a test build. It is not a production-signed APK or an Android App Bundle. Do not distribute it as a stable public release.

### Final release checklist

- [x] Firebase configuration injected by GitHub Actions without committing `google-services.json`.
- [x] Android source-contract regression tests passed.
- [x] Focused Kotlin unit tests passed.
- [x] Debug APK assembled and uploaded.
- [x] Repository CI passed on Linux and Windows.
- [x] Owner confirmed the latest APK installs and launches successfully on the target phone.
- [x] Merge PR #6 and publish the v1.1.0 GitHub prerelease with the tested debug-signed APK.
- [ ] Optional future hardening: configure a dedicated production signing key and publish a stable signed APK/AAB. Play Store distribution is not part of this project release.

The earlier physical-device FCM checks for foreground, background-after-Recents-dismissal and reboot token reconciliation remain valid for the notification implementation at that time. They do not replace the final smoke test for the latest UI and biometric changes.


## Published prerelease — v1.1.0

The project owner confirmed that the latest APK installs and launches successfully on the target phone. PR #6 was squash-merged into `main` as commit `2274f5810c5f12c1a5eab5bd86cdb8977e0f29b0`.

Version `v1.1.0` is published as a **GitHub prerelease**. The release workflow builds and attaches the Firebase-configured APK and reruns focused Android unit tests. The APK is debug-signed, not production-signed. This is suitable for the owner's direct installation and current project use, but future updates must use the same signing key to install over it. A separately managed release keystore is not configured in this repository.

- Release page: https://github.com/pooya-labs/salon-booking/releases/tag/v1.1.0
- Direct APK: https://github.com/pooya-labs/salon-booking/releases/download/v1.1.0/app-debug.apk
- Release build and publish workflow succeeded: https://github.com/pooya-labs/salon-booking/actions/runs/42822741628
- Source tag: `v1.1.0`
- Merged source: `2274f5810c5f12c1a5eab5bd86cdb8977e0f29b0`
- Automated Android build on the merged commit: https://github.com/pooya-labs/salon-booking/actions/runs/42822583643
- Repository CI on the merged commit: https://github.com/pooya-labs/salon-booking/actions/runs/42822583696

The booking website, Apps Script backend, private Sheets database and Firebase project remain the existing live services. The Android manager implementation and current owner-verified prerelease are complete. Production signing and Play Store distribution are intentionally out of scope for this release.


## Shayan Barber Studio 1.2.0 — current release candidate

The Android launcher and system app label are **Shayan Barber Studio**. The biometric system prompt uses the same product name. The application ID remains `com.pooyalabs.salonmanager`, preserving the existing Firebase registration and install identity.

Version 1.2.0 (versionCode 3) includes the persistent System / Light / Dark theme selector, the engineered light palette, adaptive system bars, animated login/navigation transitions and the updated Shayan app name. The existing booking backend, Apps Script endpoint, Firebase project, encrypted credentials and notification delivery code are unchanged.

- Android workflow: [run 42863648949](https://github.com/pooya-labs/salon-booking/actions/runs/42863648949) — source-contract tests, Firebase injection, Kotlin unit tests, APK build and artifact upload passed.
- Repository CI: [run 42863648998](https://github.com/pooya-labs/salon-booking/actions/runs/42863648998) — Linux and Windows browser QA passed.
- The debug APK is built and available in the Android workflow artifact. It is not production-signed.
- Before broad distribution, install this exact build on the owner's phone and verify System / Light / Dark switching, restart persistence, biometric sign-in, calendar interactions and FCM delivery in foreground/background/reboot conditions.
- Production signing and Play Store publication remain out of scope.
