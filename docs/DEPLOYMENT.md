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
5. Apply all committed migrations: `npx wrangler d1 migrations apply salon-booking --remote`. The current migration intentionally leaves `local_timezone='unset'` until the salon owner confirms the business location.
6. Configure production secrets with Wrangler or the Cloudflare dashboard.
7. Connect the GitHub repository to Cloudflare Workers Builds, selecting `main` as production branch and `npm run build` as build command. Configure the Worker deployment command according to the current Wrangler setup.

## Secrets

Never put secrets in Vite environment variables: anything prefixed with `VITE_` is public in the browser bundle.

Production secrets belong in Worker secret storage, not Git:
- SESSION_SECRET — a unique high-entropy random value of at least 32 characters; used to HMAC rate-limit identifiers.
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

## Rollback

Keep the previous successful deployment available in Cloudflare deployment history. For database changes, prefer forward-compatible migrations; restore from a verified export only after assessing data loss implications.


## Temporary GitHub Pages preview

GitHub Pages is only for reviewing the static UI. Enable it once in repository Settings → Pages → Build and deployment → Source → GitHub Actions. The Pages workflow uses `npm run build:pages` and publishes `dist/` at `https://pooya16pg-spec.github.io/salon-booking/`. The regular `npm run build` keeps the root base path required by the eventual Cloudflare Worker deployment. Never collect real bookings or personal data on the Pages preview.

 
## Public API and D1 scheduling setup

See [API.md](./API.md) for public and owner API contracts, and [ADMIN.md](./ADMIN.md) for the secure first-owner setup and dashboard behavior. Migration `0002_booking_engine.sql` creates the booking settings and overlap-protection triggers. The timezone value intentionally starts as `unset`; set it only after the salon owner confirms the actual location. Do not enter production customer information until rate limiting, owner authentication, lookup/cancellation privacy, backups and launch QA are complete.
