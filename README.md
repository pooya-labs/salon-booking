# Salon Booking

A polished, mobile-first appointment booking platform for an independent hair salon.

> **Product direction:** effortless booking for clients, calm and reliable scheduling for the salon owner.
>
> **Creator credit:** Designed & developed by **Pooya**.

## Project status

**Current phase:** R00 — Foundation & project governance  
**Current release:** 0.1.0 — Bootstrap  
**Default branch:** `main`  
**Deployment target:** Cloudflare Workers + Static Assets + D1  
**Frontend:** React, TypeScript, Vite, Tailwind CSS

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

The Worker will serve both the frontend assets and the `/api/*` endpoints. This avoids a separate VPS and keeps deployment simple. Cloudflare account setup and D1 provisioning are one-time operator steps; no credentials or secrets belong in Git.

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

## Deployment

Deployment is intentionally documented but not activated until a Cloudflare account is connected and a D1 database is provisioned.

1. Create a Cloudflare D1 database.
2. Put its database ID in the local/deployment Wrangler configuration (never commit API tokens).
3. Apply migrations with Wrangler.
4. Connect this GitHub repository to Cloudflare Workers Builds, or deploy with Wrangler.
5. Set production secrets through Cloudflare's dashboard/CLI.

See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md).

## Ownership and credits

Product implementation and engineering: **Pooya**.  
Salon name, service menu, prices, working hours, contact details and photography are configurable content and must be supplied/approved by the salon owner before launch.

## License

All rights reserved unless a license is added explicitly.
