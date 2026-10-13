# `GET /api/v1/checkout/{id}/evidence`

What paykit holds as evidence for one transaction. Today that is the payment
screenshot a calling kit attached to the claim (`../claim`).

```
200 { proof_url: string | null,
      signals: {
        duplicate_of: { order_ref, kit_slug } | null,
        amount_match: boolean | null
      } }
```

- `proof_url` is a signed link to the screenshot in the private
  `paykit-payment-proofs` bucket. It expires after 300 seconds, so the
  response is sent with `Cache-Control: no-store`. `null` when the transaction
  has no screenshot.
- `duplicate_of` is the oldest other transaction of the same vendor, in any
  kit, whose screenshot is the same file (same sha256). The calling kit can
  resolve `order_ref` itself when `kit_slug` is its own.
- `amount_match` says whether the transaction's amount was read in the
  screenshot. The check runs just after the claim answers, so it is `null`
  for the first second or two, and stays `null` when the image could not be
  read.

Both signals are hints for a person. Nothing here changes a transaction's
status.

Bearer-secret (`verifyKitAuth`), rate-limited (`evidence:{kit_slug}:{ip}`,
60/60s), path-param UUID validation. The transaction is read by id and by
the calling kit's slug, so a kit gets 404 for another kit's transaction.
401, 429, 400, 404, and 503 when the transaction or its evidence cannot be
read.

## Contents

- `route.ts` — the handler. The work is in `@/lib/payment-evidence`'s
  `loadCheckoutEvidence`.
- `route.test.ts` — the response shape and header, the id and `kit_slug`
  filter, the rate-limit key, and each error answer.

## Parent

[checkout](../../README.md)
