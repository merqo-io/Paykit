# bookings

Vendor-owned event bookings link a deposit checkout and a later balance checkout.
The database's `sync_booking_status` trigger derives payment progress from
confirmed transactions. Cancellation preserves linked transaction state; it does
not reverse a payment. Due reminders are dashboard badges, not scheduled sends.

## Actions and recovery

`actions.ts` validates amounts/dates and creates the booking through the vendor
session. Deposit creation uses the stable `booking:<id>:deposit` reference.
A checkout or link failure preserves the saved booking and asks the vendor to
retry from its detail page; no compensating booking deletion occurs.
`deposit-actions.ts` and `[id]/recover-deposit-button.tsx` provide that retry.
Service-role link RPCs receive the verified vendor, booking and transaction IDs.
Balance creation follows the analogous guarded `link_booking_balance` path.

Cancellation and rescheduling first read the booking under vendor RLS. Cancel
may also request Pro-gated refund bookkeeping; a failed refund does not undo the
cancellation and is reported separately. Rescheduling updates dates without
inventing a new payment state. Audit helpers live in `lib/admin-audit.ts`.
Peer-kit checkout transitions use the separate `payment_audit` trail.

## Inquiries

Clients reach a vendor through the public form at `/inquire/{public_id}`
(`src/app/inquire/`). `inquiry-form-settings.tsx` creates or edits the
vendor's `inquiry_forms` row (business name, optional terms link and
version, on or off) and copies the public link. `inquiry-actions.ts` holds
`saveInquiryFormAction` (update first, insert when there is no row: an
upsert would write `vendor_id`, which has no update grant),
`setInquiryStatusAction` (contacted or declined, never a converted row) and
`deleteInquiryAction`, all under the vendor session. `inquiry-table.tsx`
lists open inquiries with `inquiry-badges.tsx`'s status badge ("Inquiry"
for a new one); `TermsSnapshot` shows what the client accepted.

Converting: the inquiry page opens `NewBookingDialog` prefilled and with a
hidden `inquiry_id`. `createBookingAction` saves the booking as usual, then
calls `linkInquiryToBooking` (`src/lib/inquiry-link.ts`, service role,
vendor-matched on both rows). A failed link never loses the booking. The
booking detail page shows the terms acknowledgment of the inquiry it came
from.

## Views

`page.tsx` renders the Inquiries section (settings, inquiry table) above
`booking-table.tsx`, and `new-booking-dialog.tsx`, which also takes an
optional `prefill` and `triggerLabel` for converting an inquiry.
The table is a client adapter for shared `DataTable` callbacks. The creation
form derives balance until the vendor edits it; the server always validates
that deposit plus balance equals total. `booking-badges.tsx` shares status and
due indicators with the detail view.

`[id]/` displays payment instructions, deposit recovery, balance creation,
cancel/reschedule, copy-ID and print controls. The booking ID is the value a
vendor can paste into qkit's booth settings.

## Verification

Tests cover scoped reads, validation, retained-booking recovery, guarded links,
returned/rejected failures, cancellation/refund outcomes and dialog behavior.
Mocked action tests do not establish database RLS, locking or trigger behavior.

## Tab title

`page.tsx` exports `metadata.title = "Bookings"`, which the root layout's `%s | Paykit` template turns into "Bookings | Paykit". `src/app/page-titles.test.ts` checks it.

## Parent

[dashboard](../README.md)

Booking amount conversion uses `dollarsToCents` from `@/lib/money`; the action keeps its existing schema validation and rounding behavior.

`actions.ts` keeps each action short with helpers: `linkDepositCheckout` (deposit checkout plus link), `linkSourceInquiry` and `recordCancellationRefund`.
