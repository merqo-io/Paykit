# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Reuse money conversion, radio cards, shared statistics and branding; remove six unused UI primitives and correct stale documentation.

### Security

- Adopt the immutable audited shared UI commit for upload lifecycle, storage URL validation and safe money parsing fixes; constrain its build permission to the locked source URL.

- Cap cumulative refunds at the confirmed payment amount in Postgres, serialize concurrent writes, and preserve refund identity and attribution.

- Restrict the rate limiter to trusted service callers, validate bounded parameters, and remove remaining destructive and schema privileges from audit writers.

### Added

- `GET /api/v1/checkout?order_ref=`: a calling kit can find its own
  transaction for an order without creating a checkout. It returns the status, the owning `vendor_id` and the stored checkout view.
- Playwright end-to-end smoke tests (`e2e/`, `pnpm test:e2e`): a public smoke spec and a signed-out auth-guard spec, run in CI as `e2e (public smoke)` against `pnpm dev` with dummy Supabase values. The job name and baseline match qkit, loopkit and merqo, so every kit can require the same check. `@playwright/test` is pinned to `1.61.1`.

### Changed

- The repository moved from the `cljiahao` GitHub account to the `merqo-io` organization. `@merqo/ui` now installs from `github:merqo-io/merqo-ui` at the same tag, with the lockfile and tarball URLs updated to match.
- The `secret scan (gitleaks)` CI job runs the pinned gitleaks release binary, verified against the release checksum, instead of `gitleaks-action`. The action is free only for personal-account repos and needs a paid license on organization-owned ones, so every run failed after the move to `merqo-io`. It scans the PR commits, or the pushed range on `main`.

### Fixed

- The UEN field now accepts only a UEN (9 or 10 characters ending in a check
  letter), optionally followed by the 3-character suffix PayNow Corporate
  allows, so an 8-digit mobile number can no longer be saved as a UEN.

- Improve small brand-text and input-boundary contrast in both themes while preserving primary button fills and decorative separators.

- Kit-key provisioning refuses duplicate slugs; replacing a live key now requires an explicit --rotate command.
- Preserve saved bookings after deposit checkout failures and provide a scoped recovery action; prepared migration0016 validates atomic linking and reconciles confirmed payments. Checkout retries reject conflicting identities or changed payment destinations, and best-effort authentication telemetry tolerates network rejection.
- Picking a QR image in the payment config form and leaving without saving no
  longer leaves the image in storage. The uploader now uses `@merqo/ui`
  v0.32.0's `deferUpload`: the image is previewed locally and only uploaded
  when the vendor clicks Save (`commitPendingImages`). If the upload or the
  save fails, the image it uploaded is deleted again (`removeUnsavedImages` in
  `src/lib/image-upload-adapter.ts`); `saveConfigAction` writes nothing when
  it fails, so the browser can delete it safely.
- Bumped `@merqo/ui` to `v0.32.0`.
- Replacing or clearing a pointer config's QR image no longer leaves the old
  image in storage. Both writers of `vendor_payment_config.qr_image_url`, the
  dashboard config form (`saveConfigAction`) and the kit API
  (`POST /api/v1/vendors/{id}/config`, which qkit's booth Payment section
  calls), now read the previous URL and, once the write succeeds, delete the
  image it stopped referencing via the new best-effort
  `removeReplacedQrImage` in `src/lib/qr-image-cleanup.ts`. It checks both
  `vendor-images` (paykit uploads) and `booth-images` (qkit uploads), ignores
  pasted external URLs, and only ever deletes inside the vendor's own folder,
  since the kit route deletes with the service-role client.
- Replacing or removing a profile icon no longer leaves the old image in storage.
  `ImageUploader` names every upload randomly and nothing ever deleted the object
  it replaced, so each change orphaned one file. The save handler now deletes the
  previous avatar after a successful save, and deletes the fresh upload after a
  failed one, via a new best-effort `removeReplacedAvatar` in
  `src/lib/image-upload-adapter.ts`. It checks all three public avatar buckets,
  since all five apps share one signed-in user and one `avatar_url`, and ignores
  OAuth provider pictures. A failed save also now restores the previous avatar
  instead of showing one that was never saved.
- Bumped `@merqo/ui` to `v0.31.4`, which adds `storagePathFromPublicUrl`.
- Bumped `@merqo/ui` to `v0.31.3`: where a browser cannot encode WebP,
  `canvas.toBlob` silently returns a PNG, which `resizeToWebp` had
  mislabelled `image/webp`. A PNG of a photo is several times larger than a
  JPEG, so image uploads on such browsers were stored larger than intended.
  It now falls back to JPEG and labels the result truthfully.
- `resizeToWebp` on a filename with no dot returned the whole name as the
  extension (a file called `photo` gave `ext: "photo"`). Fixed upstream in
  v0.31.1 and picked up here.

- `/dashboard/plan`, `/dashboard/profile`, and `/dashboard/reports/earnings`
  no longer 500. All three are Server Components that passed a function prop
  into a `@merqo/ui` component — `LinkComponent={Link}` on `BackButton` for
  the first two, `DataTable`'s `columns[].cell`/`getRowKey` on the earnings
  report. `@merqo/ui` is client-bannered package-wide, so those props
  crossed the Server → Client boundary, which Next rejects at render.
  `BackButton`'s `LinkComponent` is optional (plain `<a>` fallback) so it's
  dropped; the earnings tables moved into a new `earnings-tables.tsx`
  `"use client"` wrapper taking plain rows and building its own columns,
  mirroring `admin/vendors/vendors-table.tsx`. Same root cause as qkit's
  own production outage.

### Changed

- Bumped `@merqo/ui` to `v0.31.2`. v0.31.0 replaced the package-wide
  `"use client"` banner with per-module directives, so a plain-data export
  is a real value inside a Server Component rather than an opaque
  client-reference stub — the root cause of the 2026-09-18 RSC crashes.
- Adopted four primitives promoted into `@merqo/ui` v0.31.0, deleting the
  paykit copies: `safeRedirectPath` and `resizeToWebp` (were
  `src/lib/safe-redirect.ts` / `image-resize.ts`), `BackToTop` (was
  `src/components/landing/back-to-top.tsx`) and `GoogleMark` (was
  `src/app/login/google-mark.tsx`).
- The bookings and transactions tables now render through `@merqo/ui`'s
  shared `DataTable` instead of a local shadcn `Table`, joining the earnings
  and admin-vendors tables. Both became `"use client"` modules, since
  `columns[].cell` and `getRowKey` are functions that cannot cross the
  Server → Client boundary. The Pro-only Refund column is now appended to
  the column list rather than conditionally rendered per cell, so a Free
  vendor's table has no empty trailing column.
- Social-link fields now use `@merqo/ui`'s `SOCIAL_LINK_FIELDS`/
  `SocialLinksFields` instead of a paykit-local copy. paykit had kept plain
  lucide glyphs specifically to avoid taking on
  `@icons-pack/react-simple-icons`; the shared package carries that
  dependency itself, so the reason no longer holds. Visible change: the
  social inputs show real brand marks, matching the other four repos. Props
  are identical, so only the import moved.

- The booking detail page's deposit/balance QR codes now render through
  `@merqo/ui`'s shared `qrSvg` instead of a `"use client"` wrapper around
  `react-qr-code`. The page generates the markup server-side and passes it
  down as a plain string, so `react-qr-code` no longer ships to the browser
  on this route and `qr-code-view.tsx` is deleted. `react-qr-code` stays a
  dependency: `qrSvg` is async and server-only, so it cannot replace the QR
  in `dashboard/config/payment-config-form.tsx`, whose preview payload is
  derived live from form state. See `../merqo-ui/docs/usage-matrix.md`.

### Note

- The deposit/balance/refund amount fields in the bookings dialogs keep
  their raw `type="number"` inputs rather than adopting `MoneyInput`, for
  the same reason stockkit's unit-cost fields do: they parse and validate
  on submit, and `MoneyInput` is cents-based with commit-on-blur.

## [0.1.10] - 2026-09-16

### Fixed

- `/legal/terms` now shows only paykit's own Annex schedule, not every
  sibling kit's, via `@merqo/ui`'s new per-kit `getLegalDocSource`/
  `LegalDocument` scoping. `legal/accept/actions.ts`'s recorded
  `doc_sha256` now hashes that same scoped content.

### Changed

- Bumped `@merqo/ui` to `v0.30.0`.

## [0.1.9] - 2026-09-16

### Changed

- `BackButton`, `ElevatedCard`, and the landing `Footer` now come from
  `@merqo/ui` (bumped to v0.29.1) instead of a paykit-local copy — each
  was confirmed byte-for-byte or structurally identical to qkit's/
  loopkit's copies before promoting. `SOCIAL_LINK_FIELDS`/
  `SocialLinksFields` stay local: paykit's own version deliberately uses
  plain lucide glyphs instead of `@merqo/ui`'s brand-mark icons (a real,
  documented design choice, not drift), so it wasn't migrated.

### Fixed

- Bumped `@merqo/ui` to `v0.26.0` and switched `legal-gate.ts`/`legal/accept/
actions.ts` to import `LEGAL_VERSIONS`/`getLegalDocSource`/`isLegalCurrent`
  from its new `@merqo/ui/legal` subpath instead of the package root. Those
  are plain non-React functions, but the root export is bundled under a
  package-wide `"use client"` banner — calling them from server code (a
  Server Action, the server-only legal gate) threw "Attempted to call X()
  from the server but X is on the client". The gate's own fail-closed
  try/catch silently swallowed this, redirecting every vendor to
  `/legal/accept` instead of surfacing the real error.
- `merqoBaseUrl()`'s hardcoded fallback (`legal-gate.ts`, `legal/accept/
actions.ts`) pointed at `https://merqo-sg.vercel.app`, a stale host that
  404s on every route including `/`. Confirmed by direct curl that merqo's
  real production host is `https://www.merqo.io` (serves
  `/api/merqo/legal-accept`, `/api/merqo/legal-status`, and
  `/api/merqo/customer-connect-token` as expected). `MERQO_BASE_URL` was
  never set as an explicit Vercel env override on any kit, so this fallback
  has been hitting a dead host in production the whole time, not just for
  legal-accept but for any other kit-to-merqo call sharing the same
  fallback pattern. Fixed the literal here; the primary fix is still
  setting `MERQO_BASE_URL` explicitly in Vercel, this is defense-in-depth.

## [0.1.8] - 2026-09-09

### Security

- Adopt the immutable audited shared UI commit for upload lifecycle, storage URL validation and safe money parsing fixes; constrain its build permission to the locked source URL.

- Bumped `vitest` and `@vitest/coverage-v8` to `4.1.11` (from `3.2.6`).
  Clears GHSA-82fw-gwwq-j7x9 (`@vitest/mocker` path traversal / arbitrary
  file read, patched only in `4.1.11`). Also `fast-uri` to `4.1.4`, the `qs`
  override to `>=6.16.0`, and `baseline-browser-mapping` to `2.11.21`,
  clearing four high and three moderate advisories reaching in through
  `@stryker-mutator` and `@sentry/nextjs`. The dependency audit is now clean
  at every level. No test or config changes were needed for vitest 4.

## [0.1.7] - 2026-09-09

### Security

- Adopt the immutable audited shared UI commit for upload lifecycle, storage URL validation and safe money parsing fixes; constrain its build permission to the locked source URL.

- Bumped `next` to `16.3.4` (`eslint-config-next` to match) and refreshed
  `browserslist` to `4.28.9`. Clears two critical Next.js RCE advisories
  (GHSA-p293-qw3h-jr36, GHSA-2xp9-vwfh-vxw4), a high `sharp`/libheif
  advisory (`sharp` resolves to `0.35.4` via next), and two high
  `browserslist` advisories (GHSA-73wf-gq98-2v4g).
- Dropped `output: "standalone"` from `next.config.ts`. paykit deploys only
  to Vercel, which bundles functions itself and does not use the standalone
  output, and under `next` 16.3.x that config also made Vercel's build
  finalizer look for a server trace file it no longer writes there.

## [0.1.6] - 2026-09-07

### Fixed

- The transaction status badge's claimed/confirmed hint (shipped in 0.1.5)
  used a native `title` attribute, which has no touch equivalent on any
  mobile browser — invisible to vendors checking transactions on a phone.
  Replaced with `@merqo/ui`'s `InfoTooltip` in `trigger="tap"` mode, which
  opens on tap (and still on desktop click), so the hint is actually
  reachable on the device most vendors use.

## [0.1.5] - 2026-09-07

### Added

- Transaction status badges (`claimed`/`confirmed`/`pending`) now carry a
  persistent hover hint explaining what each status means, so the
  claimed/confirmed distinction (customer says paid vs. vendor confirmed the
  money landed) doesn't rely solely on a vendor remembering the one-time
  onboarding tour.

## [0.1.4] - 2026-09-07

### Added

- The booking detail page (`/dashboard/bookings/[id]`) now shows the
  booking's own ID with a one-click copy button. Previously the only way
  to get it was reading the URL bar — a real friction point for the one
  manual step every event vendor using both qkit and paykit needs to get
  right (pasting the ID into qkit's booth settings to link the two).

## [0.1.3] - 2026-09-07

### Added

- `/about` — a public "Why Merqo" page: `@merqo/ui`'s shared
  `AboutMerqo` origin story, linked from the landing `Nav` and `Footer`.
  `@merqo/ui` bumped to `v0.25.0`: a pre-lawyer-review legal-wording pass
  (no em dashes, PDPA-accurate rights language) and a "← Back" button on
  every `/legal/*` page.

## [0.1.2] - 2026-09-06

### Changed

- Dropped the required typed legal-name field from terms/privacy
  acceptance — a plain ToS/Privacy clickwrap doesn't need a signatory
  name for evidentiary strength beyond the existing acceptance record
  merqo keeps (vendor_email, auth_uid, doc_type, doc_version, ip,
  user_agent, timestamp). `@merqo/ui` bumped to `v0.24.0`
  (`TermsAcceptanceCheckbox` no longer takes `legalName`/
  `onLegalNameChange`).

### Added

- Legal-document gate. `/legal/terms` and `/legal/privacy` render the shared
  `@merqo/ui` documents (also linked from the landing footer), and a signed-in
  vendor whose accepted terms/privacy versions are behind `@merqo/ui`'s
  `LEGAL_VERSIONS` is bounced to a `/legal/accept` interstitial before any
  dashboard route renders. paykit owns no acceptance record — merqo does — so
  currency is a bearer-authed `GET /api/merqo/legal-status` call cached in a
  new `legal_check_state` TTL table (migration `0015`, 5 min, mirroring
  merqo's `vendor_sync_state`), and acceptance is two idempotent
  `POST /api/merqo/legal-accept` calls (one per doc, each hashed via
  `getLegalDocSource`). The gate fails closed: an unreachable merqo or an
  unset `MERQO_CUSTOMER_SECRET` routes the vendor to `/legal/accept` rather
  than past the gate. This is paykit's first kit-to-merqo outbound HTTP call
  (`MERQO_BASE_URL`/`MERQO_CUSTOMER_SECRET` are new env vars — every existing
  merqo-facing secret here gates the opposite, inbound, direction).
  `@merqo/ui` bumped to `v0.23.2` — `acceptLegalTerms` now forwards the
  vendor's submitted `legal_name` and their real `ip`/`user_agent` (read via
  `headers()`) in both `legal-accept` POST bodies, matching merqo's
  now-required `legal_name` field. (`legal_name` was dropped again later in this
  release, see Changed above.)

### Fixed

- `/admin/vendors` returned a 500 ("Functions cannot be passed directly to
  Client Components") — `page.tsx` (a Server Component) rendered `@merqo/ui`'s
  all-`"use client"` `DataTable` directly, passing it the module-level
  `columns` array's `cell` callbacks and a `getRowKey` function. Extracted
  the `DataTable` render into a new `"use client"` `VendorsTable` wrapper
  (`src/app/admin/vendors/vendors-table.tsx`), mirroring the existing
  `activity-section.tsx` pattern; `page.tsx` keeps `requireAdmin()` + the
  data fetch and renders `<VendorsTable rows={…} />`. Not caught by
  `next build` since the route is dynamic (`revalidate = 0`).

## [0.1.1] - 2026-08-27

### Added

- `GET /api/merqo/vendor-activity?email=…` — merqo hub's per-vendor detail
  lookup backing `/admin/vendors/[email]`'s paykit card, generalizing the
  existing `vendor-status` email-lookup convention into a richer
  `{active, plan, status, metrics, lastActivityAt}` payload. `status`
  reuses `src/lib/vendor-health.ts`'s existing triage classification
  (`vendorStatus`) rather than a second rule, and the trailing-30d
  transaction/volume/refund-rate `metrics` rows are computed from the
  exact same `confirmed_at ?? created_at` windowing that classification
  already uses, so the two never disagree. A vendor absent from
  `auth.users` entirely 404s; a known vendor with no
  `vendor_payment_config` row gets a 200 with `active: false`. See
  `docs/business/2026-08-26-cross-kit-vendor-activity-design.md` for the
  shared cross-kit contract every kit implements.

### Changed

- Bumped `@merqo/ui` to v0.22.0 and migrated the earnings report's
  monthly/per-booking tables and the admin vendors table onto its new
  shared `DataTable` component, replacing a hand-rolled `<table>` and the
  shadcn `Table` primitives respectively — same columns, cell content, and
  empty-state copy, rendering-mechanism swap only.

### Added

- Per-vendor triage status on the admin Vendors table (`attention`/`stuck`/
  `quiet`/`new`/`healthy`, most-urgent first) — `src/lib/vendor-health.ts`
  adapts qkit's own `admin-vendor-health.ts` status vocabulary/rank
  convention to paykit's own signals: a refund-rate anomaly in the trailing
  30 days (≥3 refunds, or >20% of confirmed transactions refunded once
  there's a ≥5-transaction sample), whether a payment config has ever
  produced a confirmed transaction, and confirmed-transaction recency.
  Rendered via `@merqo/ui`'s shared `StatusBadge` (bumped `@merqo/ui` to a
  post-v0.21.0 commit that adds it, fixing a TS2742 declaration-emit issue
  the tagged v0.21.0 release hits under some `node_modules` layouts).
- Refund count/volume (trailing 30 days) and windowed 7d/30d trend deltas
  on the admin Overview's confirmed-transaction/-volume stats — this page
  previously had no delta anywhere, unlike every sibling kit's Overview.
- `paykit.auth_failures` (migration 0014): every failed `verifyKitAuth`
  call now appends a best-effort row (`kit_slug` when resolvable, `reason`,
  `ip`, never the secret) instead of only a `console.warn` — a leaked or
  misbehaving kit secret previously left zero durable trail. Surfaced on
  the admin Overview's new Security stat block alongside rate-limit
  pressure (`paykit.rate_limits` windows at or above the shared per-route
  limit, grouped by `kit_slug`, trailing 24h).
- `POST /api/merqo/vendor-provision` now logs a `paykit.admin_audit` row via
  `recordAudit()` before responding (`action: "merqo_vendor_provision"`,
  `admin_id`/`target_id` both the vendor's own id, `detail.actor:
"merqo_system"`) — closes a gap where merqo-initiated vendor provisioning
  went completely unlogged, matching loopkit's existing sentinel convention
  for a merqo-attributed action with no real signed-in admin behind it.
- Admin `/admin/activity` tab rendering `admin_audit` via `@merqo/ui`'s
  shared `AuditLogTable` — the reference `recordAudit()` implementation had
  no viewer of its own until now.
- `GET /api/v1/bookings/{booking_id}` — read-only booking status (deposit/
  balance amounts, event date, and whether each linked transaction is
  confirmed), bearer-kit-auth same as the existing vendor-config route.
  Lets a calling kit (starting with qkit) show a booking's live paykit
  status inline on its own dashboard, once a vendor pastes their own
  `paykit_booking_id` into that kit's booth settings.
- `GET /api/merqo/metrics` — merqo hub's cross-kit health/revenue dashboard
  polls this the same way it already does for qkit and loopkit; paykit had
  no implementation until now, so it silently never appeared there. Maps
  paykit's `vendor_payment_config`/`transactions` domain onto the shared
  payload shape (`src/lib/metrics.ts` documents every field's mapping);
  `pending_upgrade_requests` is always `0` since paykit has no local
  upgrade-requests table (upgrade asks file into `merqo.support_messages`
  instead, a cross-schema table this kit can't query directly).

- A printable booking summary (`bookings/[id]`'s new `PrintBookingButton`,
  `window.print()`) — customer/event/deposit/balance/transaction details
  only, action buttons hidden via `print:hidden`. No new table, no invoice
  numbering, no email-send infra — a view over data already there.

- Onboarding tour steps for Bookings and Earnings (`tour-steps.ts`) — both
  live nav items had no tour coverage at all since they shipped, so a new
  vendor never learned they existed. No nav changes needed; the anchors
  already existed via `tourAnchor`'s URL-derived `data-tour` id.

- `kit_api_keys.last_used_at` (migration 0013), touched on every
  successful bearer-secret auth. Closes a real gap: rotating a calling
  kit's secret had no way to confirm the new one was actually picked up,
  or that a stale/never-deployed row was safe to clean up. New
  `docs/SECRET_ROTATION.md` documents today's real rotation process
  honestly — a hard cutover, no dual-secret grace window exists.

- Server-side error tracking (`src/instrumentation.ts`, `@sentry/nextjs`),
  activating only when `SENTRY_DSN` is set — safe to leave unset in
  dev/preview, the SDK no-ops with no dsn. No dependency on today's
  outage/error data being centrally visible before this.

- Logging on every failed bearer-secret auth attempt (`kit-auth.ts`'s
  `verifyKitAuth`): a missing/malformed header, an unknown `kit_slug`, or a
  secret mismatch each now log a warning with the `kit_slug` when
  resolvable — never the secret itself. Previously silent, so a
  probing/brute-force pattern against the bearer scheme would have gone
  unnoticed.

- Rate limiting on the bearer-secret `/api/v1/*` surface (`paykit.rate_limits`,
  migration 0012, ported from qkit's own DB-backed fixed-window limiter):
  checkout/claim/confirm/unclaim each cap at 60 requests/60s per
  `kit_slug`+IP, closing a real gap — a leaked or misbehaving kit secret
  could previously hammer any endpoint unbounded. Fails open on limiter
  errors, same as qkit's own.

- Payment-lifecycle audit trail (`paykit.payment_audit`, migration 0011):
  every real state transition on the bearer-secret checkout API — checkout
  created, claimed, confirmed, unclaimed — now writes an immutable,
  kit-attributed row, closing the gap where the entire payment lifecycle
  had no record beyond `transactions.status` (a single column, overwritten
  in place, previously fully mutable by the service-role client). A
  no-op/idempotent request (already-claimed, lost a race, etc.) writes
  nothing. Kept as its own table rather than overloading `admin_audit`'s
  human-actor (`admin_id not null`) semantics, since every writer here is a
  bearer-secret-authenticated kit, never a signed-in session.

- Earnings report (`/dashboard/reports/earnings`, free for every vendor):
  accrual-aware yearly revenue, tagged by a linked booking's `event_date`
  rather than claim/confirm date, with a monthly breakdown, a per-booking
  line table, and CSV export. Revenue only, never a computed profit figure
  or a Form-B-ready submission — paykit never sees a vendor's own costs.

- Bookings: `createBookingAction`/`createBalanceCheckoutAction` now log to
  the admin audit trail on success (`create_booking`/
  `create_balance_checkout`) — paykit already logged `set_vendor_plan`/
  `set_pricing`/`cancel_booking`/`record_refund`, this closes the two real
  gaps. The bearer-secret claim/confirm/unclaim routes stay out of scope —
  they have no `auth.users` actor to attribute a row to.

- Bookings: a booking can now be rescheduled (`rescheduleBookingAction` —
  updates `event_date`/`balance_due_date` directly, deposit already paid
  stays counted, no new booking status) and cancelling one can optionally
  file a refund against its confirmed deposit or balance transaction
  (reuses the existing Pro-gated `refunds` ledger, not a new mechanism).

### Fixed

- `cancelBookingAction` silently no-op'd on a non-owned or stale booking id
  (RLS filters the `UPDATE` to zero rows, which returns `error: null`) but
  still logged a `cancel_booking` audit row claiming success. Now reads the
  booking first under RLS and returns "not found" instead of logging a
  cancellation that never happened.

- Bookings: deposit-now, balance-later checkout for event-cart vendors
  (weddings, private events), instead of a one-shot transaction. A new
  `bookings` table links up to two `transactions` rows (deposit, then
  later balance) by id; a Postgres trigger keeps `bookings.status`
  (`pending_deposit`→`deposit_paid`→`fully_paid`, or `cancelled`) correct
  off those transactions' own `confirmed` state, regardless of which path
  confirmed them. New `/dashboard/bookings` list + detail pages: a
  creation dialog, a "Create balance checkout" action once the deposit
  exists, cancel, and a "balance due soon/overdue" badge (dashboard-only —
  this repo has no cron/notification infra, so it's not a push).
- Dark mode is now actually reachable: a manual Light/Dark/System control
  in the dashboard account menu, via bumping `@merqo/ui` to v0.18.0
  (its `AccountMenu` gained a built-in theme control) and wrapping
  `src/app/layout.tsx` in `next-themes`' `ThemeProvider`. `globals.css`'s
  `.dark` block already existed but had no code path applying the `.dark`
  class, so it was fully unwired until now.

### Fixed

- Cards were visually indistinguishable from the page background in both
  light and dark mode — the Banknote Engrave rebrand set `--card`/
  `--popover` to the exact same OKLCH value as `--background`. Restored a
  distinct card treatment in both modes (`src/app/globals.css`); a
  follow-up pass pushed the delta further after the first one still read
  as too subtle at a glance, and a second follow-up brightened the
  dark-mode card a bit more on top of that.
- The favicon/apple-touch-icon (`src/lib/brand-icon.tsx`) still rendered
  the old "Signal & Mint" hex after the Banknote Engrave rebrand — a
  real visible bug, not just stale docs.

### Changed

- Onboarding tour copy: no more em dashes, and two new steps
  (Transactions, Stats) covering ground the tour skipped before. The
  first step now shows an example transaction preview.
- Bumped `@merqo/ui` to v0.21.1: `TransactionStatusBadge` now renders
  through the new shared `StatusBadge` (dot + uppercase bordered-pill,
  extracted from qkit's own `OrderStatusBadge`) instead of wrapping
  shadcn's `Badge` with a variant + one-off className. Every `TxStatus`
  value now gets an explicit `{label, className}` entry in the
  `text-{token} border-{token}/35 bg-{token}/12` pattern — `claimed` keeps
  its brand mint accent, `pending` uses the neutral `secondary` token,
  `confirmed` uses `primary`. Labels are unchanged (raw lowercase status
  strings). (v0.21.0 itself never got its git tag cut and its `StatusBadge`
  export failed a fresh install's declaration build — v0.21.1 is the fix,
  see `cljiahao/merqo-ui#19`.)
- Bumped `@merqo/ui` to v0.20.0: the admin overview's `Stat` tile now wraps
  the new shared `StatTile` content instead of a fully local
  implementation — no visible change, paykit's own `ElevatedCard` shell is
  unchanged.
- Bumped `@merqo/ui` to v0.19.0: the account menu's theme control now sits
  behind a collapsed "Theme · {current}" submenu instead of three
  always-expanded radio options.
- "Banknote Engrave" theme's secondary color is now a warm grey instead of
  steel-blue — it read too close to the primary's own teal-green hue.
- The onboarding tour's "example transaction" preview now renders the real
  `TransactionStatusBadge` component instead of a hand-copied color/label
  (new `transaction-status-badge.tsx`, extracted from `transaction-table.tsx`).
- Fixed the spec-doc link this added to `src/components/README.md` — was
  two directory levels short of the workspace root.

### Added

- Widened `admin_audit` coverage: a vendor's own refund (`issueRefundAction`)
  is now recorded, not just admin-console actions. New migration revokes
  `UPDATE`/`DELETE` on `admin_audit` from `service_role` (kept to
  `SELECT`/`INSERT`), closing a real tampering gap at zero functional cost.
  Retention (5 years, matching IRAS) now stated in `AGENTS.md`.

### Changed

- Brand theme: `globals.css`'s color tokens replaced with "Banknote
  Engrave" (engraved teal-green primary, steel-blue secondary), light
  and dark, across the full shadcn token set. Purely cosmetic — no
  component/behavior change.

### Fixed

- Bumped `@merqo/ui` to v0.14.1 — the kit-switcher (account menu's
  "Switch products") was sending vendors to a kit's `-sg.vercel.app`
  deployment host instead of its real `<kit>.merqo.io` domain, a
  different host from the shared-session cookie's `.merqo.io` scope —
  bouncing a switching vendor into a login loop instead of a live
  session.

### Added

- "Switch products" submenu in the dashboard account menu, letting a
  signed-in vendor jump to another live sibling kit's dashboard (qkit,
  loopkit, stockkit) — SSO via the shared `.merqo.io` cookie already signs
  them in there, this just adds the in-product navigation link. Bumped
  `@merqo/ui` to v0.13.0 for the new `switchKits` prop on
  `DashboardNav`/`AccountMenu`. Static v1 list, no new API call.
- Admin-tunable Pro pricing: a single-row `paykit.pricing` table, a `setPricing` admin action, and `@merqo/ui`'s new `PricingForm` wired into `/admin` let an admin change the Pro price live, no redeploy needed, seeded at $4.99/mo (up from the hardcoded $12/mo `PRO_PRICE` constant). Every price call site (plan page, dashboard nudge, landing copy) now reads the live price instead of a hardcoded string. In the same change, revenue stats become free for every vendor (previously Pro-gated) and refund tracking becomes Pro's one remaining gate. See `docs/superpowers/specs/2026-08-15-paykit-admin-pricing-design.md` and `docs/superpowers/specs/2026-08-15-paykit-pro-simplification-design.md`.
- BYO payment preset picker on the `pointer` config form
  (`src/app/dashboard/config/pointer-presets.ts`): four cards (Stripe
  Payment Link, HitPay Payment Link, PayLah! QR, Other/Custom), each
  with tailored "where to find this" instructions; Stripe and HitPay
  additionally get a soft, non-blocking warning if the pasted URL
  doesn't look like their expected link shape. UI/copy only — no new
  `vendor_payment_config` column, no PSP integration, free tier always.
  See `docs/superpowers/specs/2026-08-14-paykit-byo-preset-directory-design.md`.

### Changed

- Bumped `@merqo/ui` to v0.14.0 and switched the dashboard nav's
  `switchKits` prop to the new `getSwitchKits("paykit")` helper, replacing
  the locally hardcoded sibling-kit array. `@merqo/ui` now owns the
  canonical kit family list (`KIT_FAMILY`), so adding a future kit only
  requires updating `@merqo/ui`, not every kit's own `DashboardNav`
  wrapper. No behavior change — same three sibling kits, same URLs.
- Display font switched from Space Grotesk to Fraunces (the shared
  family display face — see
  `docs/business/2026-08-13-typography-family-standard.md`). qkit
  already used Fraunces; this brings paykit in line with the rest of the
  family now that cross-kit SSO means vendors move between kits under
  one identity, so a per-kit display face reads as a seam rather than a
  feature. Body (Inter) and mono (JetBrains Mono) fonts are unchanged.
  The brand-icon mark's font fallback also switched from the system
  sans-serif stack to the Georgia serif stand-in, matching Fraunces
  being a serif.
- Checkout now goes through a pluggable `PaymentProvider` seam
  (`src/lib/payments/provider.ts`) instead of calling the EMVCo/pointer
  builder (`renderCheckout`) directly. No behavior change today — the
  only registered provider is `direct`, which wraps the existing builder
  unchanged — but wiring in a future real payment gateway becomes a
  `PAYKIT_PROVIDER` config value plus one new provider implementation,
  not a route rewrite.

### Fixed

- `saveConfigAction` (`/dashboard/config`) used `.upsert()`, whose
  `ON CONFLICT DO UPDATE` path requires table-level `UPDATE` privilege
  regardless of column-level grants — but `vendor_payment_config`'s
  `UPDATE` grant is deliberately column-scoped to exclude `plan` (see
  `0001_paykit_core.sql`, so a vendor can't self-escalate to Pro). The
  result: every payment-config save failed with a silent "Could not
  save. Try again." — the core setup flow was completely broken for both
  first-time and repeat saves. Replaced the upsert with an explicit
  select-then-insert-or-update, which respects the same column grants
  as every other write in the app; no grant was widened.
- The revenue chart (`/dashboard/stats`) had no tooltip — hovering a bar
  showed nothing, so a vendor could only eyeball a day's revenue against
  the gridlines. Added a `recharts` `Tooltip` with a custom, card-styled
  content component showing the exact date, amount, and transaction count.
- The free-plan Stats page's "upgrade to see aggregated revenue…" copy
  had no way to act on it — "upgrade" was plain text, not a link. It now
  links to `/dashboard/plan`, matching the linked pattern already used in
  the dashboard home Pro nudge.
- Refund amount was entered in raw cents ("450" for $4.50) while
  every other money value in the app displays as SGD dollars — real
  error risk on an action that writes a refund ledger row. The
  refund dialog now takes a dollar amount and converts to cents
  before submit.
- `issueRefundAction` never revalidated the transactions page after
  inserting a refund, so the table kept showing the pre-refund state until
  a manual reload despite the toast confirming success. The refund dialog
  also stayed open with the submitted values still populated, inviting an
  accidental duplicate submit. Added `revalidatePath` and made the dialog
  close/reset on success.
- No `loading.tsx` or `error.tsx` existed anywhere in the app — navigation
  showed a blank screen until data resolved, and an unhandled throw fell
  through to Next's default unstyled error page. Added branded boundaries
  at the dashboard segment and root level.
- The revenue chart had no accessible name for screen readers. Added
  `role="img"`/`aria-label` and an sr-only data table.
- `GET /api/v1/vendors/{vendor_id}/config` now returns the full editable
  `vendor_payment_config` row (`kind`, `payee_name`, `uen`, `mobile`,
  `label`, `url`, `qr_image_url`) alongside the existing `has_config`/
  `display_name` summary fields, instead of the summary alone. Closes the
  gap where a calling kit's own "quick add PayNow details" edit form (e.g.
  qkit's) had every text field start blank when a vendor re-opened payment
  settings, since the kit had no way to read back what was already saved.
- Dashboard onboarding tour re-triggered on every visit to `/dashboard`
  despite #23's "stamp on start, not finish" fix. Root cause: that fix's
  mark-seen write is fire-and-forget from the client
  (`dashboard-tour.tsx`'s `onFirstSeen`), and the tour's own second step
  spotlights the real "Payment setup" nav link — which `@merqo/ui`'s
  `DashboardNav` renders as a plain `<a>` tag, not `next/link` — so
  clicking it (as the tour invites) triggers a hard page navigation that
  can abort the write before it lands, leaving `tour_seen_at` unset.
  `src/app/dashboard/page.tsx` now also stamps `tour_seen_at`
  synchronously during its own server render whenever it's unset — a
  write that lands before the response is even sent, immune to any
  client-side navigation race. `tour-actions.ts`'s `markTourSeen` is
  refactored to share the upsert (`stampTourSeen`) with `page.tsx` instead
  of duplicating it.

### Added

- `POST /api/v1/vendors/{vendor_id}/config` — kit-auth (bearer-secret,
  `verifyKitAuth`) service-role upsert of a vendor's
  `vendor_payment_config` on behalf of a calling kit, reusing
  `vendorPaymentConfigInputSchema` (paynow|pointer) for validation and
  returning the same summary shape as the existing `GET` route (`has_config`/
  `display_name`, plus the full config fields as of the fix above). First
  piece of the qkit→paykit checkout cutover: qkit was
  minted a `kit_api_keys` bearer secret so it can build a lightweight
  "quick add PayNow details" UI inside its own dashboard instead of
  redirecting to paykit's dashboard.
- `POST /api/v1/checkout/{id}/unclaim` — reverts a `claimed` transaction
  back to `pending` (undoes an accidental "I've paid" tap). Idempotent and
  provably safe: a `confirmed` transaction is never reverted — the
  `.eq("status", "claimed")` update guard means the DB simply matches
  nothing and the endpoint echoes the unchanged `confirmed` status back,
  same idempotent-no-error convention `claim`/`confirm` already use.
  Restores a capability qkit lost when it cut over from its own local
  `unclaimPayment` to paykit's HTTP API.

### Changed

- Design pass from a completed frontend-design/impeccable critique:
  claimed transactions now have a distinct visual state instead of
  looking identical to pending ones; dashboard home gained a
  payment-method summary card and a proper Pro-nudge card; the Pro
  badge and config-saved confirmation now use the brand mint token
  instead of stock Tailwind emerald; the revenue chart's bars use
  the mint accent and gained a total/count/average summary row;
  added the family's documented ink closing-CTA band (previously
  defined but unused) to the landing page; and a few smaller
  copy/consistency fixes (FAQ heading pattern, upgrade-CTA SLA note,
  softened "via qkit" checkout badge copy).
- Bumped `@merqo/ui` to v0.10.0 and wired its new optional `LinkComponent`
  prop with `next/link`'s `Link` at the `DashboardNav` call site
  (`src/app/dashboard/dashboard-nav.tsx`). `DashboardNav`/`AccountMenu`
  previously hardcoded plain `<a>` tags for internal nav links, forcing a
  full page reload on every click — the root cause PR #36 worked around
  with a server-side stamp. `DashboardNav` forwards `LinkComponent` down
  to the `AccountMenu` it composes internally, so passing it once here
  covers both; paykit has no standalone `AccountMenu` usage elsewhere.
- Bumped `@merqo/ui` to v0.9.0: `DashboardNav`'s inner row is now capped at
  `max-w-7xl`/centered (matches the content area it sits above — no code
  change needed here). `src/components/landing/nav.tsx` now composes the
  new `LandingNav` shell (sticky header, `max-w-6xl` row) instead of
  hand-rolling it; visual output is unchanged aside from the shared
  shell's own `end`-row gap (`gap-2 sm:gap-4`, replacing a fixed `gap-3`).
- Dashboard content width is now consistent across every `/dashboard`
  route: `src/app/dashboard/layout.tsx`'s `<main>` is the single
  layout-level `mx-auto w-full max-w-7xl` container (matching qkit's
  canonical dashboard width), replacing six pages that each set their own,
  different width (`max-w-lg` through `max-w-4xl`) with no shared outer
  boundary. Pages needing a narrower reading width (config's form,
  profile's two-column form, plan's card stack, stats' upsell/chart,
  transactions' table) keep an inner `mx-auto max-w-*` div, so content
  still reads at a sensible width — only the _outer_ edge, the one
  `DashboardNav` aligns to, is now consistent.
- Dashboard account chrome (nav, account menu, Feedback/Get-help sheets,
  profile-icon/QR-image uploader, onboarding tour, tooltip, and settings
  field-group shell) migrated onto the shared `@merqo/ui` v0.8.1 package
  — the same component library qkit adopted first. Local
  `FeedbackForm`/`SupportForm`/`InfoTooltip`/`Section`/`ImageUploader`/
  `tour.css` are deleted; `dashboard-nav.tsx`/`dashboard-tour.tsx`/
  `use-async-action.ts` are now thin paykit-specific wrappers around the
  shared components. No behavior, copy, schema, or payment-processing
  logic changed — UI-layer chrome only.
- Each of the six `/dashboard` page.tsx files (`page.tsx`,
  `config/page.tsx`, `plan/page.tsx`, `profile/page.tsx`,
  `stats/page.tsx`, `transactions/page.tsx`) now has a `page.dom.test.tsx`
  alongside it, following the "await the async server component, render
  its returned JSX with RTL" pattern `dashboard/layout.dom.test.tsx`
  established: session/plan/transaction lookups mocked, real branching
  (empty state, Free/Pro gating, nudge thresholds) asserted. These pages
  previously had no direct test coverage at all.

### Added

- `POST /api/v1/checkout` is now idempotent on `(kit_slug, order_ref)`: a
  retried call (e.g. after a caller-side timeout) returns the transaction
  the first call already created instead of erroring or creating a
  duplicate pending transaction (`0007_paykit_checkout_idempotency.sql`
  adds the unique constraint the route catches the violation on).
- Unit tests for `vendor-session.ts` (`getVendorSession`/`getVendorPlan`),
  the shared dashboard auth guard used by every `/dashboard` page and
  server action — previously covered only indirectly through whatever
  dashboard action tests happened to mock through it.
- A comment-hygiene enforcement layer alongside the existing static ESLint
  gate (`no-inline-comments`, `sonarjs/no-commented-code`): a feedback-only
  `PostToolUse` hook (`post-edit-comment-check.sh`), a warn-only pre-commit
  nudge (`comment-hygiene.sh`), and a CI job scoped to added lines — all
  reading the same `.claude/comment-hygiene-patterns.txt`.
- Merqo-team internal admin console (`/admin`), ported from loopkit's
  admin-console pattern: an `admins` allow-list + `admin_audit` trail
  (`0006_paykit_admin.sql`), an overview page with platform-wide stat
  tiles and a recent cross-vendor activity feed, and a vendors page
  listing every vendor with a plan toggle (`setVendorPlan`). Vendor
  identity is resolved via a new `listAllUsers` helper (paginates the
  Supabase admin API) since `vendor_payment_config.payee_name` is null
  for `kind='pointer'` rows.

### Changed

- `merqo-support.ts`, `merqo-vendor-feedback.ts`, and
  `merqo-vendor-profile.ts` now delegate their `.schema("merqo").rpc(...)`
  call to a new shared `callMerqoRpc` helper (`src/lib/merqo-rpc.ts`)
  instead of each hand-writing the same generic-over-caller's-client cast;
  public function signatures unchanged.
- Landing footer rebuilt to match qkit's exact single-row layout
  (wordmark, tagline, copyright, sign-in link as flex siblings), and the
  bottom call-to-action band above it removed — qkit's landing page never
  had one.

### Fixed

- `.claude/settings.json`'s `Edit` permissions-deny list now also covers
  `.env.*.local` (it already covered the other `.env` variants), matching
  the `Read` deny list.
- `/api/merqo/vendor-status` now paginates the Supabase admin-users
  lookup via `listAllUsers` instead of the old `merqo-auth.ts#listAllAuthUsers`
  (removed), which only ever read the first 1000 auth users — a vendor
  past that ceiling silently resolved as inactive/no-plan to merqo's
  lookup.
- Dashboard onboarding tour now stamps `tour_seen_at` as soon as it
  auto-runs, not when it finishes — a refresh mid-tour no longer makes
  it re-run on every dashboard load.

### Added

- First-visit dashboard onboarding tour (driver.js overlay + floating "?"
  replay button), ported from qkit/stockkit. Seen-state tracked in the new
  `vendor_prefs` table.
- Shared-session SSO across `*.merqo.io` kits: `NEXT_PUBLIC_AUTH_COOKIE_DOMAIN`
  scopes the Supabase auth cookie to `.merqo.io` in production, so signing
  in on one kit signs you in on the rest. A one-time cleanup in
  `src/lib/supabase/middleware.ts` clears each already-signed-in vendor's
  pre-existing host-only cookie (forcing a single re-login) without
  clobbering a same-request token refresh.

### Fixed

- Dashboard nav desktop links now render as the shared `Button asChild
variant="ghost" size="sm"` control instead of a hand-rolled `Link`,
  matching every other kit's dashboard nav.
- Login page brought to cross-kit parity: card container standardized to
  the shared `ElevatedCard`, Google icon extracted into `google-mark.tsx`,
  and wordmark/field/button sizing and copy aligned with the other kits'
  login pages.
- Browser-tab title now uses the cross-kit "Name | Tagline" Title Case
  format: "Paykit | Vendor Payments" (was "paykit: PayNow payments").
- paykit supports both `paynow` and `pointer` (BYO QR/link) payment
  configs, so "PayNow payments" / "shared PayNow payment engine" undersold
  it — reworded to "Vendor Payments" / "shared vendor payment engine"
  (title, description, footer, AGENTS.md).
- `.husky/lib/pre-commit.sh` used `xargs -d '\n'`, a GNU-only flag not
  supported by BSD xargs (macOS default) — broke every local commit
  touching a staged .ts/.tsx/.js/.mjs/.cjs file. Swapped for portable
  `tr '\n' '\0' | xargs -0`.
- Landing and footer "Log in" links renamed to "Sign in" for label parity
  across all Merqo Business kits.
- Dashboard and landing navbar height, padding, and logo size now match
  qkit's spec (`px-5 py-3.5`/`py-4`, `text-3xl` logo).

- Browser-tab title lowercased to match the kit naming convention (was
  "PayKit", PascalCase reserved for the logo mark only) and given a tagline:
  "paykit: PayNow payments".
- Google OAuth on `/login` now forces an English consent screen
  (`queryParams: { hl: "en" }`), matching merqo/qkit/loopkit.

### Added

- Real "Forgot password?" flow on `/login` (sign-in mode only): emails a
  Supabase reset link via `resetPasswordForEmail`, landing on
  `/auth/callback` → `/dashboard/profile`'s existing "Change password"
  field. Toasts an error when the email field is empty or the call fails.
- A real, clickable Pro-upgrade action on the dashboard Plan page
  (`UpgradeCta`) — files an in-product request via the new
  `requestProUpgradeAction` server action instead of just describing the
  upgrade in text; no payment provider involved, Pro is granted manually.
- `BackButton` (`@/components/back-button`), ported from qkit: a real
  hit-target "leave this page" button, replacing the plain underlined
  `<Link>` previously used on the dashboard Plan and Profile pages.
- FAQ link in the landing nav (`landing/nav.tsx`), jumping to the existing
  `faq.tsx` section.
- Login card now uses the shared `Wordmark` (was plain "paykit" text) and a
  real Google "G" mark next to "Continue with Google" (was a bare label,
  no brand glyph).

### Fixed

- `SupportForm`'s category `ToggleGroup` was missing `spacing={1.5}`,
  rendering the category buttons edge-to-edge instead of qkit's
  separated-pill layout.
- Dashboard nav's mobile burger button appeared at the wrong breakpoint
  relative to the inline links, and the account-menu `TierBadge` pill was
  misrendered; both fixed alongside a `Button` sizing fix.
- Sign-up on `/login` no longer silently redirects to `/dashboard` when
  Supabase returns no session (email confirmation on) — it now shows a
  "Check your email" state, with "Back to sign in" returning to the normal
  form.
- templateCentral 5.12 harness sync: `docs/constitution.md` references in
  `.claude/settings.json` and `AGENTS.md` corrected to the canonical
  uppercase `docs/CONSTITUTION.md` casing (already used by
  `protect-files.sh`) so the ask-gate would actually fire if that file is
  ever added; removed the unused, unwired `.claude/hooks/verify.sh`; bumped
  `pnpm/action-setup` in CI from v4.3.0 to v4.4.0.

### Changed

- Migrated git hooks from lefthook to husky — lefthook's unsigned
  `lefthook.exe` is unconditionally blocked by Windows Smart App Control on
  this machine; husky has no native binary. Same checks, same rigor.
- `FeedbackForm`'s NPS score picker and comment field now use shadcn
  `ToggleGroup`/`Textarea` instead of hand-rolled radio buttons and a plain
  `<textarea>`, matching `SupportForm` and qkit's equivalent component. No
  behavior, copy, or schema change.

### Security

- Adopt the immutable audited shared UI commit for upload lifecycle, storage URL validation and safe money parsing fixes; constrain its build permission to the locked source URL.

- Bumped `next` 16.2.10 → 16.2.11, clearing 9 known advisories (4 high: App
  Router middleware/proxy bypass, Server Actions DoS, Server Actions SSRF
  on custom servers, rewrites SSRF via attacker-controlled hostname; 5
  moderate: response-body cache confusion x2, unbounded Server Action
  payload on Edge, Image Optimization SVG DoS, internal Server Function
  endpoint disclosure) — all fixed upstream, no app code changes needed.

### Added

- `GET /api/merqo/vendor-status` and `POST /api/merqo/vendor-provision` —
  merqo hub integration routes, bearer-secured via new `MERQO_METRICS_SECRET`/
  `MERQO_PROVISION_SECRET` env vars. Both routes are read-only: paykit has no
  safe default for `vendor_payment_config`'s `payee_name`/`uen`/`mobile`
  fields, so provisioning only reports whether a vendor has already
  configured payment collection (`needs_setup: true/false`), never creates a
  placeholder row.
- **Real "Get help" support form**, replacing the mailto-link interim
  pattern — files into the shared cross-kit `merqo.support_messages`
  inbox (Merqo team picks it up in `/admin`), same pattern qkit's own
  local support form uses, now shared infrastructure any kit can call.

### Fixed

- Dashboard account menu was missing the dropdown chevron qkit/loopkit both
  show, and the nav wordmark used the generic (still shadcn-default,
  near-black) `--primary` token instead of paykit's own mint brand color
  already used everywhere else (landing wordmark, hero, icons).

### Docs

- Added the `src/lib/`, `src/lib/payments/`, `src/lib/supabase/`,
  `src/components/`, `src/components/landing/`, and `src/components/ui/`
  `README.md` files — previously bypassed via the `skip-readme-check`
  label on prior PRs that touched those folders.

### Changed

- `eslint.config.mjs` expanded from one hand-picked sonarjs rule to the
  plugin's full `sonarjs.configs.recommended` set (206 of 268 rules at
  `error`), with scoped overrides for generated shadcn primitives and
  test-fixture false positives. Fixed every real finding it surfaced: 4
  nested ternaries de-nested (display-string logic only, no behavior
  change) and 2 `concise-regex` simplifications.
- Code-debt sweep: `merqo-auth.ts`'s `bearerOk`/`provisionBearerOk` shared
  the same constant-time bearer-check logic twice; extracted into one
  `bearerMatches()` helper. The identical `formatCents()` currency
  formatter, previously copy-pasted in `admin/page.tsx`,
  `dashboard/stats/revenue-chart.tsx`, and
  `dashboard/transactions/transaction-table.tsx`, now lives once in
  `src/lib/utils.ts`. Removed `schemas.ts`'s `parseSocialLinks` — dead
  code with zero callers (the real `social_links` data flow reads
  straight from the merqo RPC response, never through this function).

### Security

- Adopt the immutable audited shared UI commit for upload lifecycle, storage URL validation and safe money parsing fixes; constrain its build permission to the locked source URL.

- `vendorPaymentConfigInputSchema`'s pointer `url`/`qr_image_url` and
  `socialLinksSchema`'s social link fields validated only with
  `z.string().url()`, which accepts any scheme — `javascript:`, `data:`,
  `file:`, etc. The pointer `url` is later rendered as a real link both in
  the vendor's own dashboard and, via `/api/v1/checkout`'s `"link"`
  response type, in front of an end customer on whichever kit's checkout
  UI renders it. Added an `isHttpUrl()` refinement restricting all of
  these fields to `http:`/`https:` at the schema layer.
