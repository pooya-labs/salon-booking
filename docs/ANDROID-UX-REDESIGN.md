# Android manager UX redesign

**Status:** implementation complete for the requested visual and theme scope; merge requested by the owner. Automated/device verification remains deferred by explicit instruction.

## Visual direction

The native owner app uses a distinct Pooya Labs / Shayan Barber Studio visual identity. Instagram, Telegram and YouTube are interaction references only; no product UI is copied.

### Dark theme
- Obsidian-black foundation with deep graphite and blue surfaces.
- Electric mint and cyan as restrained action and focus accents.
- Soft rounded geometry, low-contrast borders and layered surfaces.

### Light theme
- Cool off-white canvas (`#F4F7FA`) and pure white cards.
- Deep ink typography (`#17212F`) with slate secondary text (`#596777`).
- Accessible teal primary (`#087F79`) and controlled blue-cyan secondary (`#087E98`).
- Subtle blue-gray separators (`#D7E0E7`) and warm amber reserved for secondary status.
- System status/navigation bars adapt their background and icon contrast to the selected theme.

## Theme behavior

- Three persistent modes: System, Light and Dark.
- System mode follows Android's current light/dark setting.
- Manual Light and Dark selections are stored in app-private preferences and survive app restarts.
- The theme is applied across login, loading, dashboard, calendar, booking cards, dialogs and settings through Material 3 color roles.
- Persian RTL remains the default interaction direction.

## Motion and interaction

- The secure login surface enters with a short fade and vertical movement.
- Navigation between owner areas uses animated cross-fade and subtle vertical movement.
- The bottom navigation uses a compact floating surface with a smoothly resizing active indicator and animated icon tint.
- Each main content page has a subtle first-entry fade/translation.
- Loading, success and error feedback use the active theme's color roles.

Motion is intentionally short and restrained. It must not delay booking actions, obscure controls, or interfere with calendar gestures and accessibility settings.

## Notification and backend isolation

The notification implementation was intentionally not edited. The following files were checked against `main` and their Git blob SHAs are identical:
- `Notifications.kt`
- `PushTokenSync.kt`
- `SalonMessagingService.kt`
- `AndroidManifest.xml`

No edits were made to FCM callbacks, notification channels, notification rendering, boot reconciliation, WorkManager retry, permissions or backend registration. The notification settings controls remain functionally unchanged.

## Scope preserved

This is a visual and interaction redesign of the native Android manager only. It does not change the customer booking website, Apps Script API, private Google Sheets schema, Firebase project, FCM routing, credential encryption, biometric authentication, appointment state transitions or booking rules.

## Deferred verification

Per owner instruction, no tests or local Gradle builds were manually run during this iteration. A merge may trigger repository-configured GitHub Actions automatically. Physical-device verification of both themes and the unchanged notification flow is still required before publishing a new APK/release.
