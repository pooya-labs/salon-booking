# Deployment Guide

## Active architecture

- **Frontend:** GitHub Pages — React, TypeScript, Vite.
- **API/runtime:** Google Apps Script Web App.
- **Database:** private Google Sheets spreadsheet owned by the deploying account.
- **Notifications:** Apps Script MailApp to the manager's email; Gmail Android notifications can surface the message.
- **Source of truth:** GitHub repository `pooya-labs/salon-booking`, branch `main`.

The Pages frontend forwards same-origin `/api/*` calls through a hidden Apps Script iframe bridge. Apps Script executes API logic and reads/writes Google Sheets. The browser does not call a Cloudflare Worker.

## One-time setup

Follow the complete [GitHub Pages + Apps Script setup guide](./GITHUB-PAGES-RELAY.md). The owner must:
1. Create a standalone Apps Script project and paste `relay/Code.gs`, `relay/Bridge.html` and `relay/appsscript.json`.
2. Run `setupSalonDatabase()` in the editor and approve spreadsheet/mail permissions.
3. Deploy as a Web App executing as the owner, with anonymous access.
4. Set the deployed `/exec` URL as GitHub Actions variable `SALON_RELAY_URL`.
5. Complete first-owner bootstrap on Pages at `/admin`.

The setup creates the private spreadsheet, application tabs, initial scheduling settings and a one-time bootstrap token in the execution log. Never commit that token or share it in chat.

## GitHub Pages deployment

The existing `.github/workflows/deploy-pages.yml` runs `npm run build:pages` with `VITE_SALON_RELAY_URL` sourced from the repository variable `SALON_RELAY_URL`. If the variable is absent, Pages intentionally stays in demo mode. A push to `main` publishes the configured version.

## Owner operation

Open [the live Pages site](https://pooya-labs.github.io/salon-booking/) and use the management link. Configure the salon's actual timezone, services and weekly schedule before accepting bookings. For a salon in Iran, select `Asia/Tehran`.

New booking emails are sent to the configured manager mailbox. Set it in the Apps Script editor with `setSalonNotificationEmail("manager@example.com")`. The default is the deploying Google account when its email is available. MailApp quotas are account-based and can change; see [Google's quota table](https://developers.google.com/apps-script/guides/services/quotas).

## Local development and checks

```bash
npm install
npm run lint
npm run test:unit
npm run test:migrations
npm run build
npm run build:pages
```

`npm run dev` without `VITE_SALON_RELAY_URL` uses sample data only. Never enter real customer information in local/demo mode.

## Legacy Cloudflare recovery assets

The old Worker source, Wrangler configurations and SQL migrations remain in the repository as temporary recovery material. They are not used by the active Pages build or Apps Script backend. Their D1 database is not automatically copied into Sheets; the existing Cloudflare resources are intentionally not deleted during this cutover.

Do not remove the old Worker/D1 until Apps Script passes owner acceptance and the owner confirms that any historical information required from D1 has been exported.
