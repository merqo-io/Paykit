# config

## Purpose

`GET`/`POST /api/v1/vendors/{vendor_id}/config` — a calling kit reads a
vendor's full payment config (so it can pre-fill its own edit form on
re-open), or writes one on the vendor's behalf. Bearer-secret authenticated
(`verifyKitAuth`), service-role — not the vendor-session RLS path the
dashboard's own config form uses.

## Contents

- `route.ts` — `GET`: returns the full `vendor_payment_config` row —
  `{ has_config, display_name, kind, payee_name, uen, mobile, label, url,
qr_image_url }` — so a calling kit can pre-fill its own edit form; every
  field is `null`/`false` when no config exists yet. `POST`: validates the
  body against `vendorPaymentConfigInputSchema` (the same paynow|pointer
  schema the vendor dashboard's own config form uses) and upserts
  `vendor_payment_config` by `vendor_id`, letting a kit without its own
  vendor-session UI (e.g. a "quick add PayNow details" flow) write the
  config server-to-server.
- `route.test.ts` — covers both methods' auth/validation/upstream-failure
  paths and the full GET response shape for paynow, pointer, and
  unconfigured vendors.

## Replaced QR-image cleanup

`POST` reads the previous `qr_image_url` before its upsert and, only after the
upsert succeeds, deletes the image the write replaced or cleared with
`removeReplacedQrImage` from `src/lib/qr-image-cleanup.ts`. This is the path
qkit's booth Payment section saves through, so its `booth-images` uploads are
covered too. The route deletes with the service-role client, so the helper
refuses any object outside `{vendor_id}/`. A failed upsert deletes nothing.

## Parent

[vendors](../../README.md)

`POST` builds the stored row with `paymentConfigRow` (`@/lib/payment-config-row`), the same builder the dashboard save action uses; `GET` fills the response from the row, or from an all-null default when the vendor has none.
