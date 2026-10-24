# config

## Purpose

Payment method setup — a vendor picks between a generated PayNow QR or their
own BYO payment link/QR image, and saves it as their `vendor_payment_config`.

## Contents

- `page.tsx` — server component: loads the vendor's current config, renders
  `PaymentConfigForm`. Content sits in a plain `mx-auto max-w-lg` div (not
  `<main>` — the parent `dashboard/layout.tsx` owns that landmark and the
  page-family's canonical `max-w-7xl` outer width); a form this size reads
  better narrower than the full dashboard width.
- `pointer-presets.ts` — pure data module for the BYO preset picker: the
  `POINTER_PRESETS` catalogue (Stripe Payment Link, HitPay Payment Link,
  PayLah! QR, Other/Custom), `POINTER_PRESET_ORDER`, and
  `derivePointerPreset()` — a best-effort re-derivation of which preset an
  existing saved `pointer` config likely came from, used to pre-select the
  picker on edit. UI-only: no preset ID is persisted, see
  `docs/superpowers/specs/2026-08-14-paykit-byo-preset-directory-design.md`.
- `payment-config-form.tsx` — client form: radio-toggles between PayNow/BYO
  `kind`; for BYO, a `pointer-presets.ts` card picker drives which mode
  (link vs QR) is locked, what pre-fills the label, and which "where to
  find this" instructions/URL-shape warning render, before falling through
  to the same link input or `@merqo/ui` `ImageUploader` (wired through
  `uploadPaykitImage`/`resizeToWebp` from `src/lib/`, `imageComponent={Image}`,
  `variant="thumb"`) as before; live-previews the generated PayNow QR for
  the `paynow` branch.
- `payment-config-form.dom.test.tsx` — RTL/jsdom coverage of both `kind`
  branches, the preset picker, and the save flow.
- `pointer-presets.test.ts` — unit coverage for every preset's `urlPattern`
  (where present) and `derivePointerPreset()`'s Stripe/HitPay/fallback
  branches.
- `page.dom.test.tsx` — awaits `ConfigPage()` directly and renders the
  result (same pattern as `dashboard/layout.dom.test.tsx`), with
  `PaymentConfigForm` stubbed so the test stays focused on `page.tsx`'s own
  job: fetching the vendor + config and passing them through as props.
- `actions.ts` — `saveConfigAction`: validates + persists the form via the
  vendor-scoped RLS client. Persists with an explicit select-then-
  insert-or-update, not `.upsert()`: PostgREST's `ON CONFLICT DO UPDATE`
  path requires table-level `UPDATE` privilege regardless of column-level
  grants, but `vendor_payment_config`'s `UPDATE` grant is deliberately
  column-scoped to exclude `plan` (a vendor must never self-escalate to
  Pro) — `.upsert()` failed permission checks on every save as a result.
- `actions.test.ts` — unit coverage for both config kinds, validation
  failures, and the insert-vs-update branch.

## Deferred QR upload

`payment-config-form.tsx` passes `deferUpload` to its QR `ImageUploader`, so
a picked image is previewed from a local `blob:` URL and nothing is uploaded.
Its `useActionState` action commits a pending QR with `commitPendingImages`
before calling `saveConfigAction`, swapping the preview URL in the form data
for the public URL. An upload failure stops the save; an upload or save
failure deletes what uploaded (`removeUnsavedImages`). Covered by
`payment-config-form.qr.dom.test.tsx`, which also pins the bucket:
`vendor-images`, the one paykit's own pages use. A payment QR is never
uploaded to a calling kit's bucket from here.

## Way back to the calling app

Another Merqo app can link here as `/dashboard/config?return_to=<address>`
(qkit's booth form does). `page.tsx` passes the value through
`familyReturnUrl` (`src/lib/return-to.ts`) and hands the form either the
checked address or null. After a successful save the form shows a "Back to
your booth" link to it, beside "Saved.". Nothing is shown before a save,
after a failed one, or for an address outside the Merqo family, and the page
never redirects by itself. A vendor who is not signed in is sent to the login
page first and arrives without `return_to`.

## Replaced QR-image cleanup

`saveConfigAction` reads the previous `qr_image_url` alongside its existence
check and, only after the write succeeds, deletes the image the save replaced
or cleared (switching to PayNow clears it) with `removeReplacedQrImage` from
`src/lib/qr-image-cleanup.ts`. It deletes with the vendor-session client, so
the bucket's owner-folder DELETE policy applies too. A failed save deletes
nothing.

## Shared package note

The BYO payment-QR upload's resize step now calls `@merqo/ui`'s `resizeToWebp` (v0.31.0). `payment-config-form.tsx` still renders its live preview QR with `react-qr-code`, not `qrSvg` — the preview payload is derived from form state, and `qrSvg` is async and server-only.

## Tab title

`page.tsx` exports `metadata.title = "Payment setup"`, which the root layout's `%s | Paykit` template turns into "Payment setup | Paykit". `src/app/page-titles.test.ts` checks it.

## Parent

[dashboard](../README.md)

`radio-option-card.tsx` shares the two pickers' label/control shell while retaining separate kind/preset state and compact preset spacing.

The config read lists its columns (`CONFIG_COLUMNS`).
