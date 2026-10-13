# checkout

## Purpose

`POST /api/v1/checkout` — a calling kit requests a checkout QR/payment
pointer for a vendor's transaction. `GET /api/v1/checkout?order_ref=` — a
calling kit looks up its own existing transaction for an order reference.
Both are bearer-secret authenticated (`verifyKitAuth`).

## Contents

- `route.ts` — `POST`: validates the request body against
  `checkoutRequestSchema`, verifies the caller's bearer secret, then calls
  `@/lib/checkout`'s `createCheckout()` — the shared insert-a-`transactions`-
  row-and-render-the-checkout-view path (PayNow QR or BYO pointer, via
  `getProvider().createCheckout(...)`, see `src/lib/payments/README.md` for
  the provider seam itself), also used directly by the dashboard's own
  booking deposit/balance actions (`dashboard/bookings/actions.ts`), which
  don't go through this HTTP route. Idempotent on `(kit_slug, order_ref)` —
  a retried call with the same pair (Postgres unique-constraint violation
  on insert) reads back and returns the existing transaction instead of
  creating a duplicate. The existing vendor, amount, checkout kind and payload
  must match; a conflicting reuse fails instead of returning another checkout.
  The body may carry `expires_at`, an ISO 8601 time with an offset no more
  than 7 days ahead: when the calling kit gives up on the order. It is stored
  on a new checkout only (a replay keeps the first value) and both `GET`s
  return it, `null` when the kit sent none. It is for matching a detected
  payment and never stops a person claiming or confirming. A time already
  past is accepted.
- `route.test.ts` — covers a fresh checkout, the idempotent-retry path
  (same `(kit_slug, order_ref)` returns the same transaction, no duplicate
  row), and the 503 case where the idempotent re-read itself fails.
- `route.ts` — `GET ?order_ref=`: finds the calling kit's transaction for one
  of its own order references and returns its status, the `vendor_id` that owns
  it, and the checkout view stored at creation (`view`, null when an old row's
  display kind cannot be proven). The `vendor_id` lets the calling kit confirm
  the transaction belongs to the vendor it is acting for, a check `POST`'s
  replay already enforces for a create. Scoped to the bearer's `kit_slug`, so
  one kit can never read another kit's transaction by guessing a reference.
  Read-only: it never
  creates a transaction and never re-renders from the vendor's current
  config, which is what lets a kit confirm or claim an order after the vendor
  edits their payment details.
- `route.lookup.test.ts` — the `GET` handler: the response shape, the
  `kit_slug` filter, 400 for a missing, blank or over-long `order_ref`, and
  401, 404, 429 and 503.
- `[id]/` — sub-routes for claiming/unclaiming/confirming a specific
  transaction. `claim` moves `pending`→`claimed` (customer tapped "I've
  paid"); `unclaim` reverts `claimed`→`pending` (undoes an accidental tap) —
  it is always a no-op on an already-`confirmed` transaction, so a real
  payment can never be un-confirmed; `confirm` moves to `confirmed`
  (vendor confirmed receipt). Every real transition here (including this
  route's own `checkout_created`) writes a `payment_audit` row via
  `@/lib/payment-audit`'s `recordPaymentAudit` — a no-op/idempotent request
  writes nothing, see `src/lib/README.md`. Every route here (this one
  included) is also rate-limited (`@/lib/rate-limit`, 60 requests/60s per
  `kit_slug`+IP) right after auth, before any DB read.
- `[id]/evidence/` — `GET`: what paykit holds as evidence for one of the
  calling kit's transactions. `claim` may carry the customer's payment
  screenshot; this is how the kit reads it back. See its own README.

## Parent

[v1](../README.md)
