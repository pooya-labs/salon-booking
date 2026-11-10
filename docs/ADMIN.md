# Owner workspace

The owner workspace is part of the live site:

[Open the management panel](https://pooya-labs.github.io/salon-booking/?admin=1)

On GitHub Pages, use the ?admin=1 link. A standalone /admin path is not published by this site.

The workspace is intended for the salon owner. Sign in with the owner account created during the first setup; there is no public manager registration.

## What you can manage

### Bookings
- View appointments by date range and status.
- Open a daily calendar showing confirmed bookings, free slots and blocked periods.
- Confirm or cancel pending bookings.
- Mark confirmed bookings as completed, cancelled or no-show.
- Review the customer's contact details when managing an appointment.
- Delete an appointment after confirming the action.

### Services
Each service can be created or edited from the workspace. The owner controls its name, category, description, price, currency, duration, active state and whether it appears on the public website.

Deactivating a service keeps its historical booking records intact.

### Working hours
- Set weekly opening hours.
- Add separate intervals for different parts of the day, including lunch breaks.
- Set one-off closures or alternate hours for a particular date.
- Adjust the slot interval, booking notice, booking horizon and buffer.

The salon timezone is fixed to Asia/Tehran. The date picker uses the Jalali calendar; time fields use the 24-hour clock.

### Manual time blocks
For an appointment arranged by phone or in person, open the daily calendar and choose an available time. Select the length of the block and confirm it.

A time block occupies the selected period without creating a customer booking or asking for a name or phone number. You can remove a block from the same calendar.

The backend checks the selected interval against opening hours and existing appointments before saving it.

### Notifications
The Notifications tab manages push devices and email preferences.

- Register the manager's current browser or PWA to receive Firebase Cloud Messaging alerts.
- More than one manager device can be registered.
- Send a test push after Firebase has been configured and at least one device is active.
- Email alerts are optional and disabled by default.

A notification error does not cancel a booking that was already saved. Check the Apps Script execution log and device registration when a push does not arrive.

## Sign-in and sessions

The first owner account is created with the one-time bootstrap token printed by setupSalonDatabase() in the Apps Script execution log. Keep that token private and do not store it in this repository.

Owner sessions last up to 30 days of inactivity and renew during normal use. Signing out revokes the current browser session.

If the owner cannot sign in, check that the Google account used to deploy Apps Script is allowed by the OAuth consent configuration. When the consent screen is in Testing mode, the deploying account may need to be listed as a test user. Do not replace the deployed Web App or its address to change the test-user list.

## First-time setup

The full process is documented in GITHUB-PAGES-RELAY.md. In brief:

1. Create or update the Apps Script project from the files in relay/.
2. Run setupSalonDatabase() from the Apps Script editor.
3. Deploy the Web App as the owner, with access available to anonymous visitors.
4. Set the deployed URL as the GitHub Actions variable SALON_RELAY_URL.
5. Complete the first-owner setup from the live management page.
6. Configure the salon's real services and working hours before accepting reservations.

Keep the private spreadsheet private. Do not use local demo mode for real customer data.


### High-priority appointment alerts
The manager workspace refreshes an already-approved Firebase device token after sign-in, retries temporary Firebase delivery errors, and activates the updated push service worker immediately. It requests high Web Push delivery urgency and vibration while leaving sound selection to Android's notification channel.

**Important:** granting website permission does not automatically enable sound. On Samsung One UI 8, first enable **Settings → Notifications → Advanced settings → Manage notification categories for each app**. Then open **Settings → Notifications → App notifications → Firefox or Chrome → Notification categories**. Tap the category name (not only its switch), set it to **Alert**, enable vibration and choose a notification sound. Also check notification volume and Sound mode. The exact category name depends on the browser and Android build.

The Web Notifications API cannot assign an Android notification-channel sound or force the device to play the SMS ringtone. Android/browser settings still determine the actual sound and vibration; web code cannot override Do Not Disturb.
