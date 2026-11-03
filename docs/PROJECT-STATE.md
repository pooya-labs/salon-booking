# Project State & Handoff

> Update this file at every meaningful checkpoint. It is the first file to read when resuming after a chat/session interruption.

## Identity

- Product: Salon Booking
- Repository: https://github.com/pooya-labs/salon-booking
- Product owner: salon owner (friend of Pooya)
- Engineering / creator credit: **Pooya**
- Default branch: `main`
- Deployment target: Cloudflare Workers + Static Assets + D1
- Current release: 0.6.0

## Current checkpoint

- Phase: **R03/R04 — Customer self-service and scheduling security (verified build; production D1 setup pending)**
- Status: Worker includes one-time first-owner bootstrap, PBKDF2 password hashing, secure 12-hour sessions, login/bootstrap rate limits, origin validation, authenticated booking list/status transitions, service CRUD, settings management, weekly split hours and date-specific multi-interval exceptions. Customers can look up bookings and cancel future pending/confirmed bookings using a one-time 256-bit token; only its SHA-256 hash is persisted. Customer status changes are recorded in a minimal history table. Pages shows a demo-only notice.
- Public customer booking uses the production API only in the Cloudflare build; Pages/local remain isolated in demo mode.
- Public preview: https://pooya-labs.github.io/salon-booking/
- Latest verified standard CI: run 41629668032 — success (25 unit tests, SQLite migration/security checks, Wrangler local Worker + D1 HTTP integration for public and owner APIs, TypeScript and Vite production build).
- Latest Pages deployment: run 41629667782 — success; includes the customer booking-management UI while remaining demo-only.
- Preview output is static-only. Time slots are sample data; the preview does not send or save personal information and does not create actual reservations.
- D1 is not provisioned, migrations 0001–0007 have not been applied remotely, salon timezone remains `unset`, and no real services/hours are configured.
- Worker code is not deployed to Cloudflare; owner secrets are not configured.
- The new integration harness applies migrations 0001–0007 to an isolated temporary D1 database using Wrangler's local Worker runtime, then tests the real HTTP routes. It does not connect to or change the owner's Cloudflare account or production database.
- Owner workspace supports login, upcoming-booking list/status transitions, service management and weekly/date-specific split schedule editing. Public availability/booking and customer lookup/cancellation are IP-HMAC rate-limited. New bookings issue a one-time 256-bit management token; the database stores only its SHA-256 digest. Customers can view a minimal booking summary and cancel pending/confirmed appointments before their start time. Full security QA remains outstanding.
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

1. Confirm the salon owner's cancellation notice period and publish the customer-facing policy.
2. Complete data-retention, export/deletion, backup, security-header, accessibility and threat-model reviews.
3. When owner-approved salon details are available, provision Cloudflare D1, configure its ID and apply migrations 0001–0007.
4. Add SESSION_SECRET and ADMIN_BOOTSTRAP_TOKEN as Worker secrets; deploy and bootstrap the first owner.
5. Confirm timezone, services, prices, hours and booking horizon; then perform owner/admin API tests and a production smoke test.
6. Never enable real booking on Pages; production booking belongs on Cloudflare.

## Latest Worker + D1 integration checkpoint (2026-11-03)

- Added `tests/worker-integration.mjs` and `npm run test:worker`; CI runs it after the production build.
- The harness creates a temporary Wrangler config with a syntactically valid local-only D1 identifier and stores D1 state in an isolated OS temp directory. It applies migrations 0001–0007 locally, seeds one synthetic service and one synthetic working day, then launches the actual Worker with a test-only SESSION_SECRET.
- HTTP coverage passed for health/config/services, availability, booking creation, duplicate-slot rejection, cross-origin rejection, invalid management token (generic 404), privacy-safe customer lookup, cancellation, repeated cancellation and slot release.
- CI run 41628055886 passed the new integration step; CI run 41628322387 also passed on the latest main workflow configuration.
- Latest Pages deployment on current main: run 41628322469 succeeded. Preview is still static and demo-only.
- Integration is against local Wrangler D1/workerd only. Owner/admin API end-to-end tests, remote Cloudflare D1 migration smoke testing, production deployment and live salon acceptance remain incomplete.
- CI now uses a versioned concurrency group and an 8-minute job ceiling; the test harness applies request timeouts and terminates Wrangler process groups so failed tests cannot leave a local Worker behind.
- Verified public-integration workflow checkpoint: 07b9b2de50bcd0533a449faa6dcec5ec92bec84f. The later owner API verification and response fix are recorded below.

## Latest owner API integration checkpoint (2026-11-03)

- Extended `tests/worker-integration.mjs` to exercise the actual owner API routes after public booking setup, using only synthetic local records and test-only credentials.
- Verified first-owner bootstrap is same-origin and protected by the bootstrap token; setup becomes initialized after the single first-owner creation.
- Verified secure session cookie flags, authenticated `/api/admin/me`, owner booking-list PII access, unauthenticated rejection, booking confirmation, invalid status transition rejection, service create/update/deactivate, logout revocation and a fresh login.
- The owner status-change integration test exposed a real response bug: the database row changed to `confirmed`, but checking `batch()[0].meta.changes` reported a false conflict in local D1. The Worker now uses `UPDATE ... RETURNING id` and confirms the returned row count. The complete integration test now passes.
- CI run 41629668032 passed; the Worker+D1 integration test log ends with the explicit PASS summary for both public and owner flows.
- Pages deployment run 41629667782 passed. Both runs are for code commit `f36495ca4aa453b0455c1751985973accc8df378`.
- Integration remains local Wrangler D1/workerd only. It does not prove remote Cloudflare D1 behavior or deploy the Worker to production.
- Owner/admin API coverage now includes authentication, booking list/status, and service CRUD. Schedule settings/weekly hours/date exceptions still need dedicated authenticated HTTP integration coverage.
- The test fixture bootstrap password and token are synthetic CI-only values and must never be reused in production.

## Resume instructions for the next assistant/session

1. Read `README.md`, `ROADMAP.md` and this file.
2. Inspect the latest commit and current `main` tree.
3. Inspect open issues/PRs and CI/deployment status if available.
4. Run or inspect the project's actual checks; never claim tests were run if they were not.
5. Continue from the first incomplete roadmap item.
6. Update this file and roadmap at the end of the session.


## Latest verified multi-interval checkpoint (2026-11-03)

- Canonical repository ownership is now `pooya-labs/salon-booking`; use this owner in all links and automation.
- Latest verified commit: `9dd92bd734dc7066cebcbdd6abd8be5d402547dd`.
- Feature commits: `a313c6f` schema and interval validation/tests; `b8fddbd` multi-window availability; `9863a18` owner schedule API; `98fd3cb` owner interval editor; `b24b6de` syntax repairs; `9dd92bd` final unused-helper cleanup.
- Migration 0005 adds normalized weekly and date-exception interval tables, database overlap triggers, and legacy data backfill.
- Owner UI supports up to eight intervals per day and per date override. Old single-range API request fields remain accepted.
- Availability generation iterates each interval separately; an appointment plus buffer cannot cross a break.
- Latest CI: run 41617819811 — success (16 unit tests; SQLite migration/overlap/backfill tests; TypeScript and Vite production build).
- Latest Pages deployment: run 41617819683 — success. Preview remains static-only and is not a live booking system.
- Important: initial two CI attempts exposed syntax issues; those were corrected before the green run. Do not cite failed runs as verification.

## Immediate next engineering priorities

1. Confirm the salon owner's desired cancellation notice period and publish the cancellation policy.
2. Add Worker/D1 integration tests for real D1 and multi-interval booking lifecycle, including remote migration smoke tests.
3. Complete data retention/export/deletion, backup, security-header, accessibility and threat-model reviews.
4. Prepare Cloudflare D1 provisioning and first deployment handoff; do not enable real bookings before owner details and launch gates are complete.

Production blockers and real salon details remain unchanged.

## Latest verified public rate-limit checkpoint (2026-11-03)

- Release line: 0.5.0.
- Latest feature commit: `a095126aae7e124dcd842e694bfd40e57cb883e7`.
- Migration 0006 adds `public_rate_limits` plus an expiry index.
- Public availability is limited to 180 requests per IP per fixed 15-minute window; booking creation is limited to 10 attempts per IP per fixed 15-minute window.
- Bucket identifiers use HMAC-SHA-256 with scope separation and `SESSION_SECRET`; raw IP is never stored. The Worker fails closed if rate limiting cannot be applied.
- Latest CI: run 41618574315 — success (19 unit tests, SQLite migration/security checks, TypeScript and Vite build).
- Latest Pages deployment: run 41618574444 — success. Static Pages remains a demo; Worker rate limiting is not running on Pages.
- Production D1 still needs migrations 0001–0006 applied remotely. `SESSION_SECRET` must be set before public availability/booking can pass the limiter.


## Latest customer self-service checkpoint (2026-11-03)

- Release line: 0.6.0.
- Migration 0007 adds `client_manage_token_hash` to bookings and a minimal status-event history with an automatic status-change trigger.
- New bookings receive an independent random 256-bit management token. Only its SHA-256 hash is stored; the plaintext token is returned once to the creating browser and is not included in owner API responses.
- Customer lookup requires both booking reference and management token. Only service name, local date/time, duration and status are returned; customer name, phone and notes are not exposed.
- Customer cancellation is permitted for pending/confirmed bookings until the scheduled start. Repeated cancellation is idempotent. A future owner-approved notice period is still undecided.
- Invalid/missing references and tokens share a generic HTTP 404 response. Lookup and cancellation are limited to 20 combined requests per IP per 15 minutes and require same-origin requests.
- GitHub Pages remains demo-only and never sends booking or management details.
- D1 must apply migrations 0001–0007; bookings created before migration 0007 do not have a self-service token.


## Latest verification refinement (2026-11-03)

- Test harness now imports the isolated customer-booking security helpers rather than trying to import the Cloudflare Worker entry in Node; this avoids Node ESM resolution differences while exercising the exact helpers used by the Worker.
- Added coverage for booking reference validation, correct/wrong/missing one-time token verification, 256-bit token hashing, cancellation eligibility (status + appointment start time), and same-origin enforcement.
- Latest verified code commit: `456f943485eb459b780703f0d10d968eee402433`.
- Latest CI: run 41624696511 — success (25 unit tests; migrations/status-history/rate-limit tests; TypeScript and Vite build).
- Latest Pages deployment: run 41624696397 — success.
- The customer endpoints are implemented but not yet tested against a provisioned remote Cloudflare D1 database. This remains a release-quality task.
