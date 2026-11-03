# Project State & Handoff

> Update this file at every meaningful checkpoint. It is the first file to read when resuming after a chat/session interruption.

## Identity

- Product: Salon Booking
- Repository: https://github.com/pooya16pg-spec/salon-booking
- Product owner: salon owner (friend of Pooya)
- Engineering / creator credit: **Pooya**
- Default branch: `main`
- Deployment target: Cloudflare Workers + Static Assets + D1
- Current release: 0.1.0

## Current checkpoint

- Phase: **R03 — Client booking journey (interactive preview implemented; API integration pending)**
- Status: Guided four-step booking flow committed to main. Includes service selection, 14-day Jalali date labels, sample time slots, client name/phone validation and a final review screen.
- Public preview: https://pooya16pg-spec.github.io/salon-booking/
- Latest verified standard CI: run 41607904598 — success (TypeScript + Vite production build).
- Latest Pages deployment: run 41607904608 — success; updated interactive preview published.
- Preview output is static-only. Time slots are sample data; the preview does not send or save personal information and does not create actual reservations. There is no connected D1 database or owner authentication yet.
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

## Current blockers / owner actions

- [x] GitHub Pages source is configured as GitHub Actions; no further Pages setup action is required.
- [ ] Before production: salon content and schedule must be supplied.
- [ ] Booking preview uses placeholder service prices and sample slots only; not for real appointments.
- [ ] Before production: repository owner must connect Cloudflare and provision D1.

## Next actions

1. Connect the booking flow to API-backed service catalog and availability endpoints.
2. Implement secure, conflict-safe booking creation and booking-reference lookup in D1.
3. Build protected owner dashboard and scheduling controls.
4. Complete security/privacy QA and transfer production hosting to Cloudflare Workers + D1.
5. Before production, obtain salon content and owner acceptance.
6. Never enable real booking on Pages; production booking belongs on Cloudflare.

## Resume instructions for the next assistant/session

1. Read `README.md`, `ROADMAP.md` and this file.
2. Inspect the latest commit and current `main` tree.
3. Inspect open issues/PRs and CI/deployment status if available.
4. Run or inspect the project's actual checks; never claim tests were run if they were not.
5. Continue from the first incomplete roadmap item.
6. Update this file and roadmap at the end of the session.
