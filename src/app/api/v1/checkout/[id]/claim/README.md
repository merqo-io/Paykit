# `POST /api/v1/checkout/{id}/claim`

Moves a `pending` transaction to `claimed` — the customer tapped "I've
paid." Bearer-secret (`verifyKitAuth`), path-param UUID validation, and a
guarded update (`WHERE status = 'pending'`) with a recheck-and-return-
current-state fallback if a concurrent request already changed it — never
a 4xx/5xx just because two requests raced.

Idempotent: already-`claimed`/`confirmed` is a no-op, echoing the current
status back.

A real (non-idempotent) claim writes a `claimed` `payment_audit` row
(`@/lib/payment-audit`). Rate-limited (`@/lib/rate-limit`, 60/60s per
`kit_slug`+IP) right after auth.

Response shape is the shared `TransactionStatusResponse`
(`src/lib/api-schemas.ts`'s `toStatusResponse`).

A real transition also schedules one payment-status callback to the kit that
owns the transaction (`@/lib/kit-callback`), sent after the response. An
idempotent no-op, a lost race and every error path send none, and a failed
or missing callback never changes this route's answer.

## Boundary and coverage

The transaction lookup and guarded write both include the authenticated kit slug as well as the transaction ID. The rate limiter runs before mutation and fails closed on an unavailable limiter. Tests assert the predicates and ensure a calling kit cannot claim another kit transaction.

## Payment screenshot

The body is optional. A request that is not `multipart/form-data` (no body, or JSON) is the plain claim above. A multipart request must carry exactly one `proof` file: JPEG, PNG or WebP by its first bytes, more than 0 bytes and at most 1 MB. Anything else is 400, or 413 when too large, before the transaction is read.

The file is stored before the claim commits (`@/lib/payment-evidence`'s `storeScreenshotEvidence`): if paykit cannot store it the answer is 503 and the transaction stays as it was, so the caller can retry. A screenshot sent for an already-`claimed` transaction replaces the earlier one; one sent for a `confirmed` transaction is ignored, so evidence a vendor confirmed against never changes. The caller reads it back with `GET ../evidence`.
