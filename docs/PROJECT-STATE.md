# Project State & Handoff

> Update this file at every meaningful checkpoint. It is the first file to read when resuming after a chat/session interruption.

## Identity

- Product: Salon Booking
- Repository: https://github.com/pooya16pg-spec/salon-booking
- Product owner: salon owner (friend of Pooya)
- Engineering / creator credit: **Pooya**
- Default branch: `main`
- Deployment target: Cloudflare Workers + Static Assets + D1
- Current release: 0.3.0

## Current checkpoint

- Phase: **R05/R06 — Owner workspace and admin security (first secure dashboard implementation committed; live D1 setup pending)**
- Status: Worker now includes one-time first-owner bootstrap, PBKDF2 password hashing, secure 12-hour sessions, login/bootstrap rate limits, origin validation, authenticated booking list and status transitions with D1 audit entries. Responsive owner UI is available at /admin on Cloudflare; Pages shows a demo-only notice.
- Public customer booking uses the production API only in the Cloudflare build; Pages/local remain isolated in demo mode.
- Public preview: https://pooya16pg-spec.github.io/salon-booking/
- Latest verified standard CI: run 41613207633 — success (13 unit tests, SQLite migration/security checks, TypeScript and Vite production build).
- Latest Pages deployment: run 41613207475 — success; owner demo-only view and booking preview published.
- Preview output is static-only. Time slots are sample data; the preview does not send or save personal information and does not create actual reservations.
- D1 is not provisioned, migrations 0002/0003 have not been applied remotely, salon timezone remains `unset`, and no real services/hours are configured.
- Worker code is not deployed to Cloudflare; owner secrets are not configured.
- Owner workspace supports login, upcoming-booking list and status transitions; service/schedule editing, client lookup/cancellation, public booking rate limits and full security QA remain outstanding.
- Production build remains root-based for the future Cloudflare Worker deployment.
- Production deployment: not configured.
- Production database: not provisioned.
- Real client data: must not be entered until security and launch gates pass.

## Decisions made

1. Keep the product focused on appointment booking and salon-owner scheduling.
2. Do not build a complex multi-tenant SaaS or marketplace.
3. Client booking requires no account in the first release.
4. Owner dashboard requires protected authentication.
5. Availability and double-booking prevention must be enforced server-side.
6. Persian RTL and Jalali dates are core requirements.
7. GitHub is the source of truth; Cloudflare is the runtime/hosting layer.
8. Use a free service tier initially, while respecting quotas and provider terms.
9. Public-facing salon branding remains configurable; Pooya's creator credit stays subtle in the footer and project documentation.
10. Never commit passwords, API tokens, D1 production data or private customer details.

## Known unknowns — do not invent

- Final salon/brand name.
- Whether the business is a barbershop, women's salon or unisex studio.
- City, address, map link and contact phone.
- Service names, prices and durations.
- Opening hours, breaks, holidays and booking horizon.
- Cancellation policy and whether owner approval is required.
- Salon-approved photography and logo.
- Owner's preferred login/contact method.

Use clearly marked placeholders until the owner supplies these details.

## Verification log

| Date | Checkpoint | Result |
|---|---|---|
| 2026-11-03 | Repository discovery | Empty repository confirmed; default branch `main` |
| 2026-11-03 | Bootstrap | React/Vite app, Worker entry, initial D1 schema, docs and CI workflow committed to `main` |
| 2026-11-03 | First CI attempt | Failed before dependency install because setup-node npm cache expected a lockfile; workflow corrected |
| 2026-11-03 | CI correction | Fixed missing lockfile cache assumption and pinned a published Workers Types v5 release after npm registry rejected the initial version |
| 2026-11-03 | Build verification | GitHub Actions run 41605843217 passed: dependency install, TypeScript project build and Vite production build |
| 2026-11-03 | Pages preview setup | Added Vite Pages base path, demo-only banner, and automated Pages workflow |
| 2026-11-03 | Pages build | Pages build passed and generated `dist/`; Setup Pages failed with 404 before artifact upload/deploy |
| 2026-11-03 | Standard CI | Run 41606497593 passed after Pages workflow and path configuration were added |
| 2026-11-03 | Pages retry after owner setting | Run 41606718648 reproduced the Pages API 404; build itself passed |
| 2026-11-03 | Pages enabled and deployment verified | Owner enabled GitHub Actions as Pages source; run 41607233352 passed all deployment steps and published the public preview URL |
| 2026-11-03 | Standard CI | Run 41607233200 passed |
| 2026-11-03 | Booking flow UI | Added four-step booking preview, Jalali date labels, sample slots, client input validation and review screen |
| 2026-11-03 | Initial booking-flow CI | Run 41607813191 failed only for an unused CalendarDays import; import removed |
| 2026-11-03 | Booking-flow build verification | Run 41607904598 passed dependency install, TypeScript check and Vite build |
| 2026-11-03 | Booking-flow Pages deployment | Run 41607904608 passed build, artifact upload and deploy; public preview updated |
| 2026-11-03 | Public Worker API | Added GET services, GET availability and POST bookings endpoints with input validation and normalized errors |
| 2026-11-03 | D1 booking migration | Added salon settings, configurable timezone/notice/horizon/buffer, and database triggers for overlapping active bookings |
| 2026-11-03 | Timezone engine | Added IANA timezone conversion and DST-gap rejection helpers; salon timezone remains unset pending owner confirmation |
| 2026-11-03 | Automated regression tests | CI now runs 7 date/timezone helper tests and SQLite migration/overlap-trigger tests; run 41610720053 passed |
| 2026-11-03 | Production UI/API integration | Cloudflare build loads public config/services, fetches available slots and submits booking requests; Pages and dev remain demo-only |
| 2026-11-03 | UI/API integration verification | Run 41611257259 passed unit tests, migration tests and TypeScript/Vite build; Pages run 41611257334 deployed successfully |
| 2026-11-03 | API documentation and handoff | Added public config contract, production/demo build separation and D1 provisioning guidance; CI 41611549763 and Pages 41611549999 both passed |
| 2026-11-03 | Admin security backend | Added one-time bootstrap, PBKDF2 hashes, secure session cookies, hashed-IP rate limits, same-origin checks and protected owner endpoints |
| 2026-11-03 | Admin dashboard UI | Added /admin sign-in/bootstrap states and responsive upcoming-bookings dashboard with status actions; Pages remains demo-only |
| 2026-11-03 | Admin regression tests | Added six password/session/origin tests and migration checks for rate-limit buckets and audit log; CI 41613207633 passed |
| 2026-11-03 | Admin preview publish | Pages run 41613207475 passed; no owner API is exposed or enabled in static preview |

## Current blockers / owner actions

- [x] GitHub Pages source is configured as GitHub Actions; no further Pages setup action is required.
- [ ] Before production: salon content and schedule must be supplied.
- [ ] Booking preview uses placeholder service prices and sample slots only; not for real appointments.
- [ ] Before production: repository owner must connect Cloudflare and provision D1.

## Next actions

1. Provision Cloudflare D1, configure its ID and apply migrations 0001–0003 (owner action).
2. Add SESSION_SECRET and ADMIN_BOOTSTRAP_TOKEN as Worker secrets; deploy and bootstrap the first owner.
3. Confirm salon timezone/content, then add service and opening-hours management to the dashboard.
4. Deploy and smoke-test the D1-backed public API and owner dashboard on Cloudflare.
5. Add public booking rate limiting, client lookup/cancellation, retention, backups and full security QA.
6. Never enable real booking on Pages; production booking belongs on Cloudflare.

## Resume instructions for the next assistant/session

1. Read `README.md`, `ROADMAP.md` and this file.
2. Inspect the latest commit and current `main` tree.
3. Inspect open issues/PRs and CI/deployment status if available.
4. Run or inspect the project's actual checks; never claim tests were run if they were not.
5. Continue from the first incomplete roadmap item.
6. Update this file and roadmap at the end of the session.
