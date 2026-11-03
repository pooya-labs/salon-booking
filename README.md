# Salon Booking

A polished, mobile-first appointment booking platform for an independent hair salon.

> **Product direction:** effortless booking for clients, calm and reliable scheduling for the salon owner.
>
> **Creator credit:** Designed & developed by **Pooya**.

## Project status

**Current phase:** R04/R05 — Multi-interval scheduling and owner management  
**Current release:** 0.6.0 — Customer booking lookup and cancellation  
**Default branch:** `main`  
**Preview:** GitHub Pages (static visual preview)  
**Production target:** Cloudflare Workers + Static Assets + D1  
**Frontend:** React, TypeScript, Vite, Tailwind CSS

Live preview: https://pooya-labs.github.io/salon-booking/ (GitHub Pages deployment verified on 2026-11-03).

See [ROADMAP.md](./ROADMAP.md) for the full delivery plan and [docs/PROJECT-STATE.md](./docs/PROJECT-STATE.md) for the exact handoff checkpoint.

## Product principles

- Booking should take less than a minute on a phone.
- No client account is required for the initial release.
- The salon owner gets a separate, protected admin area.
- Availability and booking conflicts are enforced on the server/database, never only in the browser.
- Persian (RTL), Jalali dates and local time are first-class requirements.
- Keep the product focused: no unnecessary marketplace, social feed, or overbuilt dashboard.

## Planned architecture

- **Web app:** React + TypeScript + Vite
- **Styling:** Tailwind CSS
- **Runtime/API:** Cloudflare Worker
- **Database:** Cloudflare D1 (SQLite)
- **Hosting:** Cloudflare Workers Static Assets
- **Source of truth:** GitHub, `main`

The Worker serves frontend assets and JSON API routes. Public endpoints provide active services, timezone-aware availability, conflict-safe booking creation, and customer lookup/cancellation guarded by one-time management tokens. The frontend uses those endpoints in the Cloudflare production build; GitHub Pages and local development intentionally keep sample data only. Cloudflare account setup and D1 provisioning are one-time operator steps; no credentials or secrets belong in Git.

## Local development

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Build and type-check:

```bash
npm run typecheck
npm run build
```

## Preview vs production

GitHub Pages is used temporarily to review the visual frontend and interactive booking journey. Its admin link opens a non-functional design notice. Pages does not run the Worker API or D1 database; selected services, dates and slots are sample data, and it never creates reservations or submits personal details. Do not submit real customer information there.

The Cloudflare production build includes the public booking API and secure owner sign-in/dashboard. The dashboard lists bookings, supports approved status transitions, manages services, and edits weekly/date-specific opening intervals. Customers can look up and cancel their own future bookings using a one-time random management token. Public APIs are rate-limited with HMAC-based IP buckets. Production provisioning and final security/QA gates remain.

## Deployment

Production deployment is intentionally documented but not activated until a Cloudflare account is connected and a D1 database is provisioned. Apply migrations 0001–0007 in order; migration 0005 introduces split daily opening intervals, migration 0006 adds public API rate-limit storage, and migration 0007 adds one-time customer booking credentials and status history.

1. Create a Cloudflare D1 database.
2. Put its database ID in the local/deployment Wrangler configuration (never commit API tokens).
3. Apply migrations with Wrangler.
4. Connect this GitHub repository to Cloudflare Workers Builds, or deploy with Wrangler.
5. Set production secrets through Cloudflare's dashboard/CLI.

See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md), the [public API contract](./docs/API.md), and the [privacy operations guide](./docs/PRIVACY-OPERATIONS.md).

## Ownership and credits

Product implementation and engineering: **Pooya**.  
Salon name, service menu, prices, working hours, contact details and photography are configurable content and must be supplied/approved by the salon owner before launch.

## License

All rights reserved unless a license is added explicitly.
