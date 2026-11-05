# Owner workspace — Google Apps Script

The owner workspace is served by the GitHub Pages frontend at `https://pooya-labs.github.io/salon-booking/?admin=1`. On GitHub Pages, use the `?admin=1` query route rather than `/admin`; direct `/admin` paths are not published by GitHub Pages. Owner API calls are routed through the hidden Apps Script iframe bridge. Apps Script executes as the deploying owner and stores records in a private Google Spreadsheet.

## Included features

- One-time first-owner bootstrap and username/password login/logout.
- Rolling 30-day owner sessions, automatically renewed during regular use; hashed session identifiers and expiry are persisted in the private `AdminSessions` sheet.
- Booking list, date-range navigation, status filtering and client contact details.
- Allowed transitions: pending → confirmed/cancelled; confirmed → completed/cancelled/no-show.
- Service create/edit/activate/deactivate, including category/type, description, price, currency, duration and public visibility; deactivation preserves historical reservations.
- Iran-fixed `Asia/Tehran` timezone (not editable), slot interval, booking notice, booking horizon and buffer settings. Admin date entry uses a Jalali calendar; working-hour fields use 24-hour time.
- Weekly working hours with up to eight separate intervals per day; start, midday and closing periods can be edited independently.
- Date-specific closures and alternate opening intervals, with notes.
- Visual daily calendar with separate states for customer bookings, free slots and manager-blocked times. A manager can block a selected time with one confirmation; the default block duration is one slot step (normally 15 minutes), with longer presets available optionally. No customer name, phone or synthetic booking record is created.
- Audit records for owner changes and booking status history.

Schedule intervals and manager time blocks are validated in Apps Script; the global script lock protects booking creation and time-block changes from concurrent requests. The `TimeBlocks` sheet is created by rerunning `setupSalonDatabase()` as an additive migration; existing data and owner accounts are preserved.

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

- Sessions remain valid for up to 30 days of inactivity and renew automatically during use. Explicit logout revokes the current browser session immediately. CacheService remains a six-hour accelerator; the hashed session record in Sheets is authoritative.
- Google service quotas and availability can change. Monitor Apps Script **Executions** when requests fail.
- The legacy Worker/D1 implementation is retained only for recovery; it is not part of the active Pages API path.
- Do not accept real reservations until Apps Script is deployed, the salon's actual timezone/services/hours are configured, and a booking plus its notification have been tested.


## Service, schedule and phone bookings

Service categories, descriptions, prices, currencies, durations, display order and public visibility are editable. Each weekday supports multiple independently editable opening intervals, including midday breaks. For appointments arranged outside the website, open the daily calendar, tap an empty time, choose a duration and confirm. This blocks the window without creating a customer booking or collecting personal data.

## Phone notifications

The Notifications tab registers the current Android browser/PWA for Firebase Cloud Messaging. Email notifications are disabled by default and may be enabled separately. Firebase must first be configured according to the [deployment checklist](./GITHUB-PAGES-RELAY.md#6-phone-push-notifications-firebase-cloud-messaging).
