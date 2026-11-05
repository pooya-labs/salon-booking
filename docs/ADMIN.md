# Owner workspace — Google Apps Script

The owner workspace is served by the GitHub Pages frontend at `https://pooya-labs.github.io/salon-booking/?admin=1`. On GitHub Pages, use the `?admin=1` query route rather than `/admin`; direct `/admin` paths are not published by GitHub Pages. Owner API calls are routed through the hidden Apps Script iframe bridge. Apps Script executes as the deploying owner and stores records in a private Google Spreadsheet.

## Included features

- One-time first-owner bootstrap and username/password login/logout.
- Six-hour owner sessions, with hashed session identifiers persisted in the private `AdminSessions` sheet.
- Booking list, date-range navigation, status filtering and client contact details.
- Allowed transitions: pending → confirmed/cancelled; confirmed → completed/cancelled/no-show.
- Service create/edit/activate/deactivate, including category/type, description, price, currency, duration and public visibility; deactivation preserves historical reservations.
- Salon timezone, slot interval, booking notice, booking horizon and buffer settings.
- Weekly working hours with up to eight separate intervals per day; start, midday and closing periods can be edited independently.
- Date-specific closures and alternate opening intervals, with notes.
- Manual phone reservations with first name, last name and phone; confirmed phone bookings share the same availability lock and block online reservations.
- Audit records for owner changes and booking status history.

Schedule intervals are validated in Apps Script; the global script lock protects the critical availability-recheck-and-booking-write section from concurrent requests.

## First owner setup

Follow [GITHUB-PAGES-RELAY.md](./GITHUB-PAGES-RELAY.md):
1. Create the Apps Script project from `relay/Code.gs`, `relay/Bridge.html` and `relay/appsscript.json`.
2. Run `setupSalonDatabase()` in the Apps Script editor and authorize Sheets plus the Firebase Messaging/external-request scopes. Mail permission is optional because email alerts default to off.
3. Keep the one-time bootstrap token from the execution log private.
4. Deploy a Web App executing as the owner with anonymous access.
5. Set the deployed `/exec` URL as GitHub Actions variable `SALON_RELAY_URL`.
6. Complete first-owner bootstrap on the Pages admin screen.

Setup and notification-recipient functions are guarded against calls from the public web app; run them only from the owner's Apps Script editor.

## Notifications

Firebase Cloud Messaging (FCM) Web Push sends reservation notifications to registered manager browsers/PWAs on Android. The owner must configure the Firebase web app, VAPID key, matching Google Cloud project and GitHub Actions variables using the [deployment checklist](./GITHUB-PAGES-RELAY.md#6-phone-push-notifications-firebase-cloud-messaging), then activate the device from the پنل مدیریت → اعلان‌ها tab and send a test notification.

Email notifications are **disabled by default**. The manager can keep the email toggle off to receive push only, or enable email separately from the Notifications tab. A failed notification never rolls back a saved booking.

## Operational notes

- Sessions expire after six hours. CacheService is only an accelerator; session hashes and expiry are persisted in Sheets.
- Google service quotas and availability can change. Monitor Apps Script **Executions** when requests fail.
- The legacy Worker/D1 implementation is retained only for recovery; it is not part of the active Pages API path.
- Do not accept real reservations until Apps Script is deployed, the salon's actual timezone/services/hours are configured, and a booking plus its notification have been tested.


## Service, schedule and phone bookings

Service categories, descriptions, prices, currencies, durations, display order and public visibility are editable. Each weekday supports multiple independently editable opening intervals, including midday breaks. The manager can also enter phone reservations with first name, last name and phone; a successful manual reservation is confirmed and blocks the same time from online availability.

## Phone notifications

The Notifications tab registers the current Android browser/PWA for Firebase Cloud Messaging. Email notifications are disabled by default and may be enabled separately. Firebase must first be configured according to the [deployment checklist](./GITHUB-PAGES-RELAY.md#6-phone-push-notifications-firebase-cloud-messaging).
