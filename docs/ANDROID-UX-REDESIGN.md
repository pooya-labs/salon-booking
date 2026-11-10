# Android manager UX redesign

**Status:** implementation in progress; automated and device tests intentionally deferred until the owner finishes the remaining requested changes.

## Visual direction

The native owner app uses a distinct Pooya Labs / Shayan Barber Studio visual identity. Instagram, Telegram and YouTube are interaction references only; no product UI is copied.

- Obsidian-black foundation with deep blue/graphite surfaces.
- Electric mint and cyan as restrained action and focus accents.
- Soft rounded geometry, low-contrast borders and layered surfaces rather than hard outlines.
- Persian RTL remains the default interaction direction.
- The existing Pooya Labs monogram remains in the login and application identity.

## Motion and interaction

- The secure login surface enters with a short fade and vertical movement.
- Navigation between owner areas uses animated cross-fade and subtle vertical movement.
- The bottom navigation uses a compact floating surface with a smoothly resizing active indicator and animated icon tint.
- Each main content page has a subtle first-entry fade/translation.
- Loading, success and error feedback use the updated dark visual language.

Motion is intentionally short and restrained. It must not delay booking actions, obscure controls, or interfere with calendar gestures and accessibility settings.

## Scope preserved

This is a visual and interaction redesign of the native Android manager only. It does not change the customer booking website, Apps Script API, private Google Sheets schema, Firebase project, FCM routing, credential encryption, biometric authentication, appointment state transitions or booking rules.

## Deferred verification

Per owner instruction, do not run tests, Gradle builds, APK assembly, CI workflows or release actions while the remaining design changes are being collected. Run the full relevant verification once the owner explicitly says the changes are complete.
