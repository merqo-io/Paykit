# `POST /api/v1/checkout/{id}/unclaim`

Reverts a `claimed` transaction back to `pending` — undoes an accidental
"I've paid" tap. Same auth/shape family as the sibling `claim`/`confirm`
routes (`../claim/route.ts`, `../confirm/route.ts`): bearer-secret
(`verifyKitAuth`), path-param UUID validation, and the guarded-update-with-
recheck-fallback pattern.

Idempotent and provably safe: `unclaimTransition` (`src/lib/tx-state.ts`)
only transitions from `claimed`; a `confirmed` transaction is never
reverted, and the response just echoes the unchanged `confirmed` status
back so the caller can detect "too late to undo."

Response shape is the same `TransactionStatusResponse` `claim`/`confirm`
already return (`src/lib/api-schemas.ts`'s `toStatusResponse`).

A real (non-idempotent) unclaim writes an `unclaimed` `payment_audit` row
(`@/lib/payment-audit`). Rate-limited (`@/lib/rate-limit`, 60/60s per
`kit_slug`+IP) right after auth.

A real transition also schedules one payment-status callback to the kit that
owns the transaction (`@/lib/kit-callback`), sent after the response. An
idempotent no-op, a lost race and every error path send none, and a failed
or missing callback never changes this route's answer.

## Boundary and coverage

The transaction lookup and guarded write both include the authenticated kit slug as well as the transaction ID. Rate-limit failures prevent mutation, and confirmed state remains unchanged. Tests assert ownership predicates and race fallback behavior.
