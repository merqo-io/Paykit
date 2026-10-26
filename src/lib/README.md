# lib

Shared payment logic, database access and boundary validation. Route handlers and
server actions provide caller identity; database grants, RLS and constrained RPCs
provide authorization.

## Contracts

- `schemas.ts` validates dashboard forms and actions; `api-schemas.ts` validates
  the peer-kit API. Monetary values are integer cents. `types.ts` mirrors the
  migration schema and RPC signatures.
- `checkout.ts` creates and renders a transaction through `payments/provider.ts`.
  A replay of the same kit and order reference must match the vendor, amount,
  checkout kind and payload; a conflicting replay fails. A new checkout
  stores the caller's optional `expiresAt`; a replay keeps the first.
  `checkout-kind.ts`
  reads persisted display identity without guessing an unknown legacy pointer.
- `checkout-lookup.ts` — `toLookupResponse(row)`: maps a `transactions` row to
  the `GET /api/v1/checkout?order_ref=` wire shape, building `view` from the
  stored snapshot through `checkoutKind`, and passes `vendor_id` and
  `expires_at` through. Also holds the fallback label for a link
  stored without one.
- `tx-state.ts` defines claim, unclaim and confirm transitions. Confirmation
  cannot be undone by unclaim. Routes use conditional writes and re-read a
  concurrent winner; returned or rejected write failures are not success.
- `kit-auth.ts` verifies peer-kit bearer secrets, records failures without logging
  credentials and touches last-use metadata best-effort. Ambiguous duplicate
  active keys fail closed. `merqo-auth.ts` separately authenticates hub metrics
  and provisioning routes.
- `proof-file.ts` — the payment screenshot a kit may attach to a claim:
  `PROOF_BUCKET`, `PROOF_MAX_BYTES`, `sniffImageType(bytes)` (JPEG, PNG or
  WebP by the file's first bytes, never by the declared type) and
  `readProofFromRequest(request)`, which returns no proof for a request that
  is not multipart, and a 400 or 413 for a bad one. `readProofFile(file)`
  applies the same checks to a file already in hand (the pay page's server
  action). No database access.
- `payment-evidence.ts` — `storeScreenshotEvidence(supabase, tx, proof)`
  uploads to `{vendor_id}/{transaction_id}` and upserts the transaction's
  one `payment_evidence` row; it returns false on any failure and the claim
  route then refuses the claim. `loadCheckoutEvidence(supabase, tx)` builds
  the evidence response: a 300-second signed link, the oldest other
  transaction of the same vendor with the same hash, and `amount_match`
  from the row's `detail` (null until something writes it).
- `proof-ocr.ts` — `recognizeText(image, mode)`: reads the text out of an image
  with Tesseract in this process, using the repo's own `ocr-data/` language
  file. `mode: "highContrast"` reads a copy enlarged to 3200px with its
  contrast stretched (`sharp`) as sparse text, which is what reads PayLah's history screen
  (large amount, small raised cents). Stops its worker when done, on failure, and after 20 seconds. Its
  bare imports of `bmp-js`, `zlibjs`, `wasm-feature-detect` and
  `tesseract.js-core` are deliberate: the worker thread loads them by name,
  and the imports are what put them in the deployed function.
- `proof-amount-check.ts` — `amountInText(text, cents)` (pure: the amount as
  a complete two-decimal figure, so `5.50` is not found inside `15.50`),
  `amountInRaisedCentsText(text, cents)` (the same, also taking a dash for the
  point, as the high-contrast read returns "8-50"; never a dash inside a date),
  `checkProofAmount(supabase, tx, proof)` (reads the screenshot, falls back to
  the high-contrast read when the plain read finds no amount, and writes
  `detail.amount_match` on the evidence row matched by transaction and file
  hash; writes nothing when the image cannot be read) and
  `scheduleProofAmountCheck(...)`, which runs it with `after()` once the
  claim's response is sent.
- `pay-token.ts` — the hosted pay page's token: `mintPayToken()` (32 random
  bytes as 43 base64url characters, with the sha256 hex to store),
  `hashPayToken`, `payTokenMatches(token, storedHash)` (constant time; false
  for no stored hash), `payTokenSchema` (the shape check) and `payTokenKey`
  (a prefix of the hash, used in rate-limit keys so the token itself is never
  written there).
- `return-url.ts` — `kitReturnUrl(raw, registeredOrigin)`: the address a pay
  page may send a customer back to, or null. Compared as parsed origins
  against the kit's `return_origin`, never as text; no credentials, https
  only (http on localhost outside production), at most 2000 characters. It
  returns the parsed URL's own serialisation.
- `claim.ts` — `claimTransaction(supabase, row, proof, audit)`: the claim
  itself, for the endpoint and the pay page alike. Stores the screenshot
  before the claim commits, moves `pending` to `claimed` with a guarded
  update, writes the audit row and schedules the callback and the amount
  check. An already claimed or confirmed transaction is answered as it
  stands.
- `hosted-pay.ts` — `loadHostedPayment(supabase, id, token)`: the one read of
  a transaction on a caller's say-so alone. Not found for a bad id or token,
  an unknown id, a transaction with no pay page or another token; the same
  answer for all, and the payment it returns carries no vendor id, order
  reference or kit name. `hostedPayAllowed` counts a page action per address
  and per token.
- `kit-callback.ts` — `notifyKitPaymentStatus(tx)` posts
  `{ order_ref, transaction_id, status }` to the `callback_url` of the kit
  that owns the transaction (`transactions.kit_slug`), with
  `Authorization: Bearer <callback_secret>`, both read from `kit_api_keys`.
  Best effort: a kit with neither column set is skipped silently, a kit with
  only one set is skipped with a log line, an address that is not plain https
  (or carries credentials) is refused, the request is abandoned 5 seconds
  after it is sent and nothing is thrown. A request error is logged by name
  only, since its message can quote the secret. `schedulePaymentStatusCallback(tx)` registers it with
  `after`, so it runs once the response has gone out. The body is a hint: the
  receiving kit reads the status back with `GET /api/v1/checkout?order_ref=`.
- `inquiry-schemas.ts`: Zod for booking inquiries: `inquiryFormSettingsSchema`
  (business name, an `https://` terms link and version set together or not at
  all), `publicInquirySchema` (the public form; same limits as migration
  `0025`), `publicIdSchema` (16 lowercase hex) and `inquiryStatusUpdateSchema`
  (only `contacted` or `declined`; `converted` is set by conversion).
- `inquiries.ts`: the public form's server side, on the service client:
  `loadPublicForm(supabase, publicId)` (enabled forms only, null for anything
  else), `inquiryAllowed(supabase, ip, publicId)` (`INQUIRY_LIMITS`: 5 per
  address per 10 minutes, then 30 per form per hour; fails open with the
  limiter), `submitInquiry(supabase, form, input, now?)` (refuses
  `terms_required`, snapshots the terms from the server-read form, alerts
  after the insert), `MIN_FILL_MS` and `formRenderedAt()`.
- `inquiry-alert.ts`: `sendInquiryAlert(vendorId, name, eventDate)` posts to
  merqo's `POST /api/merqo/notify-vendor` with `MERQO_CUSTOMER_SECRET`; never
  throws, sends nothing without the secret. `inquiryAlertText` is plain text
  with no link, so a forged inquiry cannot put one in front of the vendor.
- `inquiry-inbox.ts`: vendor-session reads: `getInquiryForm`,
  `listOpenInquiries` (newest first, converted left out), `getInquiry`,
  `getInquiryForBooking`.
- `inquiry-link.ts`: `linkInquiryToBooking(vendorId, inquiryId, bookingId)`,
  `server-only`: marks an unlinked inquiry converted, on the service role,
  after checking the booking is the same vendor's. Kept out of the
  `"use server"` actions file so it is never callable from a browser.
- `phone-links.ts`: `whatsappLink(phone)`: a `wa.me` link, adding 65 to a
  bare 8-digit Singapore number.
- `rate-limit.ts` calls the database fixed-window limiter after authentication.
  Limiter failure permits the request and logs degradation; the forwarded IP is
  a fairness key, never authorization. Migration 0019 prepares the bounded atomic
  implementation. Pending migrations require real database validation.
- `payment-config-row.ts` builds the full `vendor_payment_config` row from a validated input, shared by the dashboard save action and `POST /api/v1/vendors/{vendor_id}/config`.
- `payment-audit.ts` appends real checkout transitions (`recordPaymentAudit(supabase, { transactionId, kitSlug, action, detail })`); idempotent no-ops add no
  transition row. `admin-audit.ts` records administrative and vendor operations
  without exposing its helper as a remotely callable Server Action.

## Reads and reports

`transactions.ts` and `bookings.ts` read vendor-owned records with the session
client. `read-all-rows.ts` follows ordered numeric ranges to an empty page and rejects
partial collections on later errors; it does not provide a transaction snapshot.
`list-all-users.ts` paginates auth users and reports its safety ceiling as failure.
`admin-data.ts` performs team-console service-role reads; callers must apply the
admin gate before invoking it.

`metrics.ts` and `merqo-vendor-activity.ts` derive hub payloads.
`merqo-vendor-status.ts` resolves a known auth user to that user's config.
`vendor-health.ts` owns triage bands. `revenue-report.ts` groups confirmed
transactions by day; `earnings-report.ts` groups booking revenue by event date,
falling back to transaction creation for unlinked checkouts. These are revenue
records, not profit or tax submissions. `earnings-csv.ts` escapes customer text
that could become a spreadsheet formula.

`booking-status.ts` provides dashboard-only due badges. `usage.ts` and
`plan-view.ts` derive the Free/Pro nudge and view, including the Free vs Pro
rows the plan page passes to `@merqo/ui`'s `PlanComparisonTable`; `pricing.ts` reads the
admin-configured price. Refund tracking is Pro-gated bookkeeping, not money
movement. Migration 0020 prepares serialized cumulative-refund enforcement;
mocked tests do not verify its database locking.

## Session and shared profile

`vendor-session.ts` establishes the vendor session and current legal acceptance.
`admin.ts` establishes team authorization. `legal-gate.ts` validates Merqo's
legal-status response and caches it briefly; lookup failures fail closed.
Sheet feedback/support actions use an inline session check to return an error
instead of redirecting an open dialog.

`merqo-rpc.ts` is the typed cross-schema RPC boundary used by shared profile,
feedback and support adapters. `merqo-vendor-profile.ts` uses field-specific
patches: omitted columns stay unchanged and empty social links clear links.
`tour-prefs.ts` contains best-effort onboarding timestamps.

## Storage and shared UI

`image-upload-adapter.ts` uploads images and contains best-effort cleanup.
`qr-image-cleanup.ts` accepts only supported public buckets and the current
vendor's object folder, including when called with the service-role client.
External URLs and other vendors' objects are never deletion targets.
Deferred QR uploads occur on Save; failed saves clean up unused uploads.
Uncertain network outcomes are not proof that a metadata write did not commit.
The config form uploads a QR image to `vendor-images`; `booth-images` stays in
the cleanup's list for images uploaded earlier through qkit's booth form.

`return-to.ts` holds `familyReturnUrl`, which decides whether a `return_to`
query value may be shown as a way back to another Merqo app: an https address
on `merqo.io` or a subdomain of it, with no credentials and no port (plus
http on localhost outside production). Anything else reads as no address.
It is separate from `@merqo/ui`'s `safeRedirectPath`, which accepts only a
path on this app.

Redirect validation and image resizing come from `@merqo/ui`; there are no
local `safe-redirect.ts` or `image-resize.ts` copies. `utils.ts` holds local
formatters and class composition; `brand-icon.tsx` supplies icon-route markup.
`env.ts` exposes required public configuration. The `supabase/` README explains
session/service client separation; `payments/` explains checkout builders.

## Parent

[paykit](../../README.md)

`money.ts` converts form dollars into integer cents for booking/refund actions; their schemas validate range and finite values. Empty/null form values retain the existing Number conversion to zero.

`security-headers.ts` holds the nonce route list and CSP source lists (including the Vercel toolbar origin outside production); `theme-props.ts` is shared by the root layout and the CSP; `columns.ts` lists the columns each table read selects; `admin.ts` also requires `aal2` in `requireAdmin()`.
