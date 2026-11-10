# Salon Booking — Release 1.0.0

Version 1.0.0 is the first completed release of the booking system for Shayan Barber Studio. The salon owner reviewed the live setup and confirmed the main customer and management flows on 5 November 2026.

**Release:** [v1.0.0](https://github.com/pooya-labs/salon-booking/releases/tag/v1.0.0)  
**Release date:** 5 November 2026  
**Default branch:** main  
**Live site:** https://pooya-labs.github.io/salon-booking/  
**Owner workspace:** https://pooya-labs.github.io/salon-booking/?admin=1  
**Apps Script source version:** 1.5.5 in repository; live Web App deployment update is still required for native Android  
**Product version:** 1.0.0

## Release status

**Released**

The first release is complete and in use. The project is in maintenance mode; there is no active feature roadmap for the 1.0 line. Work should be limited to verified defects, security fixes and compatibility updates.

## What shipped

### Customer website
- [x] Shayan Barber Studio identity and owner-provided brand assets.
- [x] Responsive Persian RTL layout for desktop and mobile.
- [x] Service catalogue with descriptions, prices and durations.
- [x] Jalali date display with the salon timezone set to Asia/Tehran.
- [x] Availability based on working hours, breaks, existing bookings and schedule exceptions.
- [x] Booking review, customer details and a confirmation reference.
- [x] Customer lookup and cancellation using a one-time management credential.
- [x] Loading, validation, success and error states across the booking flow.

### Booking and schedule
- [x] Server-side availability calculation.
- [x] Conflict checks when a booking is submitted, including concurrent requests.
- [x] Safe retries for booking requests.
- [x] Owner-managed services, duration, price and public visibility.
- [x] Weekly opening intervals, breaks and date-specific schedule changes.
- [x] Daily calendar for bookings, free slots and manually blocked periods.
- [x] Time blocks for bookings made outside the website, without creating dummy customer records.

### Owner workspace
- [x] First-owner setup, sign-in and sign-out.
- [x] Persistent owner sessions with a rolling 30-day lifetime.
- [x] Booking list, date navigation and status filters.
- [x] Booking status management and deletion with confirmation.
- [x] Service editor and schedule settings.
- [x] Audit history for management actions.
- [x] Notification settings and registered manager devices.

### Notifications and operations
- [x] Firebase Cloud Messaging for registered manager browsers and PWAs.
- [x] Optional email alerts, disabled by default.
- [x] Private Google Sheets storage under the deploying owner's account.
- [x] Deployment and owner-operation guides.
- [x] Privacy, data-retention and security notes.

## Production architecture

The live version uses:

- **GitHub Pages** for the public website and owner workspace.
- **Google Apps Script** for the API and booking logic.
- **Google Sheets** for the private application database.
- **Firebase Cloud Messaging** for manager push notifications.
- **MailApp** only when the owner turns on email alerts.

The frontend reaches Apps Script through a hidden iframe bridge. Apps Script runs as the deploying owner and accesses the spreadsheet owned by that account.

Cloudflare Workers and D1 are not part of the live request path. Their source and migration files remain in the repository as legacy recovery material. The project does not copy D1 data into Sheets automatically.

## Release checks

The release was built and verified through GitHub Actions:

| Check | Result | Run |
|---|---|---|
| Linux CI: lint, unit tests, migrations, build and browser checks | Passed | [42086718663](https://github.com/pooya-labs/salon-booking/actions/runs/42086718663) |
| Windows browser and responsive checks | Passed | [42086718663](https://github.com/pooya-labs/salon-booking/actions/runs/42086718663) |
| GitHub Pages deployment | Passed | [42086718821](https://github.com/pooya-labs/salon-booking/actions/runs/42086718821) |
| Read-only Apps Script relay smoke check | Passed | [42086718821](https://github.com/pooya-labs/salon-booking/actions/runs/42086718821) |
| Owner's operational acceptance | Confirmed | 5 November 2026 |

The read-only relay check verifies that the published site can reach the configured Apps Script bridge and read the expected public configuration. It does not create bookings or change customer records.

The latest Pages run on the current main line also completed its build, deployment and read-only relay check successfully: [run 42395770865](https://github.com/pooya-labs/salon-booking/actions/runs/42395770865).

Automated mobile coverage uses browser viewport and touch-context simulation. It is not a certification on every physical phone. The salon owner separately checked the live customer and management flows.

## Not part of version 1.0.0

These ideas can be considered later, but they were not needed to deliver the first release:

- SMS reminders or paid messaging services.
- WhatsApp automation beyond ordinary user-initiated links.
- Multiple barbers, chairs or branches.
- Business analytics and additional languages.
- Further PWA improvements.
- An independent security assessment.
- A scheduled production backup-restore and rollback exercise.

No independent penetration test or destructive production restore drill is claimed as completed.

## Native Android manager — version 1.0.0 (in progress)

The customer website and its existing Google Sheets records remain unchanged. A separate Kotlin/Jetpack Compose app is being built for the owner, using the same Apps Script API, owner login and Firebase project.

### Implemented in the feature branch
- [x] Separate Android application module with Persian RTL Compose interface.
- [x] Encrypted owner session storage using Android Keystore.
- [x] Direct POST transport to the same Apps Script `/exec` API, preserving the existing session and route checks.
- [x] Native FCM service for data-only background messages; notification is rendered immediately without a network call in the FCM callback.
- [x] Android high-priority FCM payload and high-importance notification channel with default system sound, vibration and heads-up behavior.
- [x] Booking list, date and status filters, customer phone and tap-to-call, booking status actions and deletion.
- [x] Manual phone/in-person booking creation.
- [x] Daily calendar, customer appointments, time blocks and removal of time blocks.
- [x] Service editor, weekly hours, multiple work intervals, date exceptions and booking rules.
- [x] Notification preferences, device registration, local sound test, Android channel settings shortcut and remote server test.
- [x] Focused Kotlin unit tests and a Node contract test for the Android/API/FCM boundary.

### Required before a usable APK with background push
- [ ] Add the Android app `com.pooyalabs.salonmanager` to the existing Firebase project and store its Base64 `google-services.json` as the GitHub Actions secret `ANDROID_GOOGLE_SERVICES_JSON_BASE64`.

The first debug artifact was built without the Firebase Android JSON secret, so the APK is compile-tested but not yet registered for remote FCM delivery. Do not distribute it as a production notification client until the secret and the existing Apps Script Web App update are complete.
- [ ] Publish Apps Script source 1.5.5 to the existing Web App deployment, preserving the current `/exec` URL.
- [x] Pass Android build, focused Kotlin unit tests and debug APK packaging in GitHub Actions: [run 42794925474](https://github.com/pooya-labs/salon-booking/actions/runs/42794925474).
- [ ] Install the APK on the manager's physical Android phone, sign in and confirm the FCM token is registered.
- [ ] Verify test and real booking notifications with the app foregrounded, backgrounded and swiped away from Recents; verify sound and vibration from the Android channel settings.
- [ ] Verify on a second network and after reboot. Document Android force-stop, notification permission, Do Not Disturb and manufacturer battery restrictions as OS-level limitations.

No new database, paid server or replacement customer booking website is introduced.

## Maintenance policy

Keep the existing Pages site, Apps Script deployment, private spreadsheet, Firebase project and web app address in place.

A maintenance change should:
1. Start from a reproducible issue or a clearly identified security/compatibility need.
2. Avoid changing the live data model or deployment settings unless required.
3. Pass the relevant automated checks.
4. Update the related guide and this release record.
5. Be published only after the Pages workflow and the read-only relay check succeed.

Do not re-enable the old Worker/D1 path during routine maintenance.

## Handoff

For the next person working on the repository:

- Read README.md for the project overview and local commands.
- Read docs/PROJECT-STATE.md before changing deployment or production configuration.
- Read docs/ADMIN.md for owner operations.
- Read docs/GITHUB-PAGES-RELAY.md before touching Apps Script.
- Keep customer records, bootstrap tokens, private spreadsheet exports and service credentials out of GitHub.
