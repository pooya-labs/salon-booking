# Salon Manager for Android

Native owner app for Shayan Barber Studio. The customer booking website remains on GitHub Pages. The app reuses the existing Apps Script owner API, session model, private Google Sheet and Firebase project; it does not create a second database.

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

The repository owner has confirmed that the Android app was registered in the existing Firebase project, the `ANDROID_GOOGLE_SERVICES_JSON_BASE64` Actions secret was added, and Apps Script source 1.5.5 was published to the existing Web App deployment while preserving its `/exec` URL. The next automated build must verify that Firebase configuration is injected successfully. Actual manager sign-in, token registration, and background notification delivery still require a physical-device test; these are not yet marked as verified.


## Modern branding, calendar and biometric sign-in

The app uses the official Pooya Labs monogram artwork from the platform brand directory and a dark graphite / mint interface. The weekly calendar provides a seven-day selector, appointment counts, a visual daily timeline, booking details, and manual time blocking. Booking, services, weekly hours, exceptions, booking rules, notification settings and account operations remain available in their own manager sections.

To enable one-tap sign-in, sign in manually and select **ذخیره ورود با اثر انگشت**. After successful login, confirm the biometric prompt. The username and password are encrypted with AES-GCM and a non-exportable Android Keystore key that requires strong biometric authentication for every cryptographic operation. They are never stored as plaintext. On later visits, use **ورود سریع با اثر انگشت**. If biometric enrollment changes or the device key is invalidated, remove the saved credentials and sign in again manually.
