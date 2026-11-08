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
2. Copy the updated source into the existing Apps Script project.
3. Run setupSalonDatabase() if the change adds or updates spreadsheet columns or tabs. The setup is designed to be additive; confirm the target is the existing salon spreadsheet.
4. Approve only the scopes the project needs.
5. In Deploy → Manage deployments, edit the current Web App deployment and publish a new version.
6. Keep the same /exec address.
7. Rebuild GitHub Pages and check the relay smoke result.

Do not create a fresh spreadsheet or replace the current Apps Script deployment during routine maintenance.

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
