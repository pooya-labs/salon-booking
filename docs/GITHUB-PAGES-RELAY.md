# GitHub Pages + Google Apps Script setup

This is the active deployment path. GitHub Pages serves the React site; an Apps Script Web App provides the API and creates a private Google Spreadsheet for the salon database. The customer browser does not call a Cloudflare Worker.

## 1. Create the Apps Script project

1. Open [script.google.com](https://script.google.com/) using the Google account that should own the database and booking notifications.
2. Create a standalone project, for example `Salon Booking Backend`.
3. Replace `Code.gs` with the repository's [`relay/Code.gs`](../relay/Code.gs).
4. Add an HTML file named `Bridge` and paste [`relay/Bridge.html`](../relay/Bridge.html).
5. In Project Settings, enable **Show "appsscript.json" manifest file in editor**. Replace it with [`relay/appsscript.json`](../relay/appsscript.json), then save.

The manifest selects V8, spreadsheet/mail/user-info scopes, `Asia/Tehran` as the script timezone, owner execution and anonymous Web App access. Google's [manifest reference](https://developers.google.com/apps-script/manifest/web-app-api-executable) documents these access and execution values.

## 2. Create the private database and authorize email

1. In the function picker, choose `setupSalonDatabase` and click **Run**.
2. Approve Google Sheets and Mail permissions.
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

1. Open the live site and choose **مدیریت**, or visit `/salon-booking/admin`.
2. Enter the one-time bootstrap token from the Apps Script execution log.
3. Choose the manager username and a password of at least 12 characters.
4. In **تنظیمات استودیو**, select the salon's actual timezone. For a salon in Iran, use `Asia/Tehran`.
5. Add real services, prices, weekly opening intervals and date-specific closures.

The one-time bootstrap token is deleted after the first owner is created. Owner sessions expire after six hours.

## 6. Booking notifications

After a booking is saved to Sheets, Apps Script emails the manager. With Gmail notifications enabled on Android, the email can appear as a phone notification. If delivery fails or the daily quota is exhausted, the booking remains saved; check Apps Script **Executions** and the notification recipient setting.

The published consumer-account MailApp allowance is currently 100 recipients/day and is subject to change. At about 20 bookings/day, one email recipient per booking is within that published quota. See [Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas).

## Deployment boundary

The backend source is committed to GitHub, but Apps Script projects are separate Google-account resources. This repository integration cannot authorize or publish a Web App inside the owner's Google account. The owner must complete steps 1–4. Do not treat the migration as live until the `/exec` URL is deployed, the GitHub variable is set, and a booking plus Gmail notification are verified from an Iranian network.

The previous Cloudflare Worker and D1 are intentionally left untouched as a temporary recovery source. No automatic D1-to-Sheets copy is performed. Do not delete Cloudflare resources until the Apps Script path passes owner acceptance.
