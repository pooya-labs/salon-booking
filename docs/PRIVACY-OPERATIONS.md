# Privacy operations: Google Sheets data, export, retention and deletion

This is an operational engineering guide, not legal advice. The salon's exact legal jurisdiction, business entity and applicable retention duties still require owner confirmation. **Do not invent a retention period or run bulk deletion until the owner has approved the policy.**

## Active data inventory

| Data | Stored location | Purpose | Access |
|---|---|---|---|
| Client name and phone | Private Google Sheet: Bookings | Identify and contact the person for the appointment | Owner workspace only |
| Optional client note | Bookings | Appointment context | Owner workspace only; bounded length |
| Booking reference and appointment data | Bookings | Scheduling, conflict prevention and customer lookup | Reference is useful only with the one-time management token |
| Customer management credential | Bookings.manageTokenHash | Prove possession for lookup/cancellation | Hash only; plaintext is returned once at creation |
| Idempotency metadata | Bookings.idempotencyKeyHash, requestHash | Make retries safe and prevent duplicate booking | Hashes only |
| Owner account | AdminUsers | Authenticate the manager | Username, salt and salted password hash |
| Owner sessions | AdminSessions | Maintain manager access | Hashed browser session identifier and expiry |
| Owner audit trail | AuditLog | Record management actions and booking events | Actor, action, entity and limited details |
| Booking notification | Gmail / MailApp | Notify manager after a successful booking | Sent to the configured manager mailbox |
| Short-lived rate-limit metadata | Apps Script CacheService | Reduce repeated requests | Per-browser/session counters; cache entries are temporary |

Google Sheets is owned by the deploying Google account and must remain private. GitHub Pages serves static frontend assets and does not store customer data. The Apps Script /exec endpoint is public so anonymous clients can book, but the backend executes as the deploying owner and controls access to private spreadsheet records. No booking payload is sent to GitHub Actions or Cloudflare in the active request flow.

## Data-minimization behavior

- A booking requires a name and phone number; the note is optional and size-limited.
- Public booking responses do not return the client's phone, name or note.
- Customer self-service returns only reference, service, local date/time, duration and status.
- Customer management credentials, idempotency keys and request fingerprints are stored as hashes.
- Audit events should contain operational context only, not client note content or plaintext credentials.
- Public rate limiting uses the browser's relay session identifier; it does not store raw IP addresses.
- A failed email notification does not undo the already-saved booking.

Do not add marketing analytics, payment details, identity documents, health details or additional free-text fields without a separately reviewed business purpose and retention decision.

## Owner decisions required before production

Record these decisions outside source control in the salon's approved business records:

| Decision | Owner-approved value |
|---|---|
| Salon legal jurisdiction / country | **Not yet confirmed** |
| Business/controller contact for privacy requests | **Not yet supplied** |
| Applicable privacy notice and lawful processing basis | **Requires owner/legal review** |
| Retention for completed/no-show bookings | **Not yet decided** |
| Retention for cancelled bookings | **Not yet decided** |
| Retention for abandoned/pending bookings | **Not yet decided** |
| Retention for audit/security records | **Not yet decided** |
| Google account owner and spreadsheet access list | **Must be confirmed before launch** |
| Backup/export location and access list | **Not yet decided** |
| Backup deletion/expiry schedule | **Not yet decided** |

The application deliberately has no automatic booking purge. This avoids silently choosing a legally incorrect retention period.

## Google Sheets backup and export

1. Sign into the Google account that owns the Apps Script project and database spreadsheet.
2. Open the spreadsheet from the Apps Script setupSalonDatabase execution log or the owner's private Drive.
3. Use **File → Download** to export a private XLSX or CSV copy. For a full operational backup, export each application tab, not only Bookings.
4. Store the export outside this repository, restrict access to the owner, encrypt it at rest and apply the owner-approved expiry policy.
5. Keep an export log containing operator, timestamp, spreadsheet name, purpose and file checksum only. Do not put client details or the bootstrap token in the log.
6. Verify that the backup opens and contains the expected tabs before any destructive change.

Never commit or attach spreadsheet exports to GitHub issues, commits, screenshots or chat.

## Single-customer data request

Use the authenticated owner workspace to identify the booking from a reference or a verified phone number supplied by the requester. Export only the necessary row or fields into an owner-controlled location. Do not paste client content into logs or support messages. Record the request and response according to the owner-approved policy.

## Retention and deletion

Before deletion:
1. Confirm the requester and the exact booking(s) or customer record.
2. Check the owner's approved retention and any legal/business hold.
3. Make a fresh private spreadsheet backup.
4. Delete only the approved rows from the relevant tabs; preserve required audit/financial records according to the approved policy.
5. Verify that customer lookup no longer finds the deleted booking and record the operator, timestamp and scope without retaining the deleted personal data in the audit details.

No automated deletion job is enabled. Do not schedule one until the owner approves retention rules.

## Legacy Cloudflare D1

The previous Cloudflare Worker/D1 code and SQL migrations are retained as a rollback/history path only; they are not part of the active booking architecture. The former D1 database may contain historical copies or platform metadata. Do not delete it during this cutover. If the owner needs historical rows, export the required data from D1 to a private location and review/map it before importing into Sheets. No automatic D1-to-Sheets migration is implemented.

The former D1-specific export and SQL examples in Git history should not be used as instructions for the active Google Sheets database.
