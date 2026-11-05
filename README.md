# Shayan Barber Booking

A production-ready barber appointment platform for Shayan Barber Studio, with a Persian RTL customer booking journey and a coordinated owner workspace.

**Product:** Shayan Barber Studio (شایان)  
**Engineering / creator:** Pooya  
**Release:** **1.0.0** · 2026-11-05  
**Default branch:** main  
**Frontend:** React · TypeScript · Vite · Tailwind CSS  
**Hosting:** GitHub Pages  
**API + database:** Google Apps Script · private Google Sheets  
**Manager notifications:** Firebase Cloud Messaging

**Live website:** https://pooya-labs.github.io/salon-booking/  
**Owner panel:** https://pooya-labs.github.io/salon-booking/?admin=1

**Studio contact:** میدان نامجو، خیابان پازوکی، کوچه دهقانی، پلاک ۱۱۸ · [Instagram @shayan_tatsu](https://www.instagram.com/shayan_tatsu/) · [۰۹۱۰ ۶۸۴ ۱۵۵۰](tel:+989106841550)

## Version 1.0.0

The first release is owner-accepted. The public site, live Apps Script connection, owner workspace, scheduling configuration and manager notifications have been tested by the owner. The latest automated CI and Pages deployment workflows also passed; see ROADMAP.md for release evidence and scope.

### Included

- Shayan brand identity and responsive obsidian / antique-gold Liquid Glass design.
- Persian RTL customer experience with Jalali date presentation and Iran timezone (Asia/Tehran).
- Service catalogue with owner-managed descriptions, duration and prices.
- Live availability and conflict-safe online appointment booking.
- Booking reference and customer self-service lookup/cancellation.
- Owner sign-in with persistent rolling sessions.
- Owner dashboard, daily calendar, appointment management and time blocking.
- Weekly opening hours, breaks, closures and one-off schedule exceptions.
- Firebase push notifications to the registered manager device.
- Optional email notifications (off by default).

## Active architecture

1. GitHub Pages serves the public website and manager panel.
2. A hidden iframe loads the owner's Google Apps Script Web App and bridges API requests.
3. Apps Script executes the API and stores application records in a private Google Spreadsheet.
4. Firebase Cloud Messaging sends push notifications to registered manager devices.

**Cloudflare Workers and D1 are not in the active request path.** Their files remain in the repository as legacy recovery material and must not be treated as the current production architecture.

The Pages deployment uses the repository's SALON_RELAY_URL Actions variable and Firebase configuration variables. Without the Apps Script relay variable, a Pages build intentionally falls back to demo mode and must not be used for real customer bookings.

## Backend version

The Apps Script source in relay/Code.gs reports backend version **1.5.3**. This is separate from the product release version **1.0.0**. The active Apps Script Web App deployment and its existing /exec URL are owner-managed; do not replace the deployment or spreadsheet casually.

## Local development and checks

Requirements: Node.js 22 and npm.

    npm install
    npm run dev
    npm run lint
    npm run test:unit
    npm run test:migrations
    npm run build
    npm run build:pages

Without VITE_SALON_RELAY_URL, local development and preview use demo data. Never enter real customer information in demo mode.

## Deployment and operations

The production Apps Script project, private spreadsheet, OAuth authorization and Web App deployment are owned and administered through the salon owner's Google account. The GitHub Pages workflow builds and deploys the public frontend. See:

- [Delivery roadmap and release evidence](./ROADMAP.md)
- [Project state and handoff](./docs/PROJECT-STATE.md)
- [Apps Script relay guide](./docs/GITHUB-PAGES-RELAY.md)
- [Deployment guide](./docs/DEPLOYMENT.md)
- [API contract](./docs/API.md)
- [Owner workspace guide](./docs/ADMIN.md)
- [Privacy operations](./docs/PRIVACY-OPERATIONS.md)

## Release policy

Version 1.0.0 is complete. New features belong in a subsequent release. Preserve the active Pages + Apps Script + Sheets + Firebase architecture unless a deliberate, documented migration is approved.
