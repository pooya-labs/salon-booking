# Deployment Guide

## Target

One Cloudflare Worker serves:
- Static frontend assets built by Vite.
- JSON API routes under `/api/*`.
- D1 database access for scheduling and booking data.

No VPS is required. The free tier is subject to Cloudflare's current quotas and terms.

## One-time setup

1. Sign in to Cloudflare.
2. Create a D1 database named `salon-booking`.
3. Copy the database ID.
4. Add the ID to `wrangler.toml` locally or through the deployment configuration. Do not commit account tokens.
5. Apply all committed migrations in order (currently 0001–0010): `npx wrangler d1 migrations apply salon-booking --remote`. The migrations intentionally leave `local_timezone='unset'` until the salon owner confirms the business location.
6. Configure production secrets with Wrangler or the Cloudflare dashboard.
7. Connect the GitHub repository to Cloudflare Workers Builds, selecting `main` as production branch and `npm run build` as build command. Configure the Worker deployment command according to the current Wrangler setup.

## Local development with the Worker and D1

The plain `npm run dev` command starts Vite only and intentionally displays the static sample-data experience. To exercise the Worker API locally, use a separate Wrangler configuration so the committed production config and its placeholder D1 ID are never overwritten.

1. Copy the local-only examples:
   `cp wrangler.dev.toml.example wrangler.dev.toml`
   `cp .dev.vars.example .dev.vars`
2. Generate two different secrets and replace the placeholders in `.dev.vars`:
   `openssl rand -hex 32`
   Run it twice. Keep `SESSION_SECRET` and `ADMIN_BOOTSTRAP_TOKEN` distinct. Both local files are ignored by Git.
3. Install dependencies and apply migrations to the local D1 database only:
   `npm install`
   `npm run db:local`
4. Build assets and launch the Worker:
   `npm run build`
   `npm run dev:worker`
5. Open the local URL printed by Wrangler. The first owner can be bootstrapped locally using the local-only `ADMIN_BOOTSTRAP_TOKEN`. Never use real client data in local development.

The local Wrangler config uses a reserved local-only D1 UUID and the same logical database name as the migrations. The `db:local` script explicitly passes `--local`; it never applies migrations remotely. Production commands continue to use the committed `wrangler.toml` and must only be run after the Cloudflare database ID and account have been provisioned.

To run static-preview browser QA locally, install Playwright and Chromium using the versions pinned in `.github/workflows/ci.yml`, run `npm run build:pages`, then `npm run test:browser`.

## Secrets

Never put secrets in Vite environment variables: anything prefixed with `VITE_` is public in the browser bundle.

Production secrets belong in Worker secret storage, not Git:
- SESSION_SECRET — a unique high-entropy random value of at least 32 characters; used for owner session security and scope-separated HMAC identifiers for admin and public rate-limit buckets.
- ADMIN_BOOTSTRAP_TOKEN — a separate high-entropy one-time key used only to create the first owner account.
- Any future email/SMS provider credentials, only if the owner approves those features.

Generate two different values, for example with openssl rand -hex 32. In Cloudflare Dashboard, open Workers & Pages → salon-booking → Settings → Variables and Secrets → Add → Secret, add both names and values, then deploy the Worker. Cloudflare makes Worker secrets available through the env object and hides their values after creation. After the first owner account is created successfully at /admin, remove ADMIN_BOOTSTRAP_TOKEN; keep SESSION_SECRET in place. Never put either value into Git, a Vite VITE_* variable, an issue, or chat.

Admin credentials are provisioned through the one-time bootstrap form; there is no default username or password in source code or migrations. The first owner chooses their own username and password (minimum 12 characters).

## Database

Use versioned SQL migrations under `migrations/`. Apply them to development and production deliberately. Back up/export production D1 before risky schema changes.

## Release checklist

- [ ] Build passes.
- [ ] Typecheck passes.
- [ ] Migrations applied.
- [ ] Secrets configured.
- [ ] Admin bootstrap completed securely.
- [ ] Smoke test public booking.
- [ ] Smoke test owner login and schedule management.
- [ ] Verify no test/customer data leaked.
- [ ] Record deployed commit and URL in `docs/PROJECT-STATE.md`.

## Rollback and recovery runbook

### Before a production release

1. Confirm the exact `main` commit and the currently deployed Worker version. Record both in the release log.
2. Confirm the D1 database name/ID and inspect pending migrations:
   `npx wrangler d1 migrations list salon-booking --remote`.
3. Export a pre-release copy of D1 to a private location:
   `npx wrangler d1 export salon-booking --remote --output=./backups/salon-booking-before-release.sql`.
   The export contains customer personal data. Keep it outside Git, restrict access, encrypt it at rest and remove local copies according to the owner-approved retention policy.
4. Review every unapplied migration. Prefer additive, backward-compatible changes and deploy code that works with both the previous and new schema.
5. Apply only the reviewed migrations:
   `npx wrangler d1 migrations apply salon-booking --remote`.
   Wrangler captures a backup after a successful migration apply; keep the separate pre-release export as an independently controlled recovery point.
6. Deploy the Worker and record the new Worker version ID, deployment timestamp and Git commit.

### Application-only rollback

A Worker rollback immediately creates a new deployment from the selected prior version and makes it active. It does **not** roll back D1, secrets, or other bound resources. Follow this order:

1. Identify the last known-good Worker version ID from the Cloudflare deployment history.
2. Check whether the current D1 schema and data are compatible with that older application version. Do not roll back application code across a breaking schema migration.
3. Roll back to the known-good Worker version:
   `npx wrangler rollback <KNOWN_GOOD_VERSION_ID> --message "Rollback: <short reason>"`.
   The command can also be run from the Cloudflare dashboard: Workers & Pages → `salon-booking` → Deployments → version menu → Rollback.
4. Verify `GET /api/health`, the public configuration/services response, and the owner login/booking list using the approved production smoke-test account. Check Worker logs and error rates before declaring recovery.
5. Record the rollback deployment ID, prior/current version IDs, triggering commit, reason and smoke-test result.

Cloudflare documents that a rollback is a new active deployment and that connected resources are unchanged. It can fail or leave the old code incompatible when resource bindings or data structures have changed. See [Workers rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/).

### D1 recovery is a separate operation

- A Worker rollback does not undo SQL migrations or restore deleted/changed booking rows.
- Prefer a forward-fix migration whenever the data can be retained safely.
- Before restoring any backup or point-in-time state, take a fresh export of the current database, identify the exact restore point, estimate the lost booking/update window, and obtain owner approval. A restore can overwrite current data; never run it as an automatic consequence of an application rollback.
- Use the current Cloudflare [D1 export/import guide](https://developers.cloudflare.com/d1/best-practices/import-export-data/) and [D1 Wrangler commands](https://developers.cloudflare.com/d1/wrangler-commands/) for the supported export and recovery method for the account/runtime in use.
- After recovery, list applied migrations again and run the complete production smoke-test checklist.

This runbook is documented but has **not** been exercised against a production Worker or D1 database; neither has been provisioned yet.


## Temporary GitHub Pages preview

GitHub Pages is only for reviewing the static UI. Enable it once in repository Settings → Pages → Build and deployment → Source → GitHub Actions. The Pages workflow uses `npm run build:pages` and publishes `dist/` at `https://pooya-labs.github.io/salon-booking/`. The regular `npm run build` keeps the root base path required by the eventual Cloudflare Worker deployment. Never collect real bookings or personal data on the Pages preview.

 
## Public API and D1 scheduling setup

See [API.md](./API.md) for public and owner API contracts, and [ADMIN.md](./ADMIN.md) for the secure first-owner setup and dashboard behavior. Migration `0002_booking_engine.sql` creates the booking settings and overlap-protection triggers. The timezone value intentionally starts as `unset`; set it only after the salon owner confirms the actual location. Public availability and booking use fixed-window IP-HMAC limits (180 availability requests and 10 booking attempts per 15 minutes per IP); customer lookup/cancellation has a separate 20-request limit. New bookings require a 256-bit `Idempotency-Key`; retries with the same key and payload replay the original reservation. Migration 0008 stores only key/request hashes and non-sensitive response metadata, with automatic cleanup when a booking is erased. The management token is deterministically derived from the high-entropy key and only its SHA-256 digest is stored. Do not enter production customer information until owner authentication, lookup/cancellation privacy, backups and launch QA are complete.
