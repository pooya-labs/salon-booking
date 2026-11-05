# Shayan Barber Booking

A premium barber appointment platform for Shayan, with a Persian RTL customer journey and a coordinated owner workspace.

**Brand:** Shayan Barber Studio (شایان)  
**Engineering / creator:** Pooya  
**Default branch:** `main`  
**Current release line:** 0.7.0 — Google Apps Script backend migration  
**Frontend:** React, TypeScript, Vite, Tailwind CSS  
**Hosting:** GitHub Pages  
**API + database:** Google Apps Script + private Google Sheets

Live site: https://pooya-labs.github.io/salon-booking/

**Studio contact:** میدان نامجو، خیابان پازوکی، کوچه دهقانی، پلاک ۱۱۸ · [Instagram @shayan_tatsu](https://www.instagram.com/shayan_tatsu/) · [۰۹۱۰ ۶۸۴ ۱۵۵۰](tel:+989106841550)

## Brand and visual identity

The site uses the owner-supplied barber emblem as its primary mark, with an obsidian-black canvas, warm antique-gold accents, ivory typography, rounded surfaces and layered Liquid Glass treatments. The public customer journey and owner workspace share the same visual system; the supplied logo assets remain separate brand elements. Reduced-motion preferences are respected across all interactive surfaces.

## Active architecture

1. GitHub Pages serves the customer website and manager panel.
2. A hidden iframe loads the owner's Google Apps Script Web App. The frontend forwards its same-origin `/api/*` calls through `google.script.run`.
3. Apps Script performs the API logic and stores application records in a private Google Spreadsheet.
4. Apps Script sends Firebase Cloud Messaging push notifications to registered manager devices; optional email notifications are off by default.

**Cloudflare is no longer in the active request path.** The former Worker, Wrangler configuration and D1 migrations remain in the repository as temporary recovery material until the Apps Script deployment passes acceptance. Existing D1 data is not copied automatically into Sheets.

The Pages build requires the GitHub Actions variable `SALON_RELAY_URL`. Without it, the site intentionally remains a demo and will not submit customer information.

The live Apps Script relay was verified on backend 1.4.0. The next backend release (1.5.0) changes online reservations to immediate confirmation, simplifies the owner appointment list to read-only, fixes daily-calendar lookup for legacy rows, corrects the weekly closed-day toggle, and memoizes repeated Sheets reads within each request. Deploy the updated `relay/Code.gs` to activate these backend changes.

## Main capabilities

- Service catalog and duration-aware available slots.
- Jalali calendar presentation with Iran-only `Asia/Tehran` scheduling; admin date pickers use the Persian calendar and time fields use 24-hour presentation.
- Conflict-safe reservation creation, idempotent retries and reference codes.
- Customer self-service lookup and cancellation with a one-time management token.
- Owner bootstrap/login, booking status management, service administration and weekly/date-specific scheduling.
- Editable services and prices; visual weekly opening-hour cards with a 24-hour timeline; a Jalali daily calendar for customer bookings, free slots and manager-blocked time; one-tap time blocking without customer name or phone; owner push notifications.

## Local development

Requirements: Node.js 22.13+ and npm.

```bash
npm install
npm run dev
npm run lint
npm run test:unit
npm run test:migrations
npm run build
npm run build:pages
```

Without `VITE_SALON_RELAY_URL`, local development uses sample data only. Never enter real customer information in local/demo mode.

## Apps Script deployment

Complete the owner-only steps in [docs/GITHUB-PAGES-RELAY.md](./docs/GITHUB-PAGES-RELAY.md):
- Create the Apps Script project from `relay/Code.gs`, `relay/Bridge.html` and `relay/appsscript.json`.
- Run `setupSalonDatabase()` to create the private spreadsheet and one-time bootstrap token.
- Deploy as a Web App executing as the owner with anonymous access.
- Add its `/exec` URL as the GitHub Actions variable `SALON_RELAY_URL`.
- Complete first-owner bootstrap at `https://pooya-labs.github.io/salon-booking/?admin=1`, then configure the salon's actual timezone, services and hours.

The Google account owner must authorize and deploy the Web App inside their own account. Repository code cannot publish a Web App into that account automatically.

## Project records

- [Delivery roadmap](./ROADMAP.md)
- [Project state and handoff](./docs/PROJECT-STATE.md)
- [Deployment guide](./docs/DEPLOYMENT.md)
- [API contract](./docs/API.md)
- [Owner workspace guide](./docs/ADMIN.md)
- [Privacy operations](./docs/PRIVACY-OPERATIONS.md)

All customer-facing copy, services, prices, hours, contact information and imagery require owner approval before launch.
