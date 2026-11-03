# Owner workspace and first-admin setup

## Implemented owner features

The protected owner workspace is served at `/admin` by the Cloudflare Worker. It includes:

- First-owner bootstrap, only while no admin account exists.
- Username/password login and logout.
- 12-hour host-only secure session cookie.
- Upcoming booking list, status filter, customer contact, reference and service details.
- Allowed booking transitions: pending → confirmed/cancelled; confirmed → completed/cancelled/no-show.
- Service management: create, edit, activate and deactivate; deactivation preserves historical reservations.
- Booking settings: salon timezone, slot interval, notice period, booking horizon and buffer.
- Weekly schedule editing, with up to eight separate opening intervals per day (for example morning and afternoon shifts).
- Date-specific closures or one-off opening intervals, with notes.
- Audit records for service, schedule and settings changes, plus a database status-history entry for every booking status change (including customer cancellations).

The schedule editor validates intervals on the server and rejects overlap. The database also has overlap triggers for weekly and exception intervals. The system rejects schedule changes that conflict with known pending/confirmed bookings. Existing single-interval schedules are backfilled by migration 0005.

GitHub Pages and local Vite development show a demo-only information page. They never load real customer records and do not call owner APIs.

## Required Worker secrets

Generate two distinct random values:

```sh
openssl rand -hex 32
openssl rand -hex 32
```

Use the first for `SESSION_SECRET` and the second for `ADMIN_BOOTSTRAP_TOKEN`. Do not reuse a password or the same secret value.

Cloudflare Dashboard steps:
1. Open Workers & Pages.
2. Select the deployed salon-booking Worker.
3. Open Settings → Variables and Secrets.
4. Choose Add → Secret.
5. Add `SESSION_SECRET` and `ADMIN_BOOTSTRAP_TOKEN` as separate secrets.
6. Deploy the Worker so the new secret bindings become available.

Secrets are read through Worker environment bindings and are never committed to source.

## Database setup

Prerequisites: create and bind a Cloudflare D1 database, configure its ID in Wrangler, and apply migrations `0001_initial_schema.sql` through `0007_customer_booking_access.sql` in order.

Do not apply migrations to a real database until its ID and target environment have been checked. The project contains no real salon data yet.

## One-time first-owner bootstrap

1. Deploy the Worker and apply all database migrations.
2. Add the two Worker secrets above.
3. Open the production `/admin` URL over HTTPS.
4. The first-owner form is shown only when there is no owner and both secrets are configured.
5. Enter the bootstrap token, choose a username and a strong password of at least 12 characters, then submit.
6. Remove `ADMIN_BOOTSTRAP_TOKEN` from Worker settings and deploy again. Keep `SESSION_SECRET`.

Bootstrap is one-time at the database level. An existing owner prevents another account being created.

## Session and abuse controls

- Password hashes use PBKDF2-HMAC-SHA-256 with 600,000 iterations and independent 16-byte random salt.
- Session tokens contain 256 random bits; only their SHA-256 digest is stored.
- Cookie: `__Host-salon_session`, Secure, HttpOnly, SameSite=Strict, Path=/, 12-hour lifetime.
- Login rate: 8 attempts per IP-derived HMAC bucket per 15-minute window.
- Bootstrap rate: 3 attempts per IP-derived HMAC bucket per one-hour window.
- Public availability: 180 requests per IP per fixed 15-minute window.
- Public booking creation: 10 attempts per IP per fixed 15-minute window.
- Customer lookup and cancellation combined: 20 requests per IP per fixed 15-minute window.
- Public limits use scope-separated HMAC-SHA-256 buckets derived from `SESSION_SECRET`; raw IP addresses are never stored. Expired buckets are pruned during rate-limit checks.
- Mutating requests require a matching same-origin Origin header.
- The rate-limit table stores a keyed HMAC of the IP, not the raw address.

Personal-data export, backup, retention and deletion safeguards are documented in [PRIVACY-OPERATIONS.md](./PRIVACY-OPERATIONS.md). Do not apply its destructive SQL procedures until the salon owner has approved a retention schedule and a fresh backup has been verified.

## Remaining release blockers

- Confirm the salon's customer cancellation policy and any desired notice period. The current endpoint allows cancellation before the appointment starts.
- Data minimization, retention/export/deletion policy and operational backups.
- Security headers review, threat model and full security review.
- Production Cloudflare deployment, real D1, secrets, actual salon services, timezone, hours and owner acceptance.
- Password recovery and multiple owner accounts are not in the initial scope.

Never use the GitHub Pages preview for real reservations or personal information.
