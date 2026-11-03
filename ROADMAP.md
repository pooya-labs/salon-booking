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
- [ ] Add linting and a documented local environment example.
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
- [ ] Validate contrast, keyboard focus and reduced-motion behavior.

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
- [x] Jalali calendar labels for the next 14 days; past dates are excluded from the preview.
- [~] Selectable time-slot interface (currently clearly marked sample slots; server availability is not connected yet).
- [x] Client name and international phone-number format validation in the form.
- [x] Booking review screen with service, date, time, duration and contact summary.
- [~] Preview completion state is explicit and does not submit/save personal data; real confirmation and reference code require the production API.
- [ ] Server-provided available time slots.
- [ ] Booking reference generation from the backend.
- [ ] Lookup booking by reference + verified contact detail.
- [ ] Clear cancellation/reschedule policy supplied and displayed.
- [x] Accessible field labels, validation error message and step navigation.
- [ ] Prevent duplicate submissions and double booking in the backend/database.

**Preview safety:** GitHub Pages shows the full client-side journey for design review only. It never stores or transmits customer details and must not be used for real appointments.

**Exit criteria:** a client can complete a real booking on a phone without an account.

## R04 — Scheduling and data layer

- [ ] D1 schema for services, opening hours, exceptions, bookings and admin identity.
- [ ] Versioned SQL migrations.
- [ ] Seed/development data kept separate from production.
- [ ] API input validation and normalized error responses.
- [ ] Timezone policy documented and applied consistently.
- [ ] Availability calculated on the server.
- [ ] Atomic conflict protection for overlapping bookings.
- [ ] Service duration and configurable buffers respected.
- [ ] Closed days, breaks, leave and manual blocks supported.
- [ ] Booking state transitions audited.
- [ ] Rate limiting and abuse controls.
- [ ] Data retention and export/deletion procedure documented.

**Exit criteria:** booking correctness is enforced by the backend and database under concurrent requests.

## R05 — Salon owner dashboard

- [ ] Secure owner sign-in and sign-out.
- [ ] Session lifecycle, expiry and revocation.
- [ ] Dashboard overview for today and upcoming bookings.
- [ ] Calendar/list views with filters.
- [ ] Confirm, cancel, complete and no-show states.
- [ ] Create/edit/block working hours.
- [ ] Manage breaks, holidays and time-off.
- [ ] Manage services, duration and price.
- [ ] View client contact details only when operationally necessary.
- [ ] Responsive admin experience.
- [ ] Destructive-action confirmation and audit trail.

**Exit criteria:** owner can run the daily schedule without touching GitHub or Cloudflare.

## R06 — Security and privacy

- [ ] Admin routes protected server-side, not merely hidden in UI.
- [ ] Passwords handled with an appropriate password-hashing approach.
- [ ] Secure, HttpOnly, SameSite cookies and CSRF protections where applicable.
- [ ] Strict authorization for every owner mutation.
- [ ] Public APIs expose no private client list or admin data.
- [ ] Phone numbers and personal data are minimized.
- [ ] Secrets stored only in Cloudflare secrets.
- [ ] Security headers and input/output handling reviewed.
- [ ] Rate limits for sign-in, booking and lookup endpoints.
- [ ] Threat review for booking enumeration and spam.
- [ ] No real client data in screenshots, tests or seed fixtures.

**Exit criteria:** documented security review with no known critical/high issues.

## R07 — Quality and acceptance

- [ ] Unit tests for scheduling and validation.
- [ ] API tests for booking lifecycle and authorization.
- [ ] Concurrent booking conflict test.
- [ ] Migration test against a clean D1 database.
- [ ] Production build and TypeScript checks.
- [ ] Mobile viewport QA (small phone through large phone).
- [ ] Desktop/tablet QA.
- [ ] RTL, Persian digits, Jalali date and timezone QA.
- [ ] Keyboard and screen-reader smoke test.
- [ ] Performance and asset-size review.
- [ ] Browser console/network error review.
- [ ] Owner acceptance checklist completed.

**Exit criteria:** all critical flows pass and all known limitations are recorded.

## R08 — Deployment and launch

- [x] Temporary static preview pipeline committed for GitHub Pages (not the production runtime).
- [x] Enable GitHub Pages publishing source as GitHub Actions (owner completed the one-time setting; deployment verified successful).
- [ ] Cloudflare account connected by repository owner.
- [ ] D1 database created and database ID configured.
- [ ] Production migrations applied.
- [ ] Owner authentication secret/credentials provisioned securely.
- [ ] GitHub-to-Cloudflare deployment configured.
- [ ] Production URL and custom domain decision documented (custom domain optional).
- [ ] Smoke tests run against production.
- [ ] Backup/export procedure verified.
- [ ] Rollback procedure documented.
- [ ] Owner receives concise operating instructions.
- [ ] Launch approval recorded.

**Exit criteria:** real booking can be made and managed in production; owner understands routine operations.

## R09 — Optional post-launch improvements

- [ ] SMS reminders (only after provider and costs are approved).
- [ ] WhatsApp deep-link contact/reminders (no unofficial automation).
- [ ] Customer self-service cancellation/rescheduling.
- [ ] Multiple staff/chairs only if the salon needs them.
- [ ] Analytics with privacy-conscious, minimal data.
- [ ] PWA installability if useful.
- [ ] Additional language support if required.

These are explicitly out of the first release unless the owner asks for them.

## Preview environment — GitHub Pages

The Pages build uses `npm run build:pages` and Vite base path `/salon-booking/`. Deployment workflow 41607233352 published the initial preview and workflow 41607904608 published the interactive booking-flow update successfully on 2026-11-03. Public preview: https://pooya16pg-spec.github.io/salon-booking/. It is a static interactive UI preview only: no real booking, customer data, owner sign-in or database is enabled there. The production build remains root-based (`npm run build`) and targets Cloudflare Workers + D1. Do not collect real customer data through the preview.

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
