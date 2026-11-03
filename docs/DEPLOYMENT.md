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
5. Apply migrations using the documented Wrangler command after the schema is added.
6. Configure production secrets with Wrangler or the Cloudflare dashboard.
7. Connect the GitHub repository to Cloudflare Workers Builds, selecting `main` as production branch and `npm run build` as build command. Configure the Worker deployment command according to the current Wrangler setup.

## Secrets

Never put secrets in Vite environment variables: anything prefixed with `VITE_` is public in the browser bundle.

Production secrets belong in Worker secret storage, not Git:
- `SESSION_SECRET` — high-entropy random value.
- Any future email/SMS provider credentials, only if the owner approves those features.

Admin credentials must be provisioned through a secure setup flow; do not place a default password in source code or migrations.

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
