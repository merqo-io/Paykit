# booking detail

`page.tsx` reads the vendor-owned booking and its linked transactions, returns
404 for missing/inaccessible records, and renders payment and booking controls.
Next 16 route params are asynchronous.

When the booking was converted from an inquiry, the details list adds
"Booking terms" with the client's acknowledgment (`getInquiryForBooking`).

## Payment display

The page renders server-generated QR markup only for QR checkouts and passes
that string to the synchronous `transaction-status-card.tsx`. Persisted
`checkout_kind` and `checkout_label` preserve the original link/image identity;
links remain links and uploaded QR images remain images. Unknown older pointer
checkouts show an unavailable-instructions message instead of guessing their
original display type. A displayed instruction is not payment verification.

## Controls

- `recover-deposit-button.tsx` retries deposit setup for a saved booking whose
  initial checkout or guarded link failed.
- `create-balance-checkout-button.tsx` requests the balance after deposit setup,
  while no balance is linked.
- `cancel-booking-dialog.tsx` allows cancellation and optional refund bookkeeping.
  Its refund field appears when exactly one linked transaction is confirmed;
  otherwise refunds remain available from the transaction page.
- `reschedule-booking-dialog.tsx` edits event and balance-due dates.
- `copy-booking-id-button.tsx` copies the identifier for qkit booth linking.
- `print-booking-button.tsx` prints the summary; action controls are print-hidden.

Cancelled bookings hide mutation controls. Every action revalidates its inputs
and ownership; visibility is not authorization. Dialog tests cover successful
close/reset and failed-submit retention. Page/display tests cover missing rows,
control eligibility, checkout kinds and legacy fallback.

## Tab title

`page.tsx` exports `metadata.title = "Booking"`, which the root layout's `%s | Paykit` template turns into "Booking | Paykit". `src/app/page-titles.test.ts` checks it.

## Parent

[bookings](../README.md)
