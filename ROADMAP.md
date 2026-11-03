# Delivery Roadmap

This document is the durable source of truth for scope, completion, test evidence and handoff. Update it whenever a phase changes. Never mark work complete without evidence.

## Status legend

- [ ] Not started
- [~] In progress
- [x] Complete and verified
- [!] Blocked / requires owner action

## Release strategy

- **R0 — Foundation:** repository, architecture, design system, governance.
- **R1 — Public booking experience:** polished salon landing page and booking flow.
- **R2 — Scheduling engine:** working hours, services, availability, conflict-safe reservations.
- **R3 — Owner workspace:** authentication and day-to-day appointment management.
- **R4 — Production hardening:** privacy, security, accessibility, responsive QA, backups.
- **R5 — Launch:** Cloudflare deployment, operational handoff and real-world acceptance.

---

## R00 — Foundation and continuity

- [x] Confirm repository and default branch.
- [x] Establish product scope and non-goals.
- [x] Choose GitHub + Cloudflare Workers + D1 architecture.
- [x] Establish durable roadmap and project-state handoff.
- [x] Bootstrap Vite + React + TypeScript application.
- [x] Add Tailwind CSS integration and initial design tokens.
- [x] Add typecheck/build scripts and verify frontend + Worker TypeScript projects in GitHub Actions.
- [x] Add Cloudflare Worker static asset configuration.
- [x] Add initial D1 migration structure; production database ID still requires Cloudflare provisioning.
- [x] Add README, deployment guide, and durable project-state handoff.
- [x] Add ESLint 10 flat-config linting (TypeScript + React Hooks) and a documented local Worker/D1 environment; local/prod config separation is covered by automated tests and CI run 41649150974.
- [x] Add a separate GitHub Pages preview build target (repository subpath) without changing the future Cloudflare root build.
- [x] Add automated GitHub Pages deployment workflow for `main`; first publish is subject to one-time Pages source setting in repository settings.

**Exit criteria:** clean build, typed application shell, documented deployment prerequisites.

## R01 — Brand and visual system

- [x] Establish initial premium visual direction and responsive design tokens (provisional brand: «فُرم»).
- [x] Add a temporary preview banner and mark the not-yet-built admin entry as unavailable.
- [ ] Confirm salon name, barber/salon category and brand direction with owner.
- [ ] Create distinctive wordmark and compact mark.
- [ ] Define typography with Persian and Latin coverage.
- [ ] Define color, spacing, radius, shadow and motion tokens.
- [ ] Build responsive navigation and footer.
- [ ] Build reusable buttons, fields, cards, badges, dialogs and empty states.
- [ ] Add loading, success, error and offline states.
- [x] Validate contrast, keyboard focus and reduced-motion behavior: dual-ring focus styling and reduced-motion checks passed; automated axe-core WCAG 2.2 AA scans passed across the public homepage, booking and customer-management dialogs, owner dashboard, service editor, schedule tab, login and cancellation confirmation in [CI run 41668286672](https://github.com/pooya-labs/salon-booking/actions/runs/41668286672).

**Exit criteria:** consistent, premium visual language on narrow phones, tablets and desktop.

## R02 — Public salon website

- [x] Initial hero section with clear booking call-to-action.
- [x] Initial services list with duration and explicitly provisional prices.
- [x] Initial about/studio section.
- [~] Initial contact/location section; real address and working hours still need owner details.
- [ ] Gallery support (only owner-approved photos).
- [~] Mobile-first layout and lightweight assets (responsive CSS implemented; screenshot/device QA remains).
- [~] Add basic page title, description and social metadata; custom favicon/social artwork remains.
- [ ] Replace all placeholder copy/content before public launch.

**Exit criteria:** visitor understands the salon and can start booking immediately.

## R03 — Client booking journey

- [x] Service selection UI with direct service-card entry into the booking flow.
- [~] Production build loads the active service catalog from the Worker API; demo builds use sample services.
- [~] Jalali calendar labels are generated against the salon timezone when configured; the preview uses the visitor timezone.
- [~] Production booking step requests server-calculated available slots; demo builds use sample slots.
- [x] Client name and international phone-number format validation in the form and API.
- [x] Booking review screen with service, date, time, duration and contact summary.
- [~] Production confirmation posts to the Worker API and displays the generated reference plus one-time management token; requires configured D1 and salon schedule.
- [x] Server-provided available time slots API is implemented and connected to the production UI.
- [x] Booking creation endpoint and random reference generation are implemented; live acceptance is pending D1 setup.
- [x] Customer booking lookup by reference plus one-time 256-bit management token; token hash only is stored, and invalid references/tokens share a generic response.
- [x] Customer cancellation endpoint for pending/confirmed future bookings, with status history and IP-HMAC rate limiting.
- [ ] Owner-confirmed cancellation notice period and customer-facing policy copy (current behavior permits cancellation before appointment start).
- [x] Accessible field labels, validation error message and step navigation.
- [x] SQLite overlap triggers reject conflicting active reservations; booking UI uses a synchronous submission lock to prevent rapid duplicate clicks.
- [x] Server-side idempotency-key replay is implemented and verified with migration 0008, D1 transaction tests and concurrent Worker requests.

**Preview safety:** GitHub Pages shows the full client-side journey for design review only. It never stores or transmits customer details and must not be used for real appointments.

**Exit criteria:** a client can complete a real booking on a phone without an account.

## R04 — Scheduling and data layer

- [x] D1 schema for services, opening hours, exceptions, bookings, admin identity, salon settings, normalized weekly/date intervals, public rate limits and customer management tokens/status history (migrations 0001–0009; production D1 not yet provisioned).
- [x] Versioned SQL migrations, with SQLite migration/trigger regression tests.
- [x] No placeholder services or business hours are seeded into production.
- [x] Public API input validation and normalized error responses.
- [~] IANA timezone conversion and UTC persistence implemented; service duration and buffer use elapsed UTC minutes across DST transitions (spring-forward/fall-back Worker+D1 tests passed in CI 41670652871); salon timezone remains `unset` until owner confirmation.
- [x] Availability calculated on the server from service duration, opening hours, exceptions, settings and active bookings.
- [x] Database triggers reject overlapping active reservations on insert and update.
- [x] Service duration and configurable buffers respected.
- [x] Service duration is snapshotted when a booking is created; migration 0009 backfills existing bookings, and Worker+D1 tests confirm later service edits do not rewrite the duration shown to customers or the owner.
- [x] Closed dates and one-off opening windows supported through schedule exceptions.
- [x] Multiple non-overlapping daily intervals per weekday and date exception (up to eight each), including breaks; migration 0005 backfills legacy single-window schedules.
- [x] Booking state transitions audited.
- [x] Fixed-window IP-HMAC limits protect public availability (180/15 min), booking creation (10/15 min), and customer lookup/cancellation (20/15 min).
- [x] Data inventory, owner-controlled retention schedule template, private export/backup, subject export, deletion preview and cascade-aware deletion procedure documented in `docs/PRIVACY-OPERATIONS.md`; retention periods and real backup verification remain owner actions.

**Exit criteria:** booking correctness is enforced by the backend and database under concurrent requests.

## R05 — Salon owner dashboard

- [x] Secure owner sign-in and sign-out endpoints and first-owner bootstrap flow.
- [x] Session lifecycle, 12-hour expiry, database revocation and secure cookie.
- [x] Dashboard overview for the selected seven-day salon-local window; defaults to the next seven days and updates as the owner navigates.
- [x] Responsive appointment list with status filter and seven-day previous/next/reset navigation; changing the status filter preserves the selected date range.
- [x] Confirm, cancel, complete and no-show transitions with server-side state checks.
- [x] Create/edit/close weekly working hours with up to eight intervals per day.
- [x] Manage breaks through split intervals and date-specific closures/one-off hours.
- [x] Manage service CRUD fields, duration, price, display order and activation.
- [x] Client contact details are returned only inside the authenticated owner workspace.
- [x] Responsive admin sign-in and appointment list UI.
- [x] Booking status changes, service create/update, salon settings, weekly hours and schedule exception create/delete write owner-attributed D1 audit events; local Worker+D1 integration tests verify all seven event types. Cancellation, completion and no-show transitions require explicit confirmation; browser QA verifies that cancelling the prompt sends no mutation.

**Exit criteria:** owner can run the daily schedule without touching GitHub or Cloudflare.

## R06 — Security and privacy

- [x] Admin API routes require a server-validated owner session.
- [x] Passwords stored as salted PBKDF2-HMAC-SHA-256 hashes (600,000 iterations).
- [x] HttpOnly, Secure, SameSite=Strict host-only cookie and same-origin checks on mutations.
- [x] Every implemented owner mutation checks the authenticated owner server-side.
- [x] Public APIs do not expose owner booking lists or admin records.
- [x] Personal-data minimization documented and verified: minimal status-history schema, no direct identity fields, audit-detail checks and booking-erasure cascade tests.
- [x] Secrets are read only from Worker secret bindings; no defaults are committed.
- [x] Worker security headers and HTML/API CSP are integration-tested; HTML scripts/connections are self-only, images/fonts are self/data-only, arbitrary HTTPS resources and unsafe-eval are blocked. Inline styles remain allowed.
- [x] Login/bootstrap, public availability/booking, and customer lookup/cancellation fixed-window rate limits use HMAC-derived IP buckets.
- [~] Internal threat model and residual-risk register documented in `docs/SECURITY-THREAT-MODEL.md`; independent penetration testing and production Cloudflare/account review remain.
- [x] Tests contain no real client data or credentials.

**Exit criteria:** documented security review with no known critical/high issues.

## R07 — Quality and acceptance

- [x] Unit tests for timezone/date/scheduling helpers, multi-interval normalization, HMAC rate-limit buckets, admin password/session security, customer-management credential/cancellation helpers, phone normalization, local-config guards and date-range arithmetic (37 tests; latest CI run 41654596006 passed).
- [x] Public booking and owner-admin lifecycle/authorization HTTP tests against a local Wrangler Worker + D1 environment: service catalog, availability, booking creation/conflict, customer origin/token/privacy/cancellation/slot release, first-owner bootstrap, secure session, login/logout/revocation, protected owner booking list/status transitions, service CRUD, salon settings, timezone-change conflict protection, split weekly intervals, break-aware availability, overlap rejection and date-exception create/read/delete.
- [x] SQLite regression test for overlapping insert/update protection.
- [x] Migration regression on clean SQLite plus automated Wrangler local-D1 application of migrations 0001–0009 (remote Cloudflare D1 application remains pending).
- [x] Production build and TypeScript checks (latest CI run 41654596006 passed).
- [x] Automated Chromium responsive QA at 320, 360, 390, 430, 768, 1024, 1280 and 1440 px (mobile, tablet and desktop viewport emulation; not physical-device certification).
- [x] RTL, Persian digit, Jalali calendar and visitor-local day-boundary checks across Asia/Tehran, Europe/Berlin and America/Los_Angeles.
- [x] Automated keyboard/accessibility behavior for both booking and customer-management dialogs: accessible dialog name, initial focus, Tab/Shift+Tab containment, Escape close, focus restoration and scroll lock.
- [x] Add and pass axe-core automated WCAG 2.2 A/AA scans for the public homepage, booking/customer dialogs, owner dashboard, service editor, schedule tab, owner login and destructive-action confirmation; all scans passed on current `main` in [CI run 41668286672](https://github.com/pooya-labs/salon-booking/actions/runs/41668286672).
- [ ] Real assistive-technology/screen-reader audit and physical iOS/Android device acceptance (not represented as passed by desktop Chromium emulation).
- [x] Static asset-size budget review: JavaScript 226,328 bytes and CSS 50,256 bytes, below 1 MiB/256 KiB CI budgets; production network performance/Lighthouse profiling remains separate.
- [x] Browser runtime/network review on the static preview: zero uncaught exceptions, console errors, failed requests, HTTP errors, API calls or third-party requests in the automated Chromium run.
- [x] Owner dashboard Chromium QA: seven-day range navigation, status-filter range preservation, explicit confirmation for cancellation/completion/no-show, cancelled confirmation sends no mutation, and responsive widths 360–1440 px; [CI run 41654596006](https://github.com/pooya-labs/salon-booking/actions/runs/41654596006) passed.
- [x] Remove silent row caps from owner booking lists, schedule exception reads and booking-versus-schedule conflict guards. Worker+D1 regressions cover the former 200-row booking-list cap (202 synthetic records), 2,000-row weekly-hours conflict cap (2,003 target-weekday records, with 202 other-weekday fixtures also occupying the same scan window and the only target-weekday conflict beyond the old limit), and 180-exception/1,440-interval schedule-read caps (181 exceptions / 1,448 intervals). All regressions passed in [CI run 41668286672](https://github.com/pooya-labs/salon-booking/actions/runs/41668286672) on the verified main head. [Implementation](https://github.com/pooya-labs/salon-booking/commit/bfdbcd9dadec121401e2e777abe57d5f0320a0d4), [initial regression](https://github.com/pooya-labs/salon-booking/commit/69131a8f9ca30e80163597712ea1588761feff90), [expanded cap coverage](https://github.com/pooya-labs/salon-booking/commit/4cc5b8ee05dd1a0c54e930e025137de9791ee4dd), [fixture constraint correction](https://github.com/pooya-labs/salon-booking/commit/0424d8c0d229c68cd6375cea68f3cd32a22b2af5).
- [ ] Owner acceptance checklist completed.

**Exit criteria:** all critical flows pass and all known limitations are recorded.

## R08 — Deployment and launch

- [x] Temporary static preview pipeline committed for GitHub Pages (not the production runtime).
- [x] Enable GitHub Pages publishing source as GitHub Actions (owner completed the one-time setting; deployment verified successful).
- [x] Document Worker rollback, release backup/export and D1 recovery separation in `docs/DEPLOYMENT.md`; production rollback/restore drill remains untested because no production D1/Worker exists.
- [ ] Cloudflare account connected by repository owner.
- [ ] D1 database created and database ID configured.
- [ ] Production migrations applied.
- [ ] Owner authentication secret/credentials provisioned securely.
- [ ] GitHub-to-Cloudflare deployment configured.
- [ ] Production URL and custom domain decision documented (custom domain optional).
- [ ] Smoke tests run against production.
- [~] Wrangler local D1 export/restore smoke test passes in CI; owner production backup/restore validation remains pending.
- [x] Worker rollback and D1 recovery runbook documented in `docs/DEPLOYMENT.md`; live rollback/restore drill remains unverified.
- [ ] Owner receives concise operating instructions.
- [ ] Launch approval recorded.

**Exit criteria:** real booking can be made and managed in production; owner understands routine operations.

## R09 — Optional post-launch improvements

- [ ] SMS reminders (only after provider and costs are approved).
- [ ] WhatsApp deep-link contact/reminders (no unofficial automation).
- [x] Customer self-service lookup and pre-start cancellation delivered in R03. Rescheduling remains optional and out of the first release.
- [ ] Multiple staff/chairs only if the salon needs them.
- [ ] Analytics with privacy-conscious, minimal data.
- [ ] PWA installability if useful.
- [ ] Additional language support if required.

These are explicitly out of the first release unless the owner asks for them.

## Preview environment — GitHub Pages

The Pages build uses `npm run build:pages` and Vite base path `/salon-booking/`. Latest verified deployment: workflow 41633720066 succeeded on 2026-11-03 and includes the customer booking-management preview UI. The preview remains demo-only. Public API rate limiting is only active in the Cloudflare Worker, not on static Pages. Public preview: https://pooya-labs.github.io/salon-booking/. It is a static interactive UI preview only: no real booking, customer data, owner sign-in or database is enabled there. The production build remains root-based (`npm run build`) and targets Cloudflare Workers + D1. Do not collect real customer data through the preview.

---

## Definition of done

A task is complete only when:
1. Code is committed to `main`.
2. Typecheck/build/tests relevant to the change pass, or the blocker is stated.
3. The roadmap checkbox is updated.
4. `docs/PROJECT-STATE.md` records the new checkpoint.
5. Any required manual action is described as exact, step-by-step instructions.

## Handoff protocol after interruption

At the end of every meaningful work session update:
- Current phase and task.
- Last verified commit.
- Files changed.
- Checks run and their actual results.
- Known bugs and unresolved decisions.
- Exact next action.
- Any owner action required.

Do not redo completed tasks. Read this file and `docs/PROJECT-STATE.md` before resuming.
