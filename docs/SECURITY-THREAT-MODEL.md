# Security & Privacy Threat Model

**Review date:** 2026-11-03  
**Application version:** 0.6.0  
**Scope:** repository-level review of the Cloudflare Worker, D1 schema/migrations, browser application and current CI tests.

> This is an internal engineering review, not a penetration test, independent security audit, legal privacy assessment, or proof of production security. No production Cloudflare account, Worker, D1 database or customer data is connected at this checkpoint.

## Assets to protect

| Asset | Sensitivity | Primary protection |
|---|---|---|
| Customer names, phone numbers and appointment notes | Personal data | D1 access only through scoped API queries; owner session required for the owner booking list |
| Appointment references and management credentials | Bearer credentials | 256-bit management token; only SHA-256 digest stored; generic lookup failures |
| Owner password | Credential | Salted PBKDF2-HMAC-SHA-256 password hash (600,000 iterations) |
| Owner session | Credential | 256-bit random token; SHA-256 digest in D1; 12-hour expiry and server-side revocation |
| Bootstrap token and SESSION_SECRET | High-impact secrets | Cloudflare Worker secret bindings; never Vite/browser variables or source control |
| Schedule, services and booking state | Business-critical data | Authenticated owner mutations, SQL constraints/triggers, audit rows and D1 backups |

## Trust boundaries

1. **Public browser → Worker:** anonymous visitors submit booking requests and can query active services/availability. Customer lookup/cancellation and owner mutations must prove same-origin.
2. **Worker → D1:** parameterized SQL statements and server-side validation govern writes and reads. D1 is the authoritative availability and overlap guard.
3. **Owner browser → admin API:** session cookie and same-origin checks gate private reads and state-changing requests.
4. **Cloudflare account → runtime configuration:** account access controls D1, Worker deployments and secrets. This control plane is outside this repository and has not been independently inspected.
5. **Repository/CI → static Pages preview:** GitHub Pages is a static demonstration only. It has no production database, must not collect real client information and is not the production application runtime.

## Threat review and existing controls

### Account takeover and session theft

- Passwords use a fresh 16-byte random salt and PBKDF2-HMAC-SHA-256 with 600,000 iterations. Verification compares derived bytes without an early exit over the digest.
- Login uses a dummy password hash for unknown usernames, a generic invalid-credentials response, and an IP-HMAC limit of 8 attempts per 15 minutes.
- Sessions use 256-bit random values. Only SHA-256 token hashes are stored; sessions expire after 12 hours and logout deletes the session record.
- The cookie is `__Host-salon_session` with `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`, and no Domain attribute.
- **Residual:** there is no MFA, owner recovery flow or account alerting. Protect the Cloudflare account and owner email with MFA and strong unique credentials; plan a recovery procedure before launch.

### Bootstrap abuse

- First-owner creation requires a configured bootstrap token, a same-origin POST, a minimum 32-character SESSION_SECRET, and a separate IP-HMAC limit of 3 attempts per hour.
- The D1 insert succeeds only while no owner exists; subsequent bootstrap attempts cannot create another first owner.
- **Operational requirement:** remove `ADMIN_BOOTSTRAP_TOKEN` immediately after the owner is created. It is not needed for normal operation.

### CSRF and cross-origin actions

- Login, bootstrap, logout, customer booking lookup/cancellation, and every owner mutation validate the request Origin against the request URL and reject `Sec-Fetch-Site: cross-site`.
- The owner cookie is SameSite Strict. API responses do not enable permissive cross-origin access.
- The public booking endpoint accepts JSON and has no account requirement; abuse prevention therefore relies on validation, idempotency, database conflict controls and rate limits rather than a signed-in user.

### Booking enumeration, token theft and replay

- New bookings require a 256-bit idempotency key. Key/request hashes are domain-separated; raw idempotency keys and duplicate request bodies are not written to the idempotency ledger.
- Customer-management tokens are derived with domain separation from the high-entropy booking key. D1 stores only a SHA-256 digest of the management token.
- Lookup requires both a validated reference and a 64-hex-character bearer token. Missing references and invalid tokens share a generic 404 response; lookup/cancellation is IP-limited to 20 requests per 15 minutes.
- The client booking row retains the name, phone and note needed to operate the appointment; the idempotency ledger does not duplicate those fields.
- D1 overlap triggers and the transactional idempotency record protect against concurrent booking conflicts and uncertain retry outcomes.

### Injection, malicious input and browser execution

- Dynamic SQL values use D1 prepared statements and bound parameters. User-controlled service/schedule values are validated before writes.
- JSON request bodies are limited to 8,192 characters and parsed as objects; route-specific schemas constrain accepted fields.
- HTML CSP now restricts scripts and connections to self, images/fonts to self or data URLs, blocks objects and framing, and does not allow `unsafe-eval` or arbitrary external HTTPS resources. Inline styles remain permitted for the current UI.
- API JSON responses receive a restrictive `default-src 'none'` CSP. Responses also set anti-framing, no-sniff, no-referrer, and permissions/cross-origin isolation headers; HSTS is applied on HTTPS requests.
- **Residual:** the HTML policy still permits inline styles. Keep React-rendered text escaped, avoid `dangerouslySetInnerHTML`, and review any future rich-text/third-party widget before relaxing CSP.

### Request flooding and service exhaustion

- Public availability is limited to 180 requests/15 minutes/IP; booking creation to 10/15 minutes/IP; customer management to 20/15 minutes/IP.
- Login and bootstrap have their own limits. IP buckets are HMAC-derived using SESSION_SECRET rather than storing raw IP addresses.
- Rate limiting fails closed if the secret or Cloudflare client IP is unavailable.
- **Residual:** per-IP limits do not stop distributed traffic and shared networks can affect legitimate users. Add Cloudflare WAF/bot controls and monitor abuse before public launch if traffic requires them.

### Data loss, leakage and operator mistakes

- D1 export/restore smoke coverage runs against an isolated local database with synthetic data. It does not verify production backups or restoration.
- Migration 0008 cascades the idempotency ledger when a booking is erased. Other PII retention periods are not yet owner-approved.
- Backup exports contain customer data and must be access-controlled, encrypted and deleted under the approved retention policy.
- **Residual:** D1 production provisioning, production backup/restore, retention periods, privacy contact, incident response and Cloudflare account permissions remain unverified.

## Risk register and release gates

| Risk | Current status | Required before real bookings |
|---|---|---|
| Owner credential theft | Mitigated in application; MFA absent | Owner and Cloudflare account MFA; unique credentials; confirm secure bootstrap and remove token |
| Public spam / distributed abuse | Partially mitigated | Review Cloudflare WAF/bot controls and monitor rate-limit behavior |
| Exposure of customer PII | Application access is scoped; retention undefined | Approve retention, privacy contact, D1 access list, backup storage and deletion process |
| D1 corruption or destructive migration | Local smoke test only | Verified production export and restore exercise; forward-compatible migration plan |
| Session/token compromise | High-entropy tokens and server-side revocation | Operational incident/rotation playbook; no secret values in logs/support channels |
| Browser/accessibility defects | Chromium tests pass | Physical-device and real screen-reader acceptance |
| Production misconfiguration | Production not provisioned | Verify Worker routes, D1 binding, secrets, TLS/security headers, logs and smoke tests |

## Evidence and verification

- Unit tests, SQLite migration/privacy tests, local Wrangler Worker+D1 HTTP integration, and autonomous Chromium tests passed in [CI run 41647018808](https://github.com/pooya-labs/salon-booking/actions/runs/41647018808).
- The CI integration test asserts the HTML CSP does not allow arbitrary `https:` resources or `unsafe-eval`, and the Pages browser test verifies no third-party/API requests from the static demo.
- Browser QA covers viewport emulation and keyboard/focus behavior; it is not an assistive-technology certification or penetration test.
- No production endpoints, customer records, Cloudflare secrets or remote D1 resources were accessed by this review.

## Decision

The code-level controls and automated checks are materially stronger, but this document does not authorize launch. Keep R06 at **in progress** until the production account/configuration review, owner privacy decisions, independent/targeted security checks and operational recovery evidence are complete.
