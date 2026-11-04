# Owner workspace — Google Apps Script

The owner workspace is served by the GitHub Pages frontend at `/salon-booking/admin`. Owner API calls are routed through the hidden Apps Script iframe bridge. Apps Script executes as the deploying owner and stores records in a private Google Spreadsheet.

## Included features

- One-time first-owner bootstrap and username/password login/logout.
- Six-hour owner sessions, with hashed session identifiers persisted in the private `AdminSessions` sheet.
- Booking list, date-range navigation, status filtering and client contact details.
- Allowed transitions: pending → confirmed/cancelled; confirmed → completed/cancelled/no-show.
- Service create/edit/activate/deactivate; deactivation preserves historical reservations.
- Salon timezone, slot interval, booking notice, booking horizon and buffer settings.
- Weekly working hours with up to eight separate intervals per day.
- Date-specific closures and alternate opening intervals, with notes.
- Audit records for owner changes and booking status history.

Schedule intervals are validated in Apps Script; the global script lock protects the critical availability-recheck-and-booking-write section from concurrent requests.

## First owner setup

Follow [GITHUB-PAGES-RELAY.md](./GITHUB-PAGES-RELAY.md):
1. Create the Apps Script project from `relay/Code.gs`, `relay/Bridge.html` and `relay/appsscript.json`.
2. Run `setupSalonDatabase()` in the Apps Script editor and authorize Sheets/Mail access.
3. Keep the one-time bootstrap token from the execution log private.
4. Deploy a Web App executing as the owner with anonymous access.
5. Set the deployed `/exec` URL as GitHub Actions variable `SALON_RELAY_URL`.
6. Complete first-owner bootstrap on the Pages admin screen.

Setup and notification-recipient functions are guarded against calls from the public web app; run them only from the owner's Apps Script editor.

## Notifications

After a booking is committed, the backend sends an email to the configured manager mailbox. Setup defaults to the deploying Google account when available. To select another address, run `setSalonNotificationEmail("manager@example.com")` from the Apps Script editor. Gmail on Android can show these messages when its notifications are enabled. The booking remains saved if notification delivery fails.

## Operational notes

- Sessions expire after six hours. CacheService is only an accelerator; session hashes and expiry are persisted in Sheets.
- Google service quotas and availability can change. Monitor Apps Script **Executions** when requests fail.
- The legacy Worker/D1 implementation is retained only for recovery; it is not part of the active Pages API path.
- Do not accept real reservations until Apps Script is deployed, the salon's actual timezone/services/hours are configured, and a booking plus its notification have been tested.


## Service, schedule and phone bookings

Service categories, descriptions, prices, currencies, durations, display order and public visibility are editable. Each weekday supports multiple independently editable opening intervals, including midday breaks. The manager can also enter phone reservations with first name, last name and phone; a successful manual reservation is confirmed and blocks the same time from online availability.

## Phone notifications

The Notifications tab registers the current Android browser/PWA for Firebase Cloud Messaging. Email notifications are disabled by default and may be enabled separately. Firebase must first be configured according to the [deployment checklist](./GITHUB-PAGES-RELAY.md#6-phone-push-notifications-firebase-cloud-messaging).
