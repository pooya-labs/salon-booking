# Owner workspace and first-admin setup

## What is implemented

The owner workspace is served at /admin by the Cloudflare Worker. It includes:
- First-owner bootstrap (only while there are no rows in admin_users).
- Username/password login and logout.
- A 12-hour owner session stored as a host-only secure cookie.
- Upcoming appointment list, status filter, client contact, booking reference and service details.
- Allowed transitions: pending → confirmed/cancelled; confirmed → completed/cancelled/no-show.
- An audit record for each successful booking status transition.

GitHub Pages and local Vite development show a demo-only information page. They do not load real customer records and never enable admin API requests.

## Required Worker secrets

Create two distinct random values, for example with:

```sh
openssl rand -hex 32
openssl rand -hex 32
```

Use the first for SESSION_SECRET and the second for ADMIN_BOOTSTRAP_TOKEN. Do not reuse passwords or the same secret value.

Cloudflare Dashboard steps:
1. Open Workers & Pages.
2. Select the deployed salon-booking Worker.
3. Open Settings → Variables and Secrets.
4. Choose Add → Secret.
5. Add SESSION_SECRET and ADMIN_BOOTSTRAP_TOKEN as separate secrets.
6. Deploy the Worker so the new secret bindings become available.

Cloudflare Worker secrets are exposed to Worker code through the env binding and are not committed to source code.

## One-time first-owner bootstrap

Prerequisites: the Worker is deployed, D1 is bound, and migrations 0001–0003 have been applied.

1. Open the production /admin URL over HTTPS.
2. The page displays the first-owner form only when no owner account exists and both required secrets are configured.
3. Enter the ADMIN_BOOTSTRAP_TOKEN value, choose a username and a strong password of at least 12 characters, then submit.
4. The server conditionally inserts the first owner and immediately creates a secure session.
5. Remove ADMIN_BOOTSTRAP_TOKEN from Worker settings and deploy again. Keep SESSION_SECRET.

Bootstrap is one-time at the database level: an existing owner prevents another account from being created even if the bootstrap endpoint is called again.

## Session and abuse controls

- Password hash: PBKDF2-HMAC-SHA-256, 600,000 iterations, independent 16-byte random salt.
- Session token: 256 random bits; only its SHA-256 digest is stored.
- Cookie: __Host-salon_session; Secure, HttpOnly, SameSite=Strict, Path=/, 12-hour lifetime.
- Login rate: 8 attempts per IP-derived HMAC bucket per 15-minute window.
- Bootstrap rate: 3 attempts per IP-derived HMAC bucket per one-hour window.
- Same-origin Origin required for login, bootstrap, logout and owner mutations.
- Owner booking reads expose client details only after session validation.
- Status changes use a D1 batch transaction with an audit-log insert conditional on the update succeeding.

The rate-limit table stores only a keyed HMAC of the IP address, not the raw address.

## Current limitations

The current owner workspace does not yet edit services, weekly opening hours, breaks, holidays or date exceptions. It does not provide password recovery or multiple owner accounts. Public booking still needs its own abuse/rate controls. Before collecting real customer data, also complete client lookup/cancellation privacy, retention/export/deletion policy, backups, full security review and production acceptance.
