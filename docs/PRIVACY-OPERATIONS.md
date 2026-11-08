# Privacy and data operations

This guide describes the information the booking system handles and how the salon should look after it. It is an operational reference, not legal advice. The salon owner still needs to confirm the applicable privacy notice, contact details and data-retention rules.

## Where data is stored

The live application uses a Google Spreadsheet owned by the account that deploys Apps Script. The spreadsheet should remain private.

GitHub Pages serves the website files; it does not store customer bookings. The active application does not send booking records to GitHub Actions or Cloudflare. The old Cloudflare D1 files and database belong to an earlier deployment path and are not used by the current booking flow.

## Information the application handles

| Information | Why it is needed | Where it is kept |
|---|---|---|
| Customer name and phone | Identify and contact the customer about the appointment | Bookings sheet |
| Optional booking note | Give the salon context for the appointment | Bookings sheet |
| Service, date, time, duration and status | Manage availability and the appointment | Bookings sheet |
| Booking reference | Let the customer identify the appointment | Bookings sheet and customer confirmation |
| Customer management credential | Allow the customer to look up or cancel a booking | Only its hash is stored by the backend; the value is shown once |
| Owner account information | Let the manager sign in | AdminUsers sheet |
| Owner session identifier | Keep the manager signed in | Hashed identifier and expiry in AdminSessions |
| Manager push registration | Deliver notifications to a registered browser/PWA | PushSubscriptions sheet |
| Management and booking events | Help the owner review changes | AuditLog sheet |

The public website should show only the information needed to make a booking. Customer lookup does not return the customer's phone number or name.

## Data minimisation

- A customer provides a name and phone number; the note is optional.
- The customer management credential is returned once and should be kept private.
- Public responses do not expose customer contact details.
- Audit entries should record the action and relevant operational context, not customer notes or plaintext credentials.
- Do not add payment details, identity documents, health information or marketing fields without a separate business reason and an owner review.

## Decisions the owner still needs to make

These items are not set by the application and must not be guessed in code or documentation:

| Decision | Current status |
|---|---|
| Business jurisdiction | Needs owner confirmation |
| Privacy contact for customer requests | Not yet supplied |
| Privacy notice and applicable legal basis | Needs owner/legal review |
| Retention of completed and no-show bookings | Not decided |
| Retention of cancelled or abandoned bookings | Not decided |
| Retention of audit and security records | Not decided |
| Spreadsheet access list | Owner should review |
| Backup location and access list | Not decided |
| Backup expiry and deletion schedule | Not decided |

There is no automatic booking-deletion job. Do not add one until the owner has approved the retention rules.

## Backups and exports

A spreadsheet export contains customer information. Treat it as private business data.

1. Sign in to the Google account that owns the Apps Script project.
2. Open the salon spreadsheet from the owner's Drive.
3. Use File → Download to export the required sheets.
4. Store the file somewhere access-controlled and encrypted.
5. Keep an export record with the operator, date, purpose and checksum. Do not include customer details in the record.
6. Check that the export opens and contains the expected tabs.

Do not commit spreadsheet exports, booking screenshots or customer records to GitHub. Do not attach them to support messages or chat.

## Customer data requests

Verify the requester's identity and the exact appointment before viewing or exporting any record. Share only the fields needed to answer the request, and use an owner-controlled location. Follow the salon's approved business process for recording the request.

## Retention and deletion

Before deleting a booking or customer record:

1. Confirm the request and the exact record.
2. Check the approved retention rules and any business or legal hold.
3. Make a private backup.
4. Remove only the approved records.
5. Check that customer lookup no longer returns the deleted appointment.
6. Record the operator, date and scope without copying the deleted personal information into the audit note.

The application does not purge bookings automatically.

## Older Cloudflare data

Cloudflare Worker and D1 files are kept in this repository for historical reference and recovery. They are not connected to the live Apps Script system, and there is no automatic D1-to-Sheets import.

Do not delete the old Cloudflare database or exports until the owner confirms that any historical records have been retained or are no longer needed.
