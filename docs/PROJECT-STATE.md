# Latest owner workspace checkpoint — persistent admin sessions (2026-11-05)

- Implementation target: Apps Script backend **1.4.0** with rolling 30-day owner sessions.
- The existing random relay session identifier remains in the same browser local storage; the server persists only its SHA-256 hash in the existing private `AdminSessions` sheet.
- Authenticated activity automatically renews the session before it reaches expiry. CacheService remains capped at six hours as a performance accelerator; the persistent Sheets record is authoritative.
- Pressing **خروج** removes both the current browser cache entry and persistent session record immediately. No new sheet, column, database, owner account or credential is required.
- **Owner deployment action:** import the updated `relay/Code.gs` into the existing Apps Script project and deploy a new Web App version while preserving the existing `/exec` URL. No `setupSalonDatabase()` rerun is required for this session-only backend change. A still-valid six-hour session will be upgraded on its next authenticated request; if it already expired before redeployment, sign in once again.
- Automated session lifecycle coverage verifies persistence after cache expiry, rolling renewal, inactivity expiry and immediate logout revocation. Latest workflow verification is pending.

---
# Historical checkpoint — visual daily calendar (2026-11-05)

- Latest main commit at this checkpoint: `c7d6b93042d21bf54c3762ec644f6cb11a50cd0c`; the current implementation is on `main`.
- The owner panel has a new **تقویم روز** tab. It shows working windows as a 24-hour visual grid, active/history customer reservations, free slots and manager-created blocked windows. Dates are selected in the Jalali calendar.
- The old phone-booking form has been removed from the owner panel. For offline appointments, the manager taps a free slot, confirms, and the selected slot is blocked. The default duration equals one slot step (normally 15 minutes); longer presets are optional.
- This flow stores only date, start/end, duration and audit metadata in a separate `TimeBlocks` sheet. It does not ask for or store customer name, surname, phone or note, and it does not create a synthetic customer booking.
- The then-current Apps Script backend target was `1.3.0`. The new `TimeBlocks` tab is an additive schema migration: import updated `relay/Code.gs` and `relay/appsscript.json`, run `setupSalonDatabase()` once against the existing database, then deploy a new Web App version while keeping the same `/exec` URL.
- Server-side block creation/deletion uses the shared Apps Script lock, verifies opening windows and overlaps, and participates in public availability calculations. Therefore a manager block removes the same interval from customer online booking.
- Weekly opening hours now use responsive day cards, a 24-hour visual timeline, separate start/end fields for every interval, a clear open/closed toggle, add-range action and per-day save button.
- The UI and backend changes are committed. Latest green CI/Pages verification is still pending at the time of this note; do not claim the new browser test or live Apps Script v1.3.0 smoke passed until a successful run for the current main head is recorded.
- This checkpoint supersedes the earlier phone-booking-panel description below. Historical phone bookings already recorded in `Bookings` remain intact; only the new manual phone-booking UI was removed.
 
---

# Project State & Handoff

## Current checkpoint — Shayan responsive visual QA passed (2026-11-05)

- Current design checkpoint: the public site and owner workspace use the obsidian / antique-gold Liquid Glass system. The exact owner-supplied assets `public/images/shayan-hero.webp` and `public/images/shayan-emblem.webp` are wired into the hero, site brand, booking dialog, admin header, favicon and PWA icon.
- Footer repair: the Shayan emblem is compact (43px mobile / 46px desktop); the Pooya Labs mark is 18px mobile / 19px desktop; the credit wraps cleanly. The mobile site shell reserves 104px plus safe-area inset so the persistent booking bar cannot cover the footer.
- Android booking repair: `.booking-flow-backdrop` now sits above the persistent mobile booking bar (z-index 60 vs 30), so touch taps on the dialog's step controls are not intercepted.
- Mobile owner-header repair: brand/emblem and the account/logout actions use separate rows below 680px; the subtitle can wrap without colliding with the owner name.
- Legacy provisional identity remnants were removed from the booking review, customer booking-management dialog and hero booking banner. The banner uses a Shayan `S` monogram rather than the old `F.`.
- Visual QA coverage: Playwright Chromium on Windows and Linux; desktop widths 1280–1920px; responsive widths 320–1440px; Android-like Pixel 8 touch context (412×915, DPR 2.625, Android 15 user agent). Tests cover mobile nav taps, booking flow taps/form, footer overlap, owner dashboard, services, weekly schedule, phone booking and notifications.
- Latest full verification: CI run `42013839983` **success** and GitHub Pages deploy run `42013839990` **success**, both on commit `f0c6a84969369ea6247977ec8eeaffc5f76e11e3`. CI included both Linux and Windows visual jobs and all owner-dashboard desktop/mobile QA checks.
- Automated axe-core WCAG 2.2 AA checks passed for the public homepage, booking and customer-management dialogs, owner dashboard, service editor, schedule tab, phone-booking tab, notifications tab, cancellation confirmation and owner login page.
- This visual pass did not change booking logic, customer records, Apps Script, Google Sheets or Firebase service configuration. Apps Script remains untouched.
- Remaining visual acceptance: optional spot-check on a physical Android device; the current Android coverage is browser touch emulation rather than a physical handset. The next project phase can proceed after that optional check if desired.

> Update this file at every meaningful checkpoint. It is the first file to read when resuming after a chat/session interruption.

## Identity

- Product: Salon Booking
- Repository: https://github.com/pooya-labs/salon-booking
- Product owner: salon owner (friend of Pooya)
- Engineering / creator credit: **Pooya**
- Default branch: `main`
- Deployment target: GitHub Pages + Google Apps Script + private Google Sheets; Cloudflare Worker/D1 retained as legacy recovery only
- Current release: 0.7.0

## Latest migration verification (2026-11-04)

- Historical cutover commit: `85b88cf81425e984eaa7eda4e5b3e11226aad8a6` (privacy/backup operations updated for private Google Sheets). Subsequent main commits add service/schedule/phone-booking management and Firebase push notifications; the latest feature checkpoint is recorded below.
- Historical cutover CI passed: [run 41855195426](https://github.com/pooya-labs/salon-booking/actions/runs/41855195426). It covered lint, tests, build, browser QA and legacy migration checks. Do not treat that historical run as validation of the latest owner-management and push commits.
- The current CI and Pages workflows are triggered automatically from each new main commit; the latest run IDs and conclusions must be read from GitHub Actions before claiming deployment success.
- Updated privacy documentation to describe Google Sheets as the active data store and to remove obsolete D1 backup instructions from the current operating guide.
- Owner reports that the Apps Script Web App has now been deployed from their Google account and the `/exec` URL has been saved as the GitHub Actions repository variable `SALON_RELAY_URL` (2026-11-04). This is owner-side setup confirmation, not yet proof of a successful Pages rebuild or end-to-end API connectivity. Manager bootstrap, salon timezone/services/hours and real Iran-network booking/notification checks remain open.
- Cloudflare resources and any historical D1 rows are untouched. Do not delete or migrate them without the owner's explicit data-recovery decision.

## Current checkpoint — owner management and phone notifications (2026-11-04)

- Latest implementation checkpoint: `f4383637d8018e3077d487c814bdddb3c8eb92a7` (`fix: route push notification clicks to the Pages admin`).

- Main includes service category editing, multi-interval daily opening hours, split customer name fields and phone booking from the manager panel.
- Phone bookings are confirmed and share the online availability lock/store. Firebase Web Push is implemented but waits for the owner-side Firebase project configuration and redeployment of Apps Script.
- Email notifications are off by default and can be re-enabled from the notification settings panel.
- Latest code path includes the Pages-compatible `?admin=1` push-click destination, foreground notifications via ServiceWorkerRegistration, background FCM notifications without a duplicate custom background handler, and distinct email content for confirmed phone bookings.
- Required follow-up: update Apps Script source/manifest, rerun setup, redeploy the Web App, configure Firebase web client variables/VAPID in GitHub Actions and verify test push delivery.

## Current checkpoint — Google Apps Script cutover (2026-11-04)

- Phase: **R09 — Apps Script backend migration and owner-side deployment/configuration complete by owner confirmation; Pages rebuild and end-to-end acceptance are next**.
- Active architecture: GitHub Pages frontend → hidden Apps Script iframe bridge → Google Apps Script API → private Google Sheets.
- `relay/Code.gs` is the backend itself; it does not call the Cloudflare Worker or use D1.
- API routes preserve the frontend contract for availability, booking, customer lookup/cancellation, owner bootstrap/login, booking status, services and schedule management.
- Sheets tabs: Settings, Services, WeeklyHours, Exceptions, Bookings, PushSubscriptions, AdminUsers, AdminSessions and AuditLog.
- `LockService` protects the availability recheck and booking write. Idempotency hashes, customer management-token hashes and audit events are stored in Sheets.
- Firebase Web Push is sent to registered manager devices after owner-side Firebase configuration. Optional email alerts use MailApp but are disabled by default and can be enabled from the owner panel.
- `AdminSessions` persists hashed browser session IDs for rolling 30-day sessions; authenticated use renews expiry automatically and CacheService remains a six-hour accelerator.
- The Apps Script V8 implementation avoids unsupported browser/Node globals including `URLSearchParams`, `UrlFetchApp` and `crypto.subtle`.
- Deployment files: `relay/appsscript.json`, `relay/Bridge.html` and `docs/GITHUB-PAGES-RELAY.md`.
- **Completed by owner confirmation (2026-11-04):** created the Apps Script project, imported the source files, ran `setupSalonDatabase()` successfully, deployed the owner-executed anonymous Web App and added its `/exec` URL as the GitHub Actions repository variable `SALON_RELAY_URL`.
- **New owner-panel features committed:** service category/type can be edited and is shown publicly; daily hours can be split into editable intervals; online booking accepts first name, last name and phone; manager can enter confirmed phone bookings that block the selected time online under the shared script lock.
- **Notification architecture committed:** PWA manifest and Firebase service worker scaffold, manager device registration, Apps Script push sender and an email on/off preference. Email is disabled by default. Real push remains unverified until Firebase is configured and the Apps Script code is upgraded/deployed.
- **Required owner-side upgrade:** import latest `relay/Code.gs` and `relay/appsscript.json` into Apps Script, rerun `setupSalonDatabase()` for additive `category`, `source` and `PushSubscriptions` schema, reauthorize scopes and deploy a new Web App version. Configure Firebase public web config and VAPID via GitHub Actions variables.
- **Not yet verified:** successful latest Pages build, Apps Script schema/version upgrade, real phone/online booking conflict tests, Firebase push delivery on manager Android in background, and network acceptance.
- Old Worker/D1 infrastructure remains untouched until the new path passes acceptance. No D1-to-Sheets data transfer or Cloudflare deletion has been performed.

## Legacy Cloudflare deployment history
## Latest admin-session cleanup hardening (2026-11-04)

- `getAdminSession` previously deleted all expired session rows before checking whether the request supplied any session cookie. Any unauthenticated request to a protected admin endpoint could therefore cause a D1 write.
- Removed database cleanup from session validation. Missing and expired tokens now return unauthorized without mutating D1; expiration is enforced by the authenticated session lookup.
- Expired rows are pruned when a new session is issued (successful login/bootstrap), preserving cleanup without granting anonymous traffic a write path.
- Worker+D1 integration regression now seeds an expired session, verifies an anonymous admin request leaves it untouched, then performs a successful login and verifies session issuance prunes it.
- **Verified on `main` commit `4abb53e697de126510bb36905ba679d402d38138`:** [CI run 41768761253](https://github.com/pooya-labs/salon-booking/actions/runs/41768761253) and [Pages run 41768761332](https://github.com/pooya-labs/salon-booking/actions/runs/41768761332) both succeeded. CI passed lint, 37 unit tests, SQLite migration/privacy checks, TypeScript/build, Worker+D1 integration (anonymous probes do not delete expired sessions; successful login does), responsive RTL/keyboard/browser QA, axe-core WCAG 2.2 A/AA scans and owner-dashboard browser QA. Pages deployed the same commit successfully.

## Latest service-name snapshot implementation (2026-11-04)

- The owner booking list and customer self-service lookup previously read `services.name` live, so a catalog rename could rewrite the service label shown for an already-created booking.
- Migration `0010_booking_service_name_snapshot.sql` adds `bookings.service_name_snapshot` and backfills it from the current service catalog. A name changed before migration 0010 cannot be reconstructed; the migration-time catalog name is the best available value.
- New bookings store the service name at creation. Owner booking lists and customer lookup/cancellation now read the booking snapshot, independent of later catalog renames.
- SQLite migration regression verifies historical backfill and that a later service rename leaves the saved name unchanged. Worker+D1 integration regression renames the service and changes its duration after booking, then checks both owner and customer responses still show the original name and 30-minute duration.
- README, deployment, API, roadmap and this handoff now document migrations 0001–0010.
- **Verified on `main` commit `23ef5f4a31c7c896b3d1dd6f0c04430f5ce241f8`:** [CI run 41767923880](https://github.com/pooya-labs/salon-booking/actions/runs/41767923880) and [Pages run 41767923864](https://github.com/pooya-labs/salon-booking/actions/runs/41767923864) both succeeded. CI passed lint, all 37 unit tests, SQLite migration/backfill tests, TypeScript/build, local Worker+D1 integration (including the rename + duration snapshot regression), responsive RTL/keyboard/browser QA, axe-core WCAG 2.2 A/AA scans and owner-dashboard browser QA. Pages deployed the same commit successfully.

## Latest verified service-duration snapshot checkpoint (2026-11-03)

- Owner service edits previously changed the duration shown for old bookings because customer and owner reads joined the current `services.duration_minutes`, while the saved booking `ends_at` did not change.
- Migration `0009_booking_service_duration_snapshot.sql` adds `bookings.service_duration_minutes` and backfills existing rows from the current service catalog. Historical actual values cannot be reconstructed if the catalog was already edited; the current catalog value is the best available migration-time value.
- New bookings persist the service duration at creation. Owner booking lists and customer self-service read the saved booking snapshot, so later catalog-duration edits do not rewrite old reservation details.
- SQLite migration regression checks the backfill and that a later service edit leaves the snapshot unchanged.
- Worker+D1 integration regression books a 30-minute service, changes its catalog duration to 90 minutes, then requires customer lookup and the owner booking list to continue showing 30 minutes.
- API, deployment, README, roadmap and this handoff have been updated to reference migration 0009.
- **Verified:** [CI run 41673140817](https://github.com/pooya-labs/salon-booking/actions/runs/41673140817) passed lint, 37 unit tests, SQLite migration/backfill regression, TypeScript/build, local Worker+D1 integration (including customer and owner snapshot assertions, both DST transitions, scheduling caps, audit checks and local backup/restore), responsive RTL/keyboard/browser QA, axe-core WCAG 2.2 AA scans and owner-dashboard QA. [Pages run 41673140699](https://github.com/pooya-labs/salon-booking/actions/runs/41673140699) deployed the same code head successfully.

## Latest high-volume scheduling safety checkpoint (2026-11-03)

- Removed fixed 200-row and 2,000-row caps from booking-versus-schedule conflict scans. Owner changes can no longer silently ignore future appointments beyond the former result windows.
- Removed the 200-row cap from the owner booking list and removed the 180-exception / 1,440-interval caps from owner schedule reads.
- The Worker+D1 integration regression now covers all four former caps: 202 synthetic bookings for the old owner-list truncation; 2,003 target-weekday records with 202 other-weekday fixtures occupying the same scan window, placing the only out-of-hours appointment after row 2,000; and 181 saved exceptions containing 1,448 intervals.
- Implementation commit: `bfdbcd9dadec121401e2e777abe57d5f0320a0d4`; initial regression: `69131a8f9ca30e80163597712ea1588761feff90`; expanded cap coverage: `4cc5b8ee05dd1a0c54e930e025137de9791ee4dd`.
- CI initially exposed a fixture-only database constraint violation because synthetic open exceptions had null legacy times. Fixed by populating a valid legacy interval in [commit 0424d8c](https://github.com/pooya-labs/salon-booking/commit/0424d8c0d229c68cd6375cea68f3cd32a22b2af5); no production schema or application logic change was required for this correction.
- **Verified:** [CI run 41668286672](https://github.com/pooya-labs/salon-booking/actions/runs/41668286672) succeeded on commit `0424d8c0d229c68cd6375cea68f3cd32a22b2af5`: ESLint, 37 unit tests, SQLite migration/privacy/constraint checks, TypeScript + production build, local Wrangler Worker+D1 integration (public and owner lifecycle, all high-volume query regressions, audit assertions and local D1 export/restore), responsive RTL/keyboard/browser QA, automated axe-core WCAG 2.2 AA scans, and owner dashboard browser QA.
- **Verified:** [GitHub Pages deployment run 41668286869](https://github.com/pooya-labs/salon-booking/actions/runs/41668286869) succeeded for the same commit. Preview remains static and demo-only.
- Remaining boundary: CI verifies isolated local Wrangler D1 only, not remote Cloudflare D1 or production. Manual screen-reader/physical-device acceptance and owner/production launch gates remain open.
- Status: Core public booking, customer self-service, owner workspace, multi-interval scheduling, rate limits, idempotent booking replay and local D1 backup/restore smoke coverage are implemented. Production is not deployed.
- Latest verified owner-dashboard commit on `main`: `2178056a13e4f06298a63392c5d56a032b30be69` — explicit confirmation for cancellation, completion and no-show transitions, with dedicated browser assertions.
- Latest audit-test commit: `269d6667fcfec33b5e07037d882d5e5c49cdc288` — the local Worker+D1 integration test reads back and verifies all seven owner audit event types.
- Date-range navigation and UTC date arithmetic are implemented in `a1f4cf12dfc868bcdc85578268204d71f251fef7`, corrected and verified in `caf88e932edce0f9176ee2078cdc0a2b365a8c59`, and browser-covered in the owner workspace.
- Latest CI: [run 41673140817](https://github.com/pooya-labs/salon-booking/actions/runs/41673140817) — success on current code head: ESLint, 37 unit tests, SQLite migration/privacy/idempotency/local-config/CSP plus migration 0009 snapshot/backfill checks, TypeScript/build, Worker+D1 integration including snapshot, DST and high-volume schedule regressions, static-preview Chromium + axe WCAG 2.2 AA QA and production-mode owner dashboard + axe QA.
- Latest GitHub Pages deployment: [run 41673140699](https://github.com/pooya-labs/salon-booking/actions/runs/41673140699) — success for current code head. Preview: https://pooya-labs.github.io/salon-booking/ — static demo only; never enter real customer data.
- Static-preview browser QA passed viewport widths 320–1440 px, mobile navigation, full sample booking journey, both dialog focus/keyboard flows, Jalali/Persian dates and local-day boundaries in Tehran/Berlin/Los Angeles, and the demo-only admin gate.
- Owner dashboard browser QA passed next/previous/reset seven-day navigation, preservation of the selected date range when status filters change, confirmation of cancellation/completion/no-show, no mutation when confirmation is cancelled, and responsive widths 360, 390, 768, 1024 and 1440 px.
- The D1 audit readback test verified booking status change, service create/update, salon settings update, weekly-hours update, and schedule-exception create/delete.
- Latest static asset sizes: JavaScript 227,379 bytes; CSS 51,515 bytes. Both remain below CI budgets. Browser runtime/network checks found no uncaught exceptions, console errors, failed requests, HTTP errors or third-party requests.
- Automated browser results represent Chromium viewport emulation, not physical iOS/Android devices or a real screen-reader certification. The local DCL measurement is not a production-network performance benchmark.
- The local Wrangler D1 export/restore smoke test passes using synthetic data and an isolated temporary database. Production D1 backup/restore is not verified.
- Production D1 is not provisioned; migrations 0001–0010 have not been applied remotely; salon timezone remains `unset`; real services, prices, hours and contact details are not configured.
- Worker is not deployed to Cloudflare; production secrets are not configured; no real customer data has been processed.
- Next engineering work: complete the full security/threat-model review, strengthen the operational rollback/runbook, and close remaining technical release gates. Cloudflare production provisioning and salon-owner approval remain external launch prerequisites.
- Production launch remains blocked on salon-owner decisions (business identity, location/timezone, service menu, schedule, cancellation policy, privacy contact/retention approval) and Cloudflare account/D1/secrets provisioning.
- Do not enable real bookings or claim production readiness until all release gates and owner acceptance are complete.

## Latest automated accessibility and contrast checkpoint (2026-11-03)

- Added automated `axe-core` scans tagged for WCAG 2.0/2.1/2.2 A and AA across the public homepage, booking dialog, customer booking-management dialog, owner dashboard, service editor, schedule-management tab, owner cancellation confirmation and owner login page.
- Added a keyboard-focus dual ring and a reduced-motion browser assertion; decorative booking-banner lettering is explicitly hidden from assistive technology.
- Contrast refinements were committed through `f3bfc847d83e2233e241d104d6c2b1c8a6f236a4` (current inspected `main` head), including public copy, owner controls/statuses, muted/success states and the decorative banner mark.
- Related test/implementation commits: `00f7e0de4d814d50bcbd1dc4b7e532626a8d84c6`, `fad4fcec857838ddd4572c3a7a94a2d8d842c1f9`, `f1667c3071aac7d6d3965624d258a6ed9cb42bd5`, `02151a89d9b3f9220a5e3fe7a194e797bf6a0e84`, `4519370d96d79d73cf3cdc171b97562f16fa821e`, and `087a01ad6d6ee41c1493fa72f1124616d36c189d`.
- The last confirmed green full CI remains [run 41654596006](https://github.com/pooya-labs/salon-booking/actions/runs/41654596006), which predates the axe scans and contrast-refinement commits. The connected GitHub tools did not expose workflow-run/check results for the current head; do not claim these new scans passed until a green run for the current `main` head is confirmed.
- A green automated scan will still not replace a real screen-reader/assistive-technology audit or physical iOS/Android acceptance.

- Do not enable real bookings or claim production readiness until all release gates and owner acceptance are complete.

## Latest accessibility checkpoint (2026-11-03)

- Added `src/useDialogAccessibility.ts` and applied it to the public booking wizard and customer booking-management dialog.
- Both dialogs now move focus inside on open, contain Tab/Shift+Tab navigation, close on Escape, lock background body scrolling and restore the previously focused element on close.
- Dialog sections are programmatically focusable as a safe fallback; accessible dialog names remain connected to their visible headings.
- Implementation commits: `0bcde6bfa69300efa7f95496d4b868f990a9bba2`, `2e316f55b44068a29e12413b10d379f51d4f07d1`, and `4c22831e27b518d1d1c3e55b31bea9c6bc23e067`.
- Final verification on commit `9a0b2105c361253d6b34f437392c2c0870cb1435`: [CI run 41638704919](https://github.com/pooya-labs/salon-booking/actions/runs/41638704919) and [Pages run 41638704945](https://github.com/pooya-labs/salon-booking/actions/runs/41638704945) both succeeded.
- This is an implementation checkpoint, not a completed manual screen-reader audit. Test with keyboard-only navigation and at least one screen reader before marking R07 complete.

## Latest booking submission protection checkpoint (2026-11-03)

- The booking wizard now uses a synchronous React ref lock before sending `POST /api/public/bookings`, preventing rapid repeated click handlers from issuing overlapping requests.
- The visible pending state continues to disable the submit control; the ref lock closes the gap before React has rendered the disabled state.
- Corrected the request-side phone normalization expression so it uses the same whitespace, parenthesis and hyphen removal as the validation step.
- Implementation commit: `79a457fbdcf70038e891943866583ca7cfbe474e`.
- Follow-up focus-trap correction: `3c513c688a16b2e6c16498bd75d3a461f7acb113` now returns forward Tab and reverse Shift+Tab to the appropriate dialog boundary when focus is found outside the modal.
- SQLite overlap triggers remain the final protection against conflicting active reservations.
- The client-side synchronous submission lock prevents rapid duplicate clicks; server-side request replay is now implemented in the later migration 0008 checkpoint below.

## Latest server-side booking idempotency checkpoint (2026-11-03)

- Added migration `0008_booking_idempotency.sql`. Each booking's idempotency row is linked by foreign key and is deleted automatically when its booking is erased.
- `POST /api/public/bookings` now requires an `Idempotency-Key` header containing 64 hexadecimal characters (256 random bits).
- The browser creates one key for a normalized booking payload, reuses it after an uncertain network outcome, and generates a new one when the payload changes.
- The idempotency ledger stores only domain-separated SHA-256 digests and a non-sensitive response snapshot; it does not duplicate the raw key or request body. The ordinary bookings table continues to hold the client details needed to manage appointments.
- The customer-management token is deterministically derived from the same 256-bit key with domain separation; only the token's SHA-256 digest is stored on the booking.
- The booking insert and idempotency ledger insert are committed together through a D1 batch. Replaying the same key and payload returns HTTP 200 with the original reference/token; changing the payload while reusing the key returns HTTP 409 `idempotency_key_reused`.
- Added unit coverage for key entropy/format and deterministic management-token derivation; SQLite checks for key uniqueness and erasure cascade; Worker integration coverage for replay, mismatched payload, missing key, distinct-key slot conflicts and concurrent same-key delivery.
- Implementation commits include migration `a2f208c`, Worker `df891ec` / `a66dde0` / `33dcc56`, frontend `7977b61` / `6b68de5`, unit/migration/integration tests and API/deployment docs.
- Final verified code commit: `e56572c2f2e6eb4b4597e7f1b76f9604718e0276`; final test/docs commit: `1a9de63d73f53f0d5751fbd78ca86c53d5b33552`.
- CI [run 41642724742](https://github.com/pooya-labs/salon-booking/actions/runs/41642724742) and Pages [run 41642724715](https://github.com/pooya-labs/salon-booking/actions/runs/41642724715) both passed.

## Latest owner mutation safety and audit checkpoint (2026-11-03)

- Added an inline, accessible confirmation group before terminal owner booking transitions: cancellation, mark completed and no-show. Confirming sends the existing authenticated status API mutation; cancelling closes the prompt without sending a request.
- The production-mode Chromium owner-dashboard test verifies the prompt appears for all three transitions, canceling the prompt sends no mutation, and confirming each transition submits the correct status.
- Expanded local Worker+D1 integration tests to read the actual `admin_audit_log` table after owner operations and require all seven events: `booking.status_changed`, `service.created`, `service.updated`, `salon.settings_updated`, `schedule.weekday_updated`, `schedule.exception_saved`, and `schedule.exception_deleted`.
- Verification: [CI run 41654596006](https://github.com/pooya-labs/salon-booking/actions/runs/41654596006) passed all 37 unit tests, lint, migration checks, TypeScript/build, Worker+D1 lifecycle and audit assertions, static preview browser tests and production owner dashboard browser tests. [Pages run 41654596064](https://github.com/pooya-labs/salon-booking/actions/runs/41654596064) succeeded.
- This closes the R05 owner mutation audit/confirmation checklist item. It does not replace an owner acceptance run against a provisioned production database.

## Latest owner dashboard date-range checkpoint (2026-11-03)

- Added `src/date-range.ts` with strict ISO calendar-date validation and UTC day arithmetic, avoiding browser-local timezone drift and correctly handling month, year and leap-day boundaries.
- The owner dashboard now shows the current seven-day range in Persian/Jalali formatting and supports previous week, next week and reset to the default upcoming seven days.
- The selected date range is sent to `GET /api/admin/bookings`; the current status filter is preserved when navigating and the range is preserved when changing status.
- The stale dashboard note about service/schedule management being a future feature was corrected; those controls already exist in the owner management section.
- Added unit tests for month/year boundaries, backward navigation, leap days, invalid dates, unsafe offsets and zero-day shifts.
- Expanded Worker+D1 integration coverage to assert date-range echo and reject a range beyond the API's 31-day difference limit.
- Added a dedicated production-mode Playwright test, `tests/admin-browser-smoke.mjs`, with mocked admin APIs. It exercises next/previous/reset, status-filter preservation, localized range output, and responsive viewports at 360, 390, 768, 1024 and 1440 px.
- The Playwright run is separate from the public Pages demo QA, so the actual production-mode admin React application is exercised without using real owner credentials or customer records.
- Verification: [CI run 41652792502](https://github.com/pooya-labs/salon-booking/actions/runs/41652792502) passed all 37 unit tests, lint, migration tests, build, Worker+D1 integration, public preview browser QA and owner dashboard browser QA. [Pages run 41652792763](https://github.com/pooya-labs/salon-booking/actions/runs/41652792763) succeeded.
- Feature commits: `a1f4cf12dfc868bcdc85578268204d71f251fef7` (range navigation), `b4c4a230ac7c561f55304765590432c76d9bf74d` (UTC date arithmetic and date tests), `caf88e932edce0f9176ee2078cdc0a2b365a8c59` (date parser correction), and `763341ed44f645c33379990804ce851fc804b198` (owner browser test and current dashboard copy).
- Remaining: full month/calendar picker is not implemented; the owner can move through weeks. Production D1/Worker is still not provisioned, so no real-data dashboard acceptance has been performed.

## Latest lint and local-development checkpoint (2026-11-03)

- Added ESLint 10 flat config, `typescript-eslint` and React Hooks rules; `npm run lint` runs against the React application, Worker and Vite config. CI runs lint before tests and build.
- Added a separate `wrangler.dev.toml.example` with a local-only D1 UUID and `.dev.vars.example` for two distinct local secrets. The actual `wrangler.dev.toml` and `.dev.vars` are gitignored.
- `npm run db:local` explicitly applies migrations with `--local` and the local config; `npm run dev:worker` starts Wrangler with that same local config. The production `wrangler.toml` placeholder and production deploy command remain separate.
- README and deployment guide now describe Vite-only preview vs Worker+D1 local development, local secrets generation, migrations and safe use.
- Added four automated local-environment regression tests for config separation, script safety, ignored local files and secret example presence.
- Verification: [CI run 41649150974](https://github.com/pooya-labs/salon-booking/actions/runs/41649150974) passed lint, 34 unit tests, SQLite checks, TypeScript/Vite build, local Worker+D1 integration, and Chromium browser QA. [Pages run 41649150617](https://github.com/pooya-labs/salon-booking/actions/runs/41649150617) succeeded.
- Current browser asset sizes: JavaScript 224,547 bytes; CSS 49,609 bytes. All configured asset budgets and browser runtime/network checks passed.
- This closes the R00 lint/local-environment item. It does not configure a production Cloudflare account or provision remote D1.

## Latest security review and operational runbook checkpoint (2026-11-03)

- Narrowed HTML CSP: scripts and network connections are same-origin; images/fonts are same-origin or data URLs; arbitrary external HTTPS resources and `unsafe-eval` are not permitted. Inline styles remain allowed for the current frontend.
- Expanded Worker+D1 integration assertions for all relevant CSP directives; full CI run 41647018808 passed after the policy change.
- Added `docs/SECURITY-THREAT-MODEL.md` with assets, trust boundaries, code-level controls, threats, residual risks and explicit pre-launch gates. This is an internal code review, not an external penetration test or production certification.
- Expanded `docs/DEPLOYMENT.md` with pre-release D1 export, migration/release notes, Worker version rollback, post-rollback smoke checks, and the separation between application rollback and destructive D1 recovery.
- Cloudflare documentation confirms Worker rollback creates a new active deployment and does not roll back connected resources; D1 schema/data compatibility must be checked independently.
- Production D1/Worker are not provisioned, so no real deployment, remote migration, production rollback or production restore has been attempted.

## Latest autonomous frontend QA checkpoint (2026-11-03)

- Consolidated phone normalization into `src/phone.ts`. Both form validation and the booking request payload now normalize Persian/Arabic digits and common formatting identically; this fixes the earlier malformed request-side whitespace regex.
- Added unit coverage for Persian/Arabic digits, whitespace/parentheses/hyphens, international plus prefixes and unsupported punctuation.
- Added Playwright/Chromium browser smoke coverage in `tests/browser-smoke.mjs` and the `test:browser` npm script. CI installs pinned Playwright tooling and Chromium on `ubuntu-24.04` so the browser runner does not inherit the unsupported Ubuntu 26.04 image.
- Automated responsive viewport matrix passed at 320, 360, 390, 430, 768, 1024, 1280 and 1440 px. These are Chromium-emulated viewports, not physical devices.
- Both the public booking dialog and customer-management dialog passed accessible-name, initial-focus, Tab/Shift+Tab containment, Escape close and focus-restoration checks. Booking dialog also passed background scroll-lock verification.
- The four-step demo booking journey passed with Persian-digit phone input and normalized review output. Jalali/Persian date labels and visitor-local first-day boundaries passed in Asia/Tehran, Europe/Berlin and America/Los_Angeles.
- The static Pages admin route remained demo-only (no password field); runtime checks found zero uncaught exceptions, console errors, failed requests, HTTP errors, production API calls or third-party requests.
- Asset budgets passed: JavaScript 224,547 bytes and CSS 49,586 bytes, under the CI limits of 1 MiB and 256 KiB. The 18 ms DCL figure is from a loopback test server and is not used as a real-world performance claim.
- Verification: 30 unit tests, SQLite migration/privacy checks, typecheck/build, local Worker+D1 integration, and Chromium QA all passed in [CI run 41646215390](https://github.com/pooya-labs/salon-booking/actions/runs/41646215390). The demo was published by [Pages run 41646215349](https://github.com/pooya-labs/salon-booking/actions/runs/41646215349).
- Code/test commits: `628b570ee9f635387fad5fd65327991e5d83bb3e` (phone fix + browser harness), `e73f3cf2e8e6cb74f030303798dccf3e65270f68` (Ubuntu 24.04 runner), `6aadd7550f13e5208acdc0775cf324ad25466688` (timezone test sequence), and `25a11aa3b613243cd03e067edffa806a3c0eb11f` (both dialogs' keyboard QA).
- Remaining: real screen-reader/assistive-technology and physical-device acceptance, salon-owner acceptance, full security/threat-model review, production Cloudflare/D1 verification and production backup/restore. These are not marked complete by the automated browser run.

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
| 2026-11-03 | Owner mutation confirmation | Cancellation, completion and no-show require explicit confirmation; browser QA verifies no API mutation when the prompt is cancelled. |
| 2026-11-03 | Owner audit trail readback | Local D1 integration test verified all seven owner audit event types, including booking, service, salon settings and schedule changes; CI run 41654596006 passed. |
| 2026-11-03 | Owner dashboard seven-day range navigation | Previous/next/reset, filter preservation and responsive UI passed production-mode Chromium QA in CI run 41652792502. |
| 2026-11-03 | Calendar date arithmetic | 37 unit tests passed, including strict ISO parsing, month/year boundaries, leap days and invalid offsets; Worker+D1 rejects ranges beyond the 31-day difference limit. |
| 2026-11-03 | Lint and local development environment | ESLint passed, four local-config guard tests passed, and CI run 41649150974 completed the full suite successfully. |
| 2026-11-03 | Local config separation | The local Worker/D1 example, local-only secrets and gitignore rules passed automated regression checks; production Wrangler config remains unchanged. |
| 2026-11-03 | CSP hardening | HTML CSP now limits scripts/connections to self and images/fonts to self/data; CI integration assertions passed in run 41647018808. |
| 2026-11-03 | Security and rollback documentation | Added internal threat model/residual-risk register and documented version rollback plus separate D1 recovery process. |
| 2026-11-03 | Phone normalization regression | Shared Persian/Arabic digit and punctuation normalization used by both validation and booking payload; 4 focused unit cases added. |
| 2026-11-03 | Autonomous browser QA | 30 unit tests, SQLite migration tests, production build, local Worker+D1 integration and Chromium QA all passed in CI run 41646215390. |
| 2026-11-03 | Responsive/RTL/accessibility browser matrix | 8 viewport widths, full demo booking, Tehran/Berlin/Los Angeles Jalali date checks, both dialogs' keyboard/focus flows and clean browser console/network passed. |
| 2026-11-03 | Pages publish after QA | GitHub Pages run 41646215349 succeeded; preview remains static/demo-only. |
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
- [x] Production D1 `salon-booking` is provisioned and its ID is configured in `wrangler.toml`; jurisdiction is `none`. Salon country is Iran; `local_timezone` remains `unset` until the owner confirms the salon city/location.
- [ ] Apply remote migrations 0001–0010, configure Worker secrets, connect GitHub to Cloudflare Workers Builds, deploy and run production smoke tests.

## Next actions

1. Confirm the salon owner's cancellation notice period and publish the customer-facing policy.
2. Complete data-retention, export/deletion, backup, security-header, accessibility and threat-model reviews.
3. Apply migrations 0001–0010 to the provisioned production D1 database.
4. Add SESSION_SECRET and ADMIN_BOOTSTRAP_TOKEN as Worker secrets; connect Workers Builds, deploy and bootstrap the first owner.
5. Confirm salon timezone, services, prices, hours and booking horizon; then perform owner/admin API tests and a production smoke test.
6. Never enable real booking on Pages; production booking belongs on Cloudflare.

## Latest Worker + D1 integration checkpoint (2026-11-03)

- Added `tests/worker-integration.mjs` and `npm run test:worker`; CI runs it after the production build.
- The harness creates a temporary Wrangler config with a syntactically valid local-only D1 identifier and stores D1 state in an isolated OS temp directory. It applies migrations 0001–0010 locally, seeds one synthetic service and one synthetic working day, then launches the actual Worker with a test-only SESSION_SECRET.
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

## Latest schedule API integration checkpoint (2026-11-03)

- Extended the Worker + local D1 HTTP harness to cover authenticated salon settings and schedule APIs.
- Verified changing the salon timezone is blocked while a future active booking exists; valid settings persist and are returned correctly.
- Verified an owner can save two non-overlapping weekly intervals around a break while an existing appointment remains inside working hours; overlapping intervals return HTTP 400.
- Verified public availability respects the split schedule: an afternoon slot is available and the break start is not.
- Verified date-specific split exception creation, owner schedule readback and deletion.
- CI run 41630262938 passed all unit, SQLite migration, typecheck/build and local Worker/D1 integration steps.
- Pages run 41630262994 passed. Both correspond to implementation/test commit `0762f1ada30fce6833e730c76d3ce07b9e2d50fa`.
- Remaining test gap: API authorization/lifecycle around admin schedule exception conflicts with bookings, audit-log assertions and broader malformed-input paths; remote Cloudflare D1 and production smoke testing remain owner/launch gates.

## Latest Worker response security checkpoint (2026-11-03)

- Worker responses now pass through a shared security-header layer, including static HTML only on explicitly routed document paths and all API responses.
- HTML responses receive a restrictive CSP (`default-src 'self'`, same-origin scripts/connects, constrained styles/images/fonts, no objects, same-origin forms and no framing). JSON responses receive `default-src 'none'`, `base-uri 'none'` and `frame-ancestors 'none'`.
- Baseline headers include `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, a restrictive `Permissions-Policy`, `Cross-Origin-Resource-Policy: same-origin` and `Cross-Origin-Opener-Policy: same-origin`. HSTS is added only on HTTPS.
- Wrangler Static Assets uses selective `run_worker_first` patterns for `/api/*`, `/`, `/admin` and `/admin/`. Hashed JS/CSS/image assets continue to be served directly without routing every static request through the Worker.
- Integration tests verify security headers on JSON API, public home page and admin entry page. Both CI run 41631396406 and Pages run 41631396317 passed for code/test commit `3def87ec813a8fe5c5813fff5b99c104926e2d2a`.
- The CSP is a baseline and still needs a full review against any future external analytics, fonts, image hosts or embedded widgets before those are introduced. GitHub Pages preview does not run the production Worker middleware.
- Browser security headers now have a baseline implementation; production security review, mobile/accessibility QA and remote Cloudflare deployment remain incomplete.

## Latest privacy operations and expiry cleanup checkpoint (2026-11-03)

- Added `docs/PRIVACY-OPERATIONS.md` with data inventory, minimization controls, subject export query, private D1 backup/export steps, retention preview, controlled deletion procedure, cascade behavior and incident/access hygiene.
- No retention duration is invented and no automatic booking purge is implemented. Salon jurisdiction, published privacy contact, retention periods and backup expiry remain owner/legal decisions before launch.
- `worker/admin-api.ts` now prunes expired `admin_sessions` while validating an authenticated session and prunes expired `admin_rate_limits` on each admin rate-limit check. Admin rate limiting now fails closed if the trusted Cloudflare client-IP header is absent or oversized instead of grouping clients under an `unknown` bucket.
- The integration harness seeds expired synthetic admin session/rate-limit rows and asserts that the Worker removes them on session/rate-limit activity.
- SQLite migration checks verify that booking status history has no direct client identity/contact columns, that its foreign key cascades on booking deletion, and that the sample audit detail contains no client name/phone/note.
- CI run 41633719836 passed: 25/25 unit tests, privacy-focused migration regression, TypeScript/Vite build and local Wrangler Worker+D1 HTTP integration. Pages run 41633720066 succeeded.
- Implementation commit: `bf00678eaabe20d7a2696340bc9dd4fb3fd1f641`.
- Production D1 remains unprovisioned; no real customer data has been processed, no remote export/restore has been exercised, and no production deletion has been attempted.

## Latest local D1 backup/restore smoke-test checkpoint (2026-11-03)

- Extended `tests/worker-integration.mjs` to run Wrangler's local D1 SQL export, then restore the export into a separate temporary local D1 persistence directory.
- The harness uses a temporary Wrangler config in the OS temporary directory so `d1 export --local` reads its own isolated `.wrangler/state`; the existing user/repository local Wrangler state is not used or modified.
- After restore, a verification query confirms both the synthetic owner account and the synthetic cancelled booking exist in the restored database.
- CI run 41635952879 passed, including 25/25 unit tests, SQLite privacy/migration checks, TypeScript/Vite build, Worker+D1 HTTP tests, expiry pruning and D1 export/restore smoke test.
- Pages run 41635952873 passed. Current implementation/test commit: `93a07726469ecf98b1f6510b7b42c3ec6e8d057a`.
- This verifies local Wrangler export/restore only. It does not replace an encrypted production D1 backup, remote export, isolated production restore drill, or owner-approved backup expiry policy.

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
- D1 must apply migrations 0001–0010; bookings created before migration 0007 do not have a self-service token.


## Latest verification refinement (2026-11-03)

- Test harness now imports the isolated customer-booking security helpers rather than trying to import the Cloudflare Worker entry in Node; this avoids Node ESM resolution differences while exercising the exact helpers used by the Worker.
- Added coverage for booking reference validation, correct/wrong/missing one-time token verification, 256-bit token hashing, cancellation eligibility (status + appointment start time), and same-origin enforcement.
- Latest verified code commit: `456f943485eb459b780703f0d10d968eee402433`.
- Latest CI: run 41624696511 — success (25 unit tests; migrations/status-history/rate-limit tests; TypeScript and Vite build).
- Latest Pages deployment: run 41624696397 — success.
- The customer endpoints are implemented but not yet tested against a provisioned remote Cloudflare D1 database. This remains a release-quality task.


## Latest production D1 provisioning checkpoint (2026-11-04)

- Repository owner confirmed that the Cloudflare account and production D1 database `salon-booking` have been created.
- The production D1 database ID is now configured in the root `wrangler.toml`; binding remains `DB` and migration directory remains `migrations`.
- Data jurisdiction was selected as `none`; the owner-provided salon country is Iran. No city/address or business hours have been supplied, so `local_timezone` intentionally remains `unset`.
- All ten production migrations (0001–0010) were applied in order on 2026-11-04 and verified by reading `d1_migrations`, SQLite schema objects, overlap triggers, booking snapshot columns and initial salon settings. The database contains no real services, opening hours, bookings or owner records.
- The local Worker integration harness continues to replace the production database ID with a reserved local-only UUID and runs every D1 operation with `--local`. The production-config regression now checks for a valid non-local UUID instead of expecting the setup placeholder.
- Cloudflare account identity and D1 resources are confirmed through the connected Cloudflare integration. Remote migrations are complete. Workers Builds Git integration, the dedicated `salon-booking` Worker, production secrets and deployment have not yet been configured. An unrelated pre-existing Quick Editor Worker named `withered-shape-ebc0` was observed and deliberately left untouched.
- GitHub Pages remains a static, demo-only preview. Do not enter real customer bookings until the production Worker is deployed, configured and smoke-tested.


## Latest production D1 migration checkpoint (2026-11-04)

- Production database `salon-booking` (ID `646e31ad-82c9-45bf-8afc-ed6e6b81e025`) was authenticated and verified through the Cloudflare API under the connected account.
- Applied every repository migration, `0001_initial_schema.sql` through `0010_booking_service_name_snapshot.sql`, in the exact Wrangler order. Each migration was followed by the standard Wrangler `d1_migrations` tracking insert.
- Verification: ten ordered rows in `d1_migrations`; 15 application tables plus Cloudflare's internal metadata tables; all expected indexes and seven scheduling/status triggers; booking snapshot and customer-management columns; five default settings including `local_timezone='unset'`.
- The initial D1 metadata reported no jurisdiction restriction and primary region `EEUR`; D1 query metadata also showed serving colo `FRA`. This is an observed placement, not a jurisdictional residency guarantee.
- No service catalog, opening hours, owner credentials, bookings or customer data were inserted. Keep real bookings disabled until the dedicated Worker, secrets, salon schedule/timezone and production smoke checks are complete.
- GitHub `main` CI and Pages both passed on commit `0b3e90472233a3005a096218583c29a28f1c4f8c`: CI run 41771031361; Pages run 41771031187.


## Workers Builds GitHub authorization blocker (2026-11-04)

- The connected Cloudflare API identity and account can read/manage D1 successfully.
- A direct Workers Builds repository connection request for GitHub repository `pooya-labs/salon-booking` was rejected with Cloudflare error `8000008`: the project is disconnected from its Git account.
- Cloudflare's documented prerequisite is to install/authorize the official **Cloudflare Workers & Pages** GitHub App for the GitHub account/organization and grant access to this repository.
- The owner must complete that one-time GitHub authorization. Do not grant access to unrelated repositories unnecessarily; prefer selecting only `salon-booking`.
- A pre-existing Worker `withered-shape-ebc0` was found in the account. It is unrelated to this project and must not be reused, edited, or deleted.


## Latest production Worker deployment checkpoint (2026-11-04)

- GitHub App authorization and the Cloudflare Workers Builds repository connection are complete for `pooya-labs/salon-booking`, branch `main`.
- Dedicated Worker `salon-booking` was created; unrelated Worker `withered-shape-ebc0` was not touched.
- First Workers Build `c4727bbc-5dc5-4a65-9e67-209f629b483b` completed successfully. It ran `npm run build` (TypeScript + Vite), uploaded three static assets and deployed with `npx wrangler deploy`.
- Deployed Worker URL: https://salon-booking.pooyagame141.workers.dev
- First deployment version ID: `5c1fdd11-9c57-4e49-ad57-f357fe8c6b68`; deployed on 2026-11-04 from `main` at pre-hardening commit `ab0063e38ccec12ecc4607b50dccc2c69353ba51`.
- Latest deployment after the `preview_urls = false` hardening landed on commit `c20dd50c6e2ccf0a22953023e7d0e5cafae67b7b`: Workers Build `7c2e7d60-9b18-4b23-85f1-5ffc6e48a958` succeeded and deployed Worker version `c8b8987e-8f0b-4731-b8a2-de4dc9c23995`.
- Cloudflare logs confirmed the `DB` binding points to production D1 `salon-booking` and static assets are attached.
- Production `SESSION_SECRET` is present in Worker secret storage. No secret values are recorded in Git or this handoff.
- `ADMIN_BOOTSTRAP_TOKEN` is intentionally not stored yet. The owner must generate it privately, add it as a Worker Secret, open `/admin`, create the first username/password, then remove the token.
- Worker subdomain remains enabled; version Preview URLs are disabled. Workers Builds branch Previews are disabled until a separate staging D1 exists. `wrangler.toml` now explicitly sets `preview_urls = false`.
- Production D1 remains empty of services, working hours, admin accounts, bookings and customer records. `local_timezone='unset'`; real booking acceptance must remain closed until the owner provides the actual salon timezone, services/prices, opening hours and policies.
- A live HTTP smoke test could not be independently issued from the connected execution environment; the successful Cloudflare build/deploy logs are verified, but public endpoint responses and rollback/restore drills remain unverified.
- GitHub Pages remains a static demo-only UI; it is not the production booking endpoint.



## Latest production page-loading diagnostic (2026-11-04)

- Reproduced the deployed homepage using Cloudflare Browser Rendering after deployment. The root URL returned HTTP 200, the React application mounted, and the complete homepage DOM rendered (hero, navigation, service section, FAQ, footer); the page did not remain in a loading state in this independent browser session.
- Public endpoint smoke results: `GET /api/health` returned 200 (`salon-booking-api` v0.6.0); `GET /api/public/config` returned 200 with `configured=false` and `timezone=null`; `GET /api/public/services` returned 200 with an empty services array; `GET /admin` returned the expected setup-blocked page until the one-time owner bootstrap secret is configured.
- Invocation telemetry captured `/api/public/config` and `/api/public/services` returning 200 in 8–10 ms, with no Worker runtime errors. `/api/admin/me` returned the expected 401 for an unauthenticated browser; `/api/admin/setup-status` returned 200. A request for `/favicon.ico` returned 404, which does not block page rendering.
- Temporarily enabled Worker invocation logging and query-string redaction in `wrangler.toml` for launch diagnostics. Remove persistent invocation logs after the user's browser issue is resolved if extended operational logging is not desired.
- This confirms the deployed service responds correctly from Cloudflare's browser environment; it does not establish that the owner's specific browser/network path is healthy. If the user still sees a spinner, request a hard refresh / InPrivate retest and a screenshot or the exact browser error.
- Production remains intentionally non-bookable: no services or opening hours are populated, and `local_timezone='unset'`. The first owner account is not yet bootstrapped.



## GitHub Pages relay implementation checkpoint (2026-11-04)

- The Pages frontend now has an optional API transport bridge. When `VITE_SALON_RELAY_URL` is supplied at build time, all same-origin `/api/*` fetches are forwarded through a hidden Apps Script iframe; non-API assets remain served by GitHub Pages.
- Added Google Apps Script server-side forwarding to the existing Cloudflare Worker. The Worker URL is fixed in the relay source; the relay does not expose a generic arbitrary-URL proxy.
- Admin Worker session cookies are retained server-side in Apps Script CacheService, keyed by a random browser relay session ID. The browser does not receive the Worker cookie. Cache TTL is six hours.
- Public rate limiting now uses the relay's per-browser identifier when supplied, avoiding a shared Google egress IP causing unrelated customers to throttle one another.
- GitHub Pages deployment reads the public Actions variable `SALON_RELAY_URL`. If it is unset, the build remains demo-only and does not submit customer data.
- Added `docs/GITHUB-PAGES-RELAY.md` with exact owner setup and deployment steps.
- **Owner action required:** create the Apps Script project from `relay/Code.gs` and `relay/Bridge.html`, run `authorizeRelay`, deploy as a web app accessible to anyone, add its `/exec` URL as the GitHub Actions variable `SALON_RELAY_URL`, then rerun Pages deployment.
- **Not yet verified:** Google Apps Script availability on the owner's Iranian ISP, real booking flow through the relay, and owner session round-trip. Do not claim that Pages is live-bookable until those checks pass.


## Latest Apps Script nested-frame relay diagnosis (2026-11-05)

- Inspected current GitHub main tree and active release architecture. The active production path is GitHub Pages + Google Apps Script + a private Google Spreadsheet. Cloudflare Worker/D1 files are retained as recovery material and are not in the active request path.
- Verified SALON_RELAY_URL is configured in the GitHub Pages workflow environment. The Pages build, artifact upload and GitHub Pages deployment succeeded for commit c185453f60a45186885017b895a17873d00700c8, but the post-deployment live smoke failed.
- Read the actual workflow log: the browser found the nested Apps Script HtmlService frame, google.script.run was available, and direct proxyRequest('/api/health') returned HTTP 200. The deployed backend reported version 1.0.0, while repository source is 1.1.0. The readiness message was not received by the Pages top-level window.
- Root cause: Apps Script renders the HTML output under a Google wrapper and a nested script.googleusercontent.com frame. The old Bridge used window.parent.postMessage, targeting the intermediate wrapper instead of the Pages top window. The updated bridge uses window.top.postMessage; the Pages client authenticates the nested frame by Google origin plus descendant MessageEvent.source, and uses exact target origins for requests and responses.
- Updated files: src/relay.ts, relay/Bridge.html, tests/apps-script-contract.test.mjs, tests/apps-script-live-smoke.mjs, ROADMAP.md and this handoff file.
- Next owner action after CI: import current relay/Code.gs, relay/Bridge.html and relay/appsscript.json into the existing Apps Script project; run setupSalonDatabase() again (additive only, preserving existing rows); reauthorize newly requested scopes if prompted; deploy a new Web App version while keeping the same /exec URL. Then rerun Pages and verify backend version 1.1.0, relay handshake, public config/services and anonymous admin rejection.
- Firebase push registration/delivery and real reservation lifecycle are still not accepted. No customer data or live booking was created by smoke. Keep launch blocked until owner configuration and end-to-end acceptance are complete.


## Latest Apps Script owner redeploy and GitHub Pages retry checkpoint (2026-11-05)

- Owner confirmed in chat that the latest repository Apps Script files and manifest were imported into the existing project, `setupSalonDatabase()` was rerun additively, requested Google scopes were authorized, and a new Web App version was deployed. Keep the existing spreadsheet and `/exec` endpoint.
- Current GitHub head before workflow hardening: `12fdf4c7414b5a247e741d2fdcd9fe835bfc5177`. CI run `42024406140` passed, including the Windows desktop / Android-touch visual QA job.
- Pages run `42024406189` attempt 2 failed before its live smoke step. The log shows two artifacts with the same name `github-pages` in one workflow run: the first deployment attempt had already uploaded one artifact, then the rerun uploaded a second, so `actions/deploy-pages@v4` refused to select an ambiguous artifact.
- Workflow fix: use `github-pages-${{ github.run_attempt }}` as the artifact name and pass that same value to the deploy action's `artifact_name` input. This keeps each rerun attempt's artifact isolated.
- Next: verify a fresh Pages run deploys, then confirm the read-only Apps Script smoke sees version 1.1.0, receives READY from the nested HtmlService frame, and passes public health/config/services plus expected anonymous owner/setup checks.
- The most recent Pages build logs showed all seven `FIREBASE_*` public build variables empty. FCM push delivery is not configured or accepted yet; email remains disabled by default.
- No real customer booking was created during the workflow diagnostics. Do not announce live booking acceptance until owner bootstrap, salon timezone/services/hours, booking lifecycle, and manager Android push delivery are accepted.


## Latest verified GitHub Pages ↔ Apps Script relay acceptance (2026-11-05)

- Current implementation commit under test: `7149f55d2b49bd0105b80a1adb149cbbb0ffef26`.
- CI run `42026780298` completed successfully. Both Linux `build` and `windows-visual` jobs passed, including tests, typecheck/build, responsive browser QA, Windows desktop and Android-touch visual QA, and owner-dashboard QA.
- Pages run `42026780070` completed successfully, including GitHub Pages deployment and the read-only Apps Script live smoke: https://github.com/pooya-labs/salon-booking/actions/runs/42026780070.
- The published `https://pooya-labs.github.io/salon-booking/` page loaded its configured Apps Script iframe. The nested HtmlService `userCodeAppPanel` frame announced READY to the Pages top window; the direct health route returned `{"ok":true,"service":"salon-booking-apps-script","version":"1.1.0"}`.
- `public config/services` and private Sheets read routes passed. The current spreadsheet has zero public services; salon timezone is not configured; the first owner account is not initialized. Anonymous owner access was correctly rejected.
- Smoke was read-only: no booking, customer PII, owner mutation or notification was created. Passing relay smoke is not production booking acceptance.
- Remaining owner setup: perform first-owner bootstrap; set the salon timezone; populate service names/categories/descriptions/prices/durations and working hours/breaks/closures; configure Firebase web app + VAPID and GitHub `FIREBASE_*` build variables; verify manager Android notification delivery in foreground/background. Email remains disabled by default.
- CI, Pages deployment and live relay smoke are green. Next phase is operational configuration and end-to-end launch acceptance, not more bridge/relay refactoring.


## GitHub Pages owner-panel URL correction (2026-11-05)

- The app does not publish `/admin` as a standalone GitHub Pages path. In Pages mode the header owner link uses the query route `?admin=1`, which `src/App.tsx` explicitly recognizes.
- Correct public owner panel URL: `https://pooya-labs.github.io/salon-booking/?admin=1`.
- A direct request to `/salon-booking/admin` can return GitHub Pages 404 because it is not a physical route or SPA fallback file. Keep `/admin` only for local development / legacy Worker contexts; do not send it to Pages users.
- Updated README and deployment/admin guides to use the confirmed Pages query route.


## Iran-first admin scheduling controls (2026-11-05)

- Fixed weekly-hours add-range behavior: the add button is enabled for closed weekdays. Clicking it reactivates the day; if no interval exists it creates a default 09:00–17:00 window. Otherwise a non-overlapping interval is appended after the final interval or into an available gap. The eight-interval cap remains.
- Added pure interval-allocation tests for empty days, normal append, gap reuse and fully occupied days.
- Pinned Apps Script scheduling calculations and settings writes to `Asia/Tehran`; default settings also use Tehran. The owner panel displays Iran/Tehran as fixed and non-editable.
- Added reusable Jalali calendar date pickers for date exceptions and manual phone bookings. API requests remain normalized to Gregorian ISO date keys.
- Exception dates are displayed in Jalali; existing dashboard booking date formatting was already Persian-calendar based.
- Time inputs now declare `lang="en-GB"` and LTR direction to request 24-hour presentation; API values remain `HH:mm`.
- Apps Script backend version is 1.2.0. Owner must import the updated `relay/Code.gs` and deploy a new Web App version while retaining the same /exec URL.
- Automated tests cover Persian/Gregorian conversion, calendar weekdays, interval allocation and Apps Script timezone contract.


## Visual daily owner calendar and manager time blocks (2026-11-05)

- Added a daily owner calendar foundation with Jalali date navigation, 24-hour time slots and distinct visual states for active customer bookings, free time and manager blocks.
- Quick blocking requires only selecting a free start, choosing a duration preset and confirming. It does not collect a name, surname, phone or note and does not create a row in Bookings.
- Apps Script backend v1.3.0 adds the additive Sheets `TimeBlocks` table and authenticated endpoints `GET /api/admin/day-schedule`, `POST /api/admin/time-blocks`, and `DELETE /api/admin/time-blocks/{id}`.
- Time-block creation is guarded by the shared script lock and rechecks opening hours, customer booking overlap and existing blocks. Public availability also treats blocks as busy ranges.
- Schedule and date-exception edits cannot close hours around existing manager blocks.
- The previous manual phone-booking form is replaced by the graphical daily calendar. Live acceptance remains pending Apps Script import/setup/deployment.


## Owner panel final interaction detail (2026-11-05)

- Manager time-block duration defaults to the current slot step (normally 15 minutes), so the core action is one tap on a free slot followed by one confirmation. Longer presets remain optional.
- A selected duration must fit within one opening interval, avoid bookings/blocks and end before midnight; past times are disabled.
- Corrected the automated owner browser test to cover day navigation, exact minimal POST payload (date/time/duration only), successful block creation and confirmed removal.


# Latest owner workflow checkpoint — immediate confirmation and calendar fixes (2026-11-05)

- Backend target: Apps Script **1.5.3**.
- Release 1.5.3 fixes the time-block validator so valid `HH:mm` values are accepted, and adds a locked/audited `DELETE /api/admin/bookings/{id}` owner endpoint. The owner UI includes a confirmation-protected delete action on desktop and mobile. The public homepage also shows the management entry directly in the mobile header and inside the mobile menu.
- Online bookings are stored as `confirmed` immediately; customer success screen communicates that the appointment is confirmed.
- Owner appointment list has no approval, completion, cancellation or status-filter controls; it is a read-only schedule.
- Daily calendar matches appointments by their stored local `date` as well as timestamp overlap, and computes a fallback end time for legacy rows without `endsAt`.
- Weekly-hours checkbox is explicit: checked means the day is closed.
- Apps Script now reuses the spreadsheet object and caches each table read within a single execution; writes invalidate the affected in-memory table. Booking/time-block data is not cached across requests.
- Owner must import the latest `relay/Code.gs` into the existing Apps Script project and deploy a new Web App version. Preserve the existing `/exec` URL; no database setup rerun is required. Release 1.5.3 normalizes Sheets date/time cells for the daily calendar and uses a 30-second visible-page refresh.