# Deployment

## Current production setup

The live booking site uses the following services:

| Part | Service |
|---|---|
| Website and owner workspace | GitHub Pages |
| API and booking logic | Google Apps Script Web App |
| Application database | Private Google Sheets spreadsheet |
| Manager push notifications | Firebase Cloud Messaging |
| Optional email alerts | Apps Script MailApp |

The frontend sends API requests through the hidden Apps Script iframe bridge. The Apps Script project runs as the deploying owner and uses that account's spreadsheet. Cloudflare Workers and D1 are not used by the live version.

## GitHub Pages

The workflow in .github/workflows/deploy-pages.yml runs on pushes to main and can also be started manually.

It builds the frontend with these repository Actions variables:

- SALON_RELAY_URL
- FIREBASE_API_KEY
- FIREBASE_AUTH_DOMAIN
- FIREBASE_PROJECT_ID
- FIREBASE_STORAGE_BUCKET
- FIREBASE_MESSAGING_SENDER_ID
- FIREBASE_APP_ID
- FIREBASE_VAPID_KEY

The relay URL is the deployed Apps Script web app address ending in /exec. Firebase web configuration and the VAPID public key are client-side configuration; do not place private service credentials in these variables or in the frontend.

If SALON_RELAY_URL is missing, the Pages build runs in demo mode. Demo mode is for previews and testing only; it must not accept real customer data.

After deployment, the workflow runs a read-only relay smoke test when the relay variable is present. It checks the published page's connection to Apps Script without creating an appointment or changing the spreadsheet.

## Apps Script

The active Apps Script project is a separate Google-account resource. Keep the project, spreadsheet and existing Web App deployment under the salon owner's account.

When updating the backend:

1. Review the change in relay/Code.gs and relay/appsscript.json.
2. **A GitHub Pages deployment does not update Google Apps Script.** Copy the updated source into the existing Apps Script project separately.
3. Run setupSalonDatabase() if the change adds or updates spreadsheet columns or tabs. The setup is designed to be additive; confirm the target is the existing salon spreadsheet.
4. Approve only the scopes the project needs.
5. In Deploy → Manage deployments, edit the current Web App deployment and publish a new version.
6. Keep the same /exec address.
7. Rebuild GitHub Pages and check the relay smoke result.

Do not create a fresh spreadsheet or replace the current Apps Script deployment during routine maintenance.

## Native Android manager app

The owner app reuses the existing API, spreadsheet and Firebase project; it does not need a new server or database.

1. Register an Android app in the **same Firebase project** used by the website, with package name `com.pooyalabs.salonmanager`.
2. Download its `google-services.json` and place it at `android/app/google-services.json` for a local build. Never commit this file.
3. For GitHub Actions builds, add the Base64-encoded file as the repository secret `ANDROID_GOOGLE_SERVICES_JSON_BASE64`. The Android workflow injects it only during the build.
4. Keep the existing `SALON_RELAY_URL` Actions variable; the Android workflow uses the same `/exec` address as GitHub Pages.
5. Publish Apps Script source version **1.5.5** to the existing Web App deployment (keep the same `/exec` address). This adds the direct POST transport and Android FCM high-priority delivery.
6. Build with `cd android && ./gradlew :app:assembleDebug` after the Gradle wrapper is generated, or use Android Studio's Gradle sync. The debug APK is uploaded as a GitHub Actions artifact.

The Android app creates a high-importance notification channel with sound and vibration, requests `POST_NOTIFICATIONS` on Android 13+, and registers its FCM token in the existing `PushSubscriptions` sheet. Android users control channel sound and importance in system settings. FCM high priority is designed for user-visible alerts and can wake a sleeping device in Doze; force-stop, revoked notification permission, no network, and manufacturer battery restrictions can still delay or block delivery.

## First-time installation

For a new, separate installation, follow the steps in GITHUB-PAGES-RELAY.md. The owner must create the Apps Script project, run setup, deploy it as a Web App, add SALON_RELAY_URL and complete the owner bootstrap process.

## Local development

Use Node.js 22:

    npm install
    npm run dev
    npm run lint
    npm run test:unit
    npm run test:migrations
    npm run build
    npm run build:pages

Without VITE_SALON_RELAY_URL, local development uses sample data. Never enter real customer details in demo mode.

## Legacy Cloudflare resources

The Worker source, Wrangler files and D1 migrations remain in the repository as recovery material from an earlier deployment path. They are not part of the current production site. No automatic D1-to-Sheets migration exists.

Do not delete the old Cloudflare database or exports until the salon owner has confirmed that the historical data is no longer required.
