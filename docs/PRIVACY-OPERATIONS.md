# Privacy operations: data inventory, export, retention and deletion

This is an operational engineering guide, not legal advice or a substitute for the salon owner's privacy notice. The salon's country, legal entity, service model and applicable retention duties have not been confirmed. **Do not invent a retention period or run bulk deletion until the owner has approved the jurisdiction and schedule.**

## Data inventory

| Data | Stored location | Why it exists | Access / exposure |
|---|---|---|---|
| Client name and phone | `bookings.client_name`, `bookings.client_phone` | Identify and contact the person for the appointment | Only authenticated owner booking endpoints return these fields |
| Optional client note | `bookings.client_note` | Client-provided appointment context | Owner booking list only; max 500 characters after normalization |
| Booking reference and appointment data | `bookings` | Scheduling, conflict prevention and lookup | Includes the booked service-name and duration snapshots; reference is public only when paired with the one-time management token; minimal summary returned to customer |
| Customer management credential | `bookings.client_manage_token_hash` | Prove possession for customer lookup/cancellation | Only SHA-256 digest stored; plaintext returned once at booking creation |
| Booking status history | `booking_status_events` | Operational status trail | Booking ID, old/new status and timestamp only; no client name, phone or note; cascades when booking is deleted |
| Owner account | `admin_users` | Authenticate the salon owner | Username and salted PBKDF2 hash; never returned by public endpoints |
| Owner sessions | `admin_sessions` | Maintain authenticated owner access | SHA-256 token digest and expiry only; expired rows are pruned during session checks |
| Owner audit trail | `admin_audit_log` | Record management actions and state changes | Actor, action, entity ID and minimal structured details; do not add client name, phone, note or credential values |
| Rate-limit metadata | `admin_rate_limits`, `public_rate_limits` | Reduce credential abuse and automated requests | Scope-separated HMAC bucket IDs, counters and expiry; raw IP addresses are not stored; expired buckets are pruned on limiter checks |
| Cloudflare operational logs and backups | Cloudflare account/platform | Runtime operations and recovery | Platform-managed; owner must review account access, log settings and backup/time-travel retention separately |

GitHub Pages and local Vite preview are demo-only and do not submit or persist client details. Never paste production data into GitHub issues, commits, screenshots or test fixtures.

## Data-minimization controls currently implemented

- A booking requires a name and phone number; the note is optional and capped at 500 characters.
- The public booking endpoint never returns the client's phone, name or note.
- Customer self-service returns only reference, service, local date/time, duration and status.
- Customer management credentials are random 256-bit values; only a SHA-256 digest is stored.
- Status history stores only booking ID, transition and timestamp. Its foreign key uses `ON DELETE CASCADE`.
- Admin audit entries should record operational changes, not client content. Current booking status audit details contain only `from` and `to`.
- Admin and public rate-limit buckets use HMAC-derived identifiers, not raw IP strings.
- Pages remains disconnected from real customer APIs.

Do not add marketing, analytics identifiers, payment details, identity documents, sensitive health details or free-text fields without a separately reviewed purpose and retention decision.

## Owner decisions required before production

Record these decisions outside source control in the salon's approved business records:

| Decision | Owner-approved value |
|---|---|
| Salon legal jurisdiction / country | **Not yet supplied** |
| Business/controller contact for privacy requests | **Not yet supplied** |
| Applicable privacy notice and lawful processing basis | **Requires owner/legal review** |
| Retention for completed/no-show bookings | **Not yet decided** |
| Retention for cancelled bookings | **Not yet decided** |
| Retention for abandoned/pending bookings | **Not yet decided** |
| Retention for audit/security records | **Not yet decided** |
| Backup/export storage location and access list | **Not yet decided** |
| Backup deletion/expiry schedule | **Not yet decided** |

The application deliberately has no automatic booking purge. That is safer than silently choosing a legally incorrect period.

## Export and backup procedure

### Before a backup or subject export

1. Confirm that the target is the correct production database and not the local or preview database.
2. Create a private directory **outside the repository** and restrict access to the operator:
   `mkdir -p ../private-salon-booking-backups`
3. Export the database before schema changes, retention deletion or a sensitive support operation:

   ```sh
   npx wrangler d1 export salon-booking --remote --output="../private-salon-booking-backups/salon-booking-YYYYMMDD-HHMMSS.sql"
   ```

4. Confirm the command succeeded and the file is non-empty. Store it encrypted, restrict access, and apply the approved backup expiry schedule. Never commit or attach the export to chat/issues.
5. Keep an export log containing operator, timestamp, database name, purpose and file checksum only. Do not put client details or secret values in the log.

Wrangler supports exporting a full D1 database or selected tables to SQL. A full export contains personal data and security-related tables, so treat it as a sensitive credential-bearing backup. See the [Cloudflare D1 export guide](https://developers.cloudflare.com/d1/best-practices/import-export-data/) and [Wrangler D1 command reference](https://developers.cloudflare.com/workers/wrangler/commands/d1/).

### Single-customer booking export

Use an authenticated owner session or a restricted operator with explicit authorization. Identify the booking through a verified reference and/or phone number supplied by the requester. Do not copy the result into logs.

Example query (replace the reference with the verified booking reference):

```sql
SELECT
  b.reference_code,
  b.client_name,
  b.client_phone,
  b.client_note,
  b.starts_at,
  b.ends_at,
  b.status,
  b.service_name_snapshot AS service_name,
  b.service_duration_minutes,
  b.created_at
FROM bookings AS b
WHERE b.reference_code = 'SB-REPLACE_WITH_VERIFIED_REFERENCE';
```

Status history for that same booking:

```sql
SELECT e.previous_status, e.new_status, e.created_at
FROM booking_status_events AS e
INNER JOIN bookings AS b ON b.id = e.booking_id
WHERE b.reference_code = 'SB-REPLACE_WITH_VERIFIED_REFERENCE'
ORDER BY e.created_at ASC;
```

Run a read-only query through Wrangler only after confirming the database target; keep its JSON/terminal output private. The owner should verify the requester's identity before disclosing the export.

## Retention review and deletion procedure

### Preview only — no deletion

Choose a UTC cutoff only after the owner has approved the retention schedule. First inspect exactly which records would be affected:

```sql
SELECT id, reference_code, status, ends_at
FROM bookings
WHERE status IN ('cancelled', 'completed', 'no_show')
  AND ends_at < 'REPLACE_WITH_OWNER_APPROVED_UTC_CUTOFF'
ORDER BY ends_at ASC;
```

Count the result and confirm it contains no pending or confirmed appointments. Review a sample against the owner's approved policy. Do not use the preview cutoff unchanged.

### Controlled deletion

1. Confirm the applicable retention rule and any legal/accounting hold with the owner.
2. Take and verify a fresh encrypted D1 export using the procedure above.
3. Run the preview query and have a second authorized person review the row count and cutoff.
4. Only after approval, execute the corresponding deletion against the verified database:

   ```sql
   DELETE FROM bookings
   WHERE status IN ('cancelled', 'completed', 'no_show')
     AND ends_at < 'OWNER_APPROVED_UTC_CUTOFF';
   ```

5. Immediately verify the affected row count and confirm there are no remaining records in the approved deletion set.
6. The `booking_status_events` rows cascade-delete with the booking. The `admin_audit_log` has no foreign key to bookings; minimal status-change audit rows may remain with the opaque booking UUID and transition only. Review whether that operational record may be retained under the approved policy.
7. Apply the same approved expiry to private exports and backups. Deleting a live D1 row does not automatically remove copies from operator exports, Cloudflare recovery/time-travel facilities or platform logs; review those separately.

For a one-off erasure, first verify the exact booking ID and all linked records, then delete only that ID after approval. Never run a broad `DELETE` by phone number alone: one person may have multiple bookings and the request may not cover all of them.

The procedure intentionally excludes pending and confirmed bookings from bulk retention deletion. A separate decision is required for abandoned pending bookings; do not infer they are abandoned solely from their status.

## Incident and access hygiene

- Keep Cloudflare, GitHub and backup access limited to named operators who need it.
- Remove `ADMIN_BOOTSTRAP_TOKEN` after the first owner account is created.
- Rotate `SESSION_SECRET` only with a planned session/rate-limit impact review.
- If a client-management token is exposed, treat it as a bearer credential. Cancel the booking if appropriate and arrange a new booking rather than trying to recover the plaintext token.
- Do not record phone numbers, names, notes, passwords, tokens, cookies, SQL exports or full request bodies in application logs.
- Review admin accounts and backup access periodically.
- Document security incidents and actions without copying unnecessary client content.

## Verification checklist

- [ ] Owner approved jurisdiction, privacy notice and retention schedule.
- [ ] Owner contact for privacy requests is published.
- [x] Wrangler local D1 export/restore smoke test passed in CI with synthetic data; this does not verify the production database.
- [ ] Production D1 backup/export was restored successfully in an isolated test database.
- [ ] Retention preview was reviewed before any delete operation.
- [ ] Individual erasure and status-event cascade were verified on a synthetic local database.
- [ ] Backups and Cloudflare recovery/log retention were included in the policy.
- [ ] No real client information appears in GitHub, CI fixtures, screenshots or application logs.
