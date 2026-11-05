# GitHub Pages + Google Apps Script setup

This is the active deployment path. GitHub Pages serves the React site; an Apps Script Web App provides the API and creates a private Google Spreadsheet for the salon database. The customer browser does not call a Cloudflare Worker.

## 1. Create the Apps Script project

1. Open [script.google.com](https://script.google.com/) using the Google account that should own the database and booking notifications.
2. Create a standalone project, for example `Salon Booking Backend`.
3. Replace `Code.gs` with the repository's [`relay/Code.gs`](../relay/Code.gs).
4. Add an HTML file named `Bridge` and paste [`relay/Bridge.html`](../relay/Bridge.html).
5. In Project Settings, enable **Show "appsscript.json" manifest file in editor**. Replace it with [`relay/appsscript.json`](../relay/appsscript.json), then save.

The manifest selects V8, spreadsheet, optional email, Firebase Messaging and external-request scopes, `Asia/Tehran` as the script timezone, owner execution and anonymous Web App access. Google's [manifest reference](https://developers.google.com/apps-script/manifest/web-app-api-executable) documents these access and execution values.

## 2. Create the private database and authorize email

1. In the function picker, choose `setupSalonDatabase` and click **Run**.
2. Approve the requested Google Sheets, Firebase Messaging and external-request permissions. Mail permission is available only for optional email alerts.
3. Open the execution log. It prints the private spreadsheet URL and a one-time owner-bootstrap token. Keep that token private; do not paste it into GitHub or chat.
4. Setup defaults the notification recipient to the deploying Google account when available. To choose a different mailbox, run `setSalonNotificationEmail("manager@example.com")` from the Apps Script editor.

The setup and notification configuration functions are guarded so they only run from the signed-in owner's Apps Script editor, not from the public web app. The created spreadsheet is owned by that Google account and should remain private.

## 3. Deploy as a public Web App

1. Click **Deploy → New deployment**.
2. Select **Web app**.
3. Set **Execute as** to **Me** (the account that owns the spreadsheet).
4. Set access to **Anyone**, including people who are not signed in. The manifest uses `ANYONE_ANONYMOUS`.
5. Deploy and copy the URL ending in `/exec`.

Google documents the deployment choices in [Apps Script Web Apps](https://developers.google.com/apps-script/guides/web).

## 4. Connect the Pages build

In the repository, open **Settings → Secrets and variables → Actions → Variables** and add:

- Name: `SALON_RELAY_URL`
- Value: the Apps Script `/exec` URL

This is a public endpoint, not a secret. The Pages workflow injects it at build time. The next push to `main` rebuilds Pages; the deployment workflow can also be rerun manually. If the variable is missing, Pages stays in demo mode and does not submit customer data.

Live site: [https://pooya-labs.github.io/salon-booking/](https://pooya-labs.github.io/salon-booking/)

## 5. First owner setup

1. Open the live site and choose **مدیریت**, or visit [the direct owner panel link](https://pooya-labs.github.io/salon-booking/?admin=1). Do not use `/admin` as a standalone path on GitHub Pages.
2. Enter the one-time bootstrap token from the Apps Script execution log.
3. Choose the manager username and a password of at least 12 characters.
4. In **تنظیمات استودیو**, select the salon's actual timezone. For a salon in Iran, use `Asia/Tehran`.
5. Add real services, prices, weekly opening intervals and date-specific closures.

The one-time bootstrap token is deleted after the first owner is created. Owner sessions expire after six hours.

## 6. Booking notifications

The primary notification path is Firebase Cloud Messaging (FCM) to manager devices that have been registered from the owner panel. Push delivery is not active until the Firebase project, VAPID key, Apps Script Cloud project permissions and GitHub `FIREBASE_*` build variables are configured and a manager device has granted notification permission.

Email notifications are optional and **off by default**. No booking email is sent unless the owner explicitly enables the email option in the admin notification settings. When enabled, Apps Script uses MailApp and the configured manager recipient. A notification delivery failure does not roll back a saved booking; check Apps Script **Executions**, the notification settings and the manager-device registration state.

## Deployment boundary

The backend source is committed to GitHub, but Apps Script projects are separate Google-account resources. This repository integration cannot authorize or publish a Web App inside the owner's Google account. The owner must complete steps 1–4. Do not treat the migration as live until the `/exec` URL is deployed, the GitHub variable is set, and a booking plus Gmail notification are verified from an Iranian network.

The previous Cloudflare Worker and D1 are intentionally left untouched as a temporary recovery source. No automatic D1-to-Sheets copy is performed. Do not delete Cloudflare resources until the Apps Script path passes owner acceptance.


## 6. Phone push notifications (Firebase Cloud Messaging)

Push is the recommended phone notification path. It can show a native Android notification while the manager's browser/PWA is in the background. The app uses Firebase Cloud Messaging (FCM); no Cloudflare Worker or Firebase private service-account key is used.

1. In [Firebase Console](https://console.firebase.google.com/), create or select a project and add a Web app.
2. In Project settings → General, copy the Web app configuration values: apiKey, authDomain, projectId, storageBucket, messagingSenderId and appId.
3. In Project settings → Cloud Messaging → Web configuration, generate a Web Push certificate (VAPID) key pair and copy the public key.
4. In the matching Google Cloud project, enable the Firebase Cloud Messaging API. In Apps Script Project Settings, associate the Apps Script project with this same standard Google Cloud project. The script owner must have permission to send Firebase messages in the project.
5. In GitHub Settings → Secrets and variables → Actions → Variables, add these repository variables (the Firebase web config and VAPID public key are public client configuration, not private credentials):

   - FIREBASE_API_KEY
   - FIREBASE_AUTH_DOMAIN
   - FIREBASE_PROJECT_ID
   - FIREBASE_STORAGE_BUCKET
   - FIREBASE_MESSAGING_SENDER_ID
   - FIREBASE_APP_ID
   - FIREBASE_VAPID_KEY

6. Update the existing Apps Script project's Code.gs and appsscript.json from this repository. Run setupSalonDatabase() again to add the new category, source and PushSubscriptions columns/table without clearing existing rows. Approve the new Firebase Messaging and external-request scopes.
7. Deploy a new version of the Web App (Deploy → Manage deployments → Edit → New version → Deploy). Keep the deployed /exec URL unchanged when editing the existing deployment.
8. Rebuild GitHub Pages from Actions. Then sign in through [the owner panel](https://pooya-labs.github.io/salon-booking/?admin=1), open اعلان‌ها, enter the Firebase project ID and save.
9. On the manager's Android phone, open the live site in Chrome, sign in to the admin panel and tap فعال‌کردن اعلان این گوشی. Allow notifications, then use ارسال اعلان آزمایشی.

The manager can add more than one device by repeating activation on each phone/browser. FCM sends to saved manager devices. The service worker displays background notifications; the open dashboard handles foreground messages. See [FCM web setup](https://firebase.google.com/docs/cloud-messaging/web/get-started), [receiving FCM messages](https://firebase.google.com/docs/cloud-messaging/web/receive-messages) and [Apps Script external APIs](https://developers.google.com/apps-script/guides/services/external).

## 7. Email alert preference

Email alerts are off by default. In the admin panel's اعلان‌ها tab, leave the email checkbox off to receive phone push only. Enabling it sends a parallel MailApp email to the configured manager address. If email is disabled, no booking email is sent.


## 8. Verify the deployed relay and upgrade an existing Web App

The live Pages check expects the Apps Script health endpoint to report backend version 1.1.0. A response of 1.0.0 means the existing Google Web App deployment is still serving an older version, even when GitHub Pages has already been rebuilt.

To upgrade without creating a new spreadsheet or changing the public URL:

1. In the existing Apps Script project, replace Code.gs, Bridge.html and appsscript.json with the latest files from this repository.
2. Save all files and run setupSalonDatabase() once from the Apps Script editor. Its schema update is additive: it creates missing tabs/columns and preserves existing rows.
3. Review and approve any newly requested Apps Script scopes.
4. Open Deploy → Manage deployments → Edit → New version → Deploy. Keep the existing deployment and /exec URL.
5. Push or rerun the GitHub Pages workflow, then confirm its read-only smoke check passes. It verifies iframe handshake, backend version, public config/services, setup status and anonymous admin rejection; it does not create a booking.

The Apps Script HTML Service may render its page in a nested iframe. The current bridge communicates with the Pages top window using postMessage while validating the exact Pages origin and sender frame. Do not replace this with wildcard target origins.
