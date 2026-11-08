# Security and privacy notes

**Application:** Shayan Barber Booking 1.0.0  
**Last reviewed:** 8 November 2026  
**Scope:** repository and documented production design

This document records the main trust boundaries, safeguards and remaining operational risks in the current implementation. It is not a penetration test, an independent security audit, legal advice or a guarantee that every deployment is configured safely.

## Production boundaries

The live system has four main parts:

1. The customer's browser loads the static frontend from GitHub Pages.
2. A hidden iframe connects the frontend to the salon's Google Apps Script Web App.
3. Apps Script executes as the deploying owner and accesses the private Google Spreadsheet.
4. Firebase Cloud Messaging sends push notifications to registered manager devices. Email alerts use Apps Script MailApp only when enabled.

The Apps Script web app address is publicly reachable so customers can book without signing in. The script runs with the deploying owner's permissions, so the backend must keep private spreadsheet operations behind the correct owner and customer authorization checks.

GitHub Pages does not store booking records. Cloudflare Worker and D1 files in this repository are legacy material and are not in the active request path.

## Information handled by the system

The application needs a limited amount of information to operate appointments:

- Customer name and phone number, plus an optional booking note.
- Service, date, time, duration, reference and booking status.
- A one-time customer management credential. The backend stores its hash rather than the plaintext value.
- Owner account data and hashed session identifiers.
- Registered manager push-device details.
- Audit entries for owner actions and booking changes.

The private spreadsheet belongs to the Google account that runs the Apps Script project. Keep its sharing permissions restricted to the people who operate the salon.

## Safeguards in the current design

- The public API returns only the service and availability information needed for booking.
- Customer lookup and cancellation require both the booking reference and the one-time management credential.
- The customer-facing lookup response does not expose the customer's phone number or name.
- Owner routes require a valid owner session, apart from the limited first-owner setup flow.
- Owner sessions have a rolling 30-day lifetime. The stored session identifier is hashed, and signing out revokes the current session.
- First-owner setup and notification-recipient configuration are intended to be run from the owner's Apps Script editor, not through the public site.
- Booking availability is checked again when a request is submitted. The script lock protects the final availability check and write from overlapping requests.
- Booking requests include an idempotency key so a retry of the same attempt does not create a second reservation.
- Notification delivery is separate from saving the booking. A failed notification does not undo an appointment that has already been stored.
- The application does not automatically delete old bookings. This avoids silently applying a retention period that the salon owner has not approved.

## Operational requirements

The security of the live service also depends on the Google and Firebase accounts used to run it.

- Keep the Apps Script project and its spreadsheet under an account controlled by the salon owner.
- Use a strong, unique Google account password and enable the account's available multi-factor protection.
- Do not share the spreadsheet publicly.
- Keep the one-time owner-bootstrap token private and use it only for the initial owner setup.
- Store the Apps Script web app address and public Firebase web configuration in the correct GitHub Actions variables. Never put private credentials or customer data in source code.
- Review Apps Script executions when the backend reports errors.
- Limit access to GitHub repository settings and Firebase project administration.
- Do not paste customer records, spreadsheet exports, session tokens or push credentials into issues, commits or screenshots.

## Remaining risks

The following work has not been completed or formally approved:

| Area | Current position |
|---|---|
| Independent penetration test | Not performed |
| Production backup restore and rollback exercise | Not recorded |
| Booking-data retention periods | Awaiting the salon owner's decision |
| Privacy contact and applicable legal notice | Require owner review |
| Google account recovery and access review | Managed outside this repository |
| Physical-device and screen-reader certification | Not claimed; automated browser checks are narrower |

The public Apps Script endpoint is necessary for anonymous booking, but it also means the backend is an important security boundary. Changes to authorization, validation, spreadsheet access or Apps Script scopes deserve careful review.

## Verification

The repository includes unit tests, Apps Script contract tests, local migration checks and browser tests for the customer and owner flows. GitHub Actions runs linting, builds, migration checks, responsive browser checks and automated accessibility scans.

These tests are useful regression checks. They do not replace a production security assessment, a review of Google account permissions or a verified backup-restore exercise.

For operational data handling, see docs/PRIVACY-OPERATIONS.md. For the active runtime and its API, see docs/API.md.
