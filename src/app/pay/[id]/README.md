# [id]

## Purpose

`/pay/{transaction_id}?k=<token>`: where a calling kit sends its customer to
pay. A kit gets the link from `POST /api/v1/checkout` (`return_url`, `title`,
answer `pay_url`). The page shows the amount, the kit's title and the
payment code, takes the payment screenshot and the "I've paid" claim, and
sends the customer back to the `return_url`.

## Authorization

There is no sign-in. The `k` token is the whole authorization, and
`@/lib/hosted-pay`'s `loadHostedPayment` checks it on every read and action:
the stored sha256 is compared in constant time. A missing, malformed or wrong
token, an unknown id and a transaction with no pay page all answer the same 404. The browser is sent the amount, title, status, payment code and return
address and nothing else: no vendor id, order reference, kit name or hash.

## Contents

- `page.tsx` — the server page. Rate limits the view by address and token, reads the payment, and shows the panel while it is `pending`. A `claimed` or `confirmed` payment goes straight to the return address (or says it is recorded when there is none). `noindex` and `no-referrer`.
- `pay-panel.tsx` — the client panel: the title and amount, the code (a PayNow QR with "Save QR image", the vendor's own QR image, or a payment link button), the screenshot picker (resized in the browser, then checked against the same type and size limits as the server), and "I've paid". Polls the status every 5 seconds, so a payment confirmed from elsewhere moves the customer on.
- `actions.ts` — `claimHostedPayment` and `getHostedPaymentStatus`, the page's whole write and read surface. Each checks its arguments, rate limits by address then token, and reads the payment by token. The claim requires exactly one screenshot (`@/lib/proof-file`'s `readProofFile`) and runs `@/lib/claim`'s `claimTransaction`, so it stores the screenshot before the claim commits and a failure leaves the transaction pending.
- `leave.ts` — `leaveTo(url)`, the full-page navigation to the return address, in its own module so a test can replace it.
- `qr-image.ts` — `renderSvgToPngBlob`, for "Save QR image".
- `*.test.ts(x)` — actions, page and panel tests.

## Connectivity

`next.config.ts` allows a 2 MB server-action body here, sets
`Referrer-Policy: no-referrer` and `X-Robots-Tag` on `/pay/*`, and traces the
OCR files into this route, because a claim made here schedules the same
amount check as the claim endpoint.

## Tab title

`page.tsx` exports `metadata.title = "Pay"`, which the root layout's `%s | Paykit` template turns into "Pay | Paykit". `src/app/page-titles.test.ts` checks it.

## Parent

[pay](../README.md)
