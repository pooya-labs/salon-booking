# GitHub Pages and Google Apps Script

This guide describes the connection between the public website and the salon's Apps Script backend. The current production site already uses this arrangement. The steps below are for reference, backend updates or a separate installation.

## How requests are routed

GitHub Pages serves the React frontend. A hidden iframe loads the Apps Script HTML service page and bridges frontend API calls to the Web App. Apps Script handles requests and reads or writes the private spreadsheet.

The Apps Script project executes as its owner. The spreadsheet should remain private; customers interact with it only through the application API.

## 1. Create the Apps Script project

For a new installation:

1. Sign in to Google Apps Script with the account that will own the salon database.
2. Create a standalone project.
3. Copy relay/Code.gs into Code.gs.
4. Add an HTML file named Bridge and copy relay/Bridge.html.
5. In Project Settings, enable the manifest file and use relay/appsscript.json.

The manifest sets the Apps Script runtime, timezone and web app access. Review the requested scopes and approve only those needed for Sheets, external requests and the configured notification services.

## 2. Create the private spreadsheet

1. Choose setupSalonDatabase in the Apps Script editor and run it.
2. Approve the requested permissions.
3. Copy the spreadsheet URL from the execution log and keep it private.
4. Keep the one-time owner-bootstrap token from the same log in a safe place. It is needed only to create the first owner account.

The setup function creates the application tabs and initial settings. Do not share the spreadsheet publicly or commit its URL or exported data to the repository.

## 3. Deploy the Web App

In Apps Script, choose Deploy → New deployment → Web app.

- **Execute as:** Me (the account that owns the spreadsheet).
- **Who has access:** Anyone, including visitors who are not signed in.

Deploy and copy the URL ending in /exec. Anonymous access is required for customers to check availability and place bookings. Private operations are protected by application-level owner/customer authorization.

## 4. Connect GitHub Pages

In the repository, open Settings → Secrets and variables → Actions → Variables and add:

| Variable | Value |
|---|---|
| SALON_RELAY_URL | The Apps Script Web App address ending in /exec |

The Pages workflow injects this value when it builds the frontend. A push to main triggers a new build and deployment. When the variable is missing, the site falls back to demo mode and should not be used for real reservations.

## 5. Create the first owner account

1. Open the live [owner workspace](https://pooya-labs.github.io/salon-booking/?admin=1).
2. Enter the one-time bootstrap token from the Apps Script execution log.
3. Choose the manager username and a strong password.
4. Confirm that the timezone is Asia/Tehran.
5. Add the salon's actual services, prices, durations and opening hours.

The bootstrap token is for initial setup only. Keep it private and do not reuse it after the owner account has been created.

If the Google OAuth consent screen is in Testing mode, add the account deploying the Apps Script Web App to its test-user list. Do not replace the live Web App deployment or change its address to fix an OAuth audience setting.

## 6. Configure manager push notifications

Push notifications use Firebase Cloud Messaging (FCM). The owner needs a Firebase web app, a Web Push VAPID public key and the matching Google Cloud project.

Add these public web configuration values as GitHub Actions repository variables:

- FIREBASE_API_KEY
- FIREBASE_AUTH_DOMAIN
- FIREBASE_PROJECT_ID
- FIREBASE_STORAGE_BUCKET
- FIREBASE_MESSAGING_SENDER_ID
- FIREBASE_APP_ID
- FIREBASE_VAPID_KEY

Then:

1. Enable the Firebase Cloud Messaging API in the matching Google Cloud project.
2. Make sure the Apps Script project is associated with that same standard Google Cloud project.
3. Update the existing Apps Script project with the current relay/Code.gs and manifest.
4. Run setupSalonDatabase() against the existing spreadsheet so any additive tabs or columns are created.
5. In Deploy → Manage deployments, publish a new Web App version while keeping the same /exec address.
6. Rebuild GitHub Pages.
7. Sign in to the owner workspace, open اعلان‌ها, save the Firebase project ID and register the manager's browser/PWA.
8. Send a test notification.

A manager can register more than one device. The browser must grant notification permission. Background notifications are shown by the service worker; messages received while the dashboard is open are handled by the page.

Do not add a Firebase private service-account key to this repository. The frontend uses public Firebase web configuration and the Apps Script backend uses its own Google authorization.

## 7. Email notifications

Email notifications are optional and off by default. The owner can enable them from the Notifications tab after the Apps Script MailApp scope and recipient have been configured. Leaving the setting off means the system will not send booking emails.

A notification failure does not remove an appointment that has already been saved.

## Updating the existing live installation

The current deployment has already been accepted. For routine updates:

**Backend release 1.5.5:** includes the 1.5.4 customer-phone fix, a direct POST transport for the native Android manager, and Android FCM high-priority delivery. Publish `relay/Code.gs` as a new version of the existing Apps Script Web App; pushing to GitHub alone does not update this backend.

- Keep the existing Apps Script project and spreadsheet.
- Preserve the deployed /exec address.
- Apply source updates to the existing project instead of creating a replacement.
- Run the additive setup only when the backend change requires it.
- Publish a new Web App version and redeploy Pages.
- Check the Pages workflow's read-only relay smoke result.

The source backend version is recorded in relay/Code.gs. It is separate from the Apps Script deployment number shown in Google's interface.

## Related references

- [Apps Script Web Apps](https://developers.google.com/apps-script/guides/web)
- [Apps Script manifest](https://developers.google.com/apps-script/manifest)
- [Firebase Cloud Messaging for web](https://firebase.google.com/docs/cloud-messaging/web/get-started)
- [Receiving web messages](https://firebase.google.com/docs/cloud-messaging/web/receive-messages)
