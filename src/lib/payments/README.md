# payments

## Purpose

The two payment-method kinds vendors can configure, and how a checkout view
is derived from whichever kind is set. Neither file does I/O — both are pure
builders, kept that way since paykit never touches funds and there's nothing
to await here.

## Contents

- `paynow.ts` — `crc16` (CRC-16/CCITT-FALSE over UTF-8 bytes, matching what
  a QR scanner computes) and `buildPayNowPayload`: the EMVCo Merchant-
  Presented QR payload builder for PayNow. Ported verbatim from qkit's own
  `docs/superpowers/specs/2026-06-28-qkit-payments-seam-design.md` — do not
  reintroduce a qkit-local copy; qkit now calls Paykit for checkout.
- `adapter.ts` — `renderCheckout(config, ctx)`: given a
  `VendorPaymentConfig`, returns a `CheckoutView` discriminated on how the
  customer should pay — `{type:"qr"}` (built PayNow payload) for `kind:
"paynow"`, `{type:"link"}`/`{type:"image"}` for `kind: "pointer"`
  (whichever of `url`/`qr_image_url` is set). `autoVerify()` is a reserved-
  but-dark stub — throws unconditionally; do not wire it to a real
  provider (see root `AGENTS.md`).
- `provider.ts` — `PaymentProvider` interface, the `direct` provider
  (wraps `renderCheckout`), and `getProvider()` (reads `PAYKIT_PROVIDER`,
  defaults/falls back to `direct`). The seam a future real gateway
  provider plugs into — see the root `AGENTS.md` and
  `docs/superpowers/specs/2026-08-13-paynow-tap-to-pay-design.md` (qkit
  repo) for why.

## Connectivity

`renderCheckout` is called through `provider.ts`'s `directProvider` — the
checkout route calls `getProvider().createCheckout(...)`, not
`renderCheckout` directly, so a future non-default provider needs no route
change. `buildPayNowPayload`/`crc16` are only reached through
`renderCheckout` for `kind: "paynow"`, but are exported directly for their
own unit tests.

Test fixtures build a `VendorPaymentConfig` without a `plan`: the plan moved to
the merqo entitlement cache (`paykit.vendor_entitlements`) and is not part of
the config row any more.

## Parent

[lib](../README.md)

`provider.ts` keeps `ProviderCheckoutStatus` module-private; only `PaymentProvider` and its input types are exported.
