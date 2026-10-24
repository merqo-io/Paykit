# paykit

The Merqo family's shared payment engine. A vendor sets up their payment
method once here — a generated PayNow QR, or their own BYO payment
link/QR image — and any Merqo kit can then request a checkout + track
payment status for that vendor over paykit's HTTP API. paykit never
touches funds — it renders the checkout the customer pays through in
their own bank/payment app, and a human confirms receipt. A calling kit
without its own vendor-session UI can also write the config directly via
`POST /api/v1/vendors/{vendor_id}/config` (bearer-secret authenticated,
same schema the dashboard's own config form uses) — see
`src/app/api/v1/vendors/[vendor_id]/config/README.md`. A vendor setting up
their own BYO payment link/QR picks from a four-card preset directory
(Stripe Payment Link, HitPay Payment Link, PayLah! QR, or Other/Custom —
`src/app/dashboard/config/pointer-presets.ts`) that shows tailored
"where to find this" instructions and, for Stripe/HitPay, a soft warning
if the pasted link doesn't look right; it's UI/copy only, no PSP
integration and no new database column. Display font is
Fraunces (`src/app/layout.tsx`), the shared family face every Merqo kit
now uses — see `docs/business/2026-08-13-typography-family-standard.md`
in the workspace root for why. Brand theme is "Banknote Engrave"
(engraved teal-green primary, warm-grey secondary — was steel-blue until
2026-08-25, changed since it read too close to the primary's own hue) as
of 2026-08-19 — see `globals.css`'s own header comment; `src/lib/brand-icon.tsx`'s
ImageResponse-generated favicon/apple-touch-icon carries the same rebrand.

`admin_audit`'s coverage now extends past the `/admin` console: a vendor's
own refund (`issueRefundAction`) is recorded too, merqo's own
`POST /api/merqo/vendor-provision` push-provisioning call is logged under a
`merqo_system` actor sentinel (see `src/app/api/merqo/vendor-provision/README.md`),
it's now readable via the `/admin/activity` tab (`@merqo/ui`'s shared
`AuditLogTable` — see `src/app/admin/activity/README.md`), and the table is
append-only at the grant level (`service_role` can no longer `UPDATE`/
`DELETE` it, only `SELECT`/`INSERT`) — see `src/app/admin/README.md` and
`AGENTS.md`'s data model section for the retention policy. The
payment-lifecycle API (checkout/claim/confirm/unclaim) has its own
counterpart, `payment_audit` (`src/lib/payment-audit.ts`), attributed by
`kit_slug` rather than a human `auth.users` actor — see
`src/app/api/v1/checkout/README.md`. The same surface is also rate-limited
(`src/lib/rate-limit.ts`, ported from qkit's own DB-backed fixed-window
limiter, 60 requests/60s per `kit_slug`+IP), closing a real gap where a
leaked or misbehaving kit secret could hammer any endpoint unbounded, and
every failed bearer-auth attempt is now logged (`kit-auth.ts`), both to the
console and durably to `paykit.auth_failures`, with the
`kit_slug` when resolvable, never the secret — surfaced on the admin
Overview as a 24h failed-auth count alongside rate-limit pressure. Every
vendor also gets a per-vendor health triage (`attention`/`stuck`/`quiet`/
`new`/`healthy`, `src/lib/vendor-health.ts`) shown on `/admin/vendors`,
gated on refund-rate anomalies and confirmed-transaction recency; the
Overview also gained a 30-day refund stat and 7d/30d trend deltas on
revenue/volume. Server-side error tracking
(`src/instrumentation.ts`, `@sentry/nextjs`) activates only when
`SENTRY_DSN` is set. `kit_api_keys.last_used_at` now tracks when a
calling kit's secret was last actually used, and
`docs/SECRET_ROTATION.md` documents the real (hard-cutover, no grace
window) rotation process. Provisioning refuses duplicate kit slugs; an existing
key changes only with the explicit `--rotate` flag. A booking's own detail page can now be printed
as a customer-facing summary (`bookings/[id]/print-booking-button.tsx`) —
a view over existing data, not a new invoice/receipt subsystem.

In production, the Supabase auth cookie is scoped to `.merqo.io`
(`NEXT_PUBLIC_AUTH_COOKIE_DOMAIN`, `src/lib/supabase/`), so signing in on
one Merqo kit signs you in on the rest. The dashboard's onboarding tour
(`src/components/dashboard-tour.tsx`) stamps its "seen" state as soon as
it auto-runs rather than when it finishes, so a refresh mid-tour can't
make it re-trigger on the next load — and since that client-fired stamp
is fire-and-forget and could be aborted by a hard navigation (the tour's
own steps spotlight a nav link), `/dashboard`'s own server render
(`src/app/dashboard/page.tsx`) also stamps it synchronously, durably, as
part of the request, as defense-in-depth. The tour's first step now shows
an example transaction preview, and its copy no longer uses em dashes; the
preview's status pill renders the real `TransactionStatusBadge` component
(`src/app/dashboard/transactions/transaction-status-badge.tsx`, now built
on `@merqo/ui`'s shared `StatusBadge` dot+pill shape) instead of
a hand-copied color, so it can't drift from what the real badge looks like;
see `../docs/superpowers/specs/2026-08-25-tour-example-badge-drift-fix-design.md`
(workspace root, cross-kit spec). The badge itself now carries a persistent
tap-to-open hint (`@merqo/ui`'s `InfoTooltip`, `trigger="tap"`) explaining
what `claimed`/`confirmed` mean, so that distinction survives past the
one-time tour — tap, not the component's hover default, since a native
hover hint has no touch equivalent and most vendors check this on a
phone. The tour now also covers Bookings and
Earnings, both live nav items that previously had no tour step at all.
`@merqo/ui`'s `DashboardNav`
(v0.10.0+) is now wired with `LinkComponent={Link}`
(`src/app/dashboard/dashboard-nav.tsx`), so its nav links do a
client-side transition rather than a full page reload in the first
place. `POST /api/v1/checkout` is idempotent
on `(kit_slug, order_ref)` — a retried call returns the existing
transaction instead of creating a duplicate. A calling kit can find its own
transaction for an order with `GET /api/v1/checkout?order_ref=`, a read-only
lookup that returns the status, the owning `vendor_id` and the stored checkout
view. A checkout may carry `expires_at`, the time the calling kit gives up on
the order (migration `0023`, applied by hand); it is stored and returned, and
nothing acts on it yet. After a claim, unclaim or confirm commits, paykit posts a payment-status
callback to the owning kit's `kit_api_keys.callback_url`, when one is set
(`src/lib/kit-callback.ts`). It is a hint that the transaction changed, sent
after the response and never awaited; the kit reads the status back with the
lookup above. Checkout creation itself
goes through a pluggable `PaymentProvider` seam
(`src/lib/payments/provider.ts`) — today's only registered provider is
`direct`, wrapping the existing PayNow/pointer builder unchanged, so a
future real gateway is a `PAYKIT_PROVIDER` config value plus one new
provider implementation, not a route rewrite. `pnpm-workspace.yaml`'s
`overrides` pins several transitive dependencies (`postcss`, `undici`,
`vite`, `qs`, `sharp`, `nanoid`, `fast-uri`, `js-yaml`, `brace-expansion`)
past known-vulnerable versions Next.js itself and dev tooling still
bundle; `pnpm audit --prod --audit-level=high` is CI's hard gate — bump
the relevant floor here when a new advisory lands, and re-check after any
`next` upgrade in case it's safe to drop one. `next`/`eslint-config-next` versions are pinned in `package.json`; check that manifest for the current security release. Isolated build validation and its limitations are recorded in the audit evidence. The dashboard nav, account
menu, profile-page layout, image upload, onboarding tour, and landing nav
now delegate to the shared `@merqo/ui` package (pinned in `package.json`;
kit-family consistency; `BackButton`, `ElevatedCard`, and the landing
`Footer` joined the shared package 2026-09-16, each confirmed byte-for-byte
or structurally identical to the other kits' copies before promoting;
paykit keeps its own wordmark, nav links, tier badge, and feedback/support
wiring as thin adapters over the shared components). `/legal/terms` now
renders only paykit's own Annex schedule
(`<LegalDocument doc="terms" kit="paykit" />`), not every sibling kit's —
previously every kit's `/legal/terms` page showed the full multi-kit annex
since none passed kit context. `legal/accept/actions.ts`'s recorded
`doc_sha256` hashes that same scoped content. The earnings report's
month/line tables and the admin vendors table now render via `@merqo/ui`'s
shared `DataTable` instead of a hand-rolled `<table>`/shadcn `Table` — same
columns and cell content, just the shared shell. Because `DataTable` ships
as a Client Component, `/admin/vendors` renders it through a `"use client"`
`VendorsTable` wrapper (`src/app/admin/vendors/README.md`) so its `cell`/
`getRowKey` function props never cross the Server → Client boundary directly. The dashboard nav's
account menu also passes `switchKits` via `@merqo/ui`'s `getSwitchKits("paykit")`
helper (qkit/loopkit/stockkit, resolved to their real `<kit>.merqo.io`
domains as of v0.14.1 — v0.14.0 had pointed at each kit's `-sg.vercel.app`
deployment host instead, a different domain from the shared-session
cookie's `.merqo.io` scope) so a signed-in vendor can jump to another
kit's dashboard via the shared SSO cookie — see `src/app/dashboard/README.md`. The admin console's
Pricing section wraps `@merqo/ui`'s `PricingForm` (paykit's first real
adopter of that component). Every `/dashboard`
route shares one layout-level content-width container (`mx-auto w-full
max-w-7xl` in `src/app/dashboard/layout.tsx`, matching qkit's canonical
dashboard width) instead of each page setting its own, inconsistent width
— pages needing a narrower reading width (forms, short card stacks) nest
an inner `mx-auto max-w-*` div inside it. Dark mode (`globals.css`'s
`.dark` block) is now actually reachable: `src/app/layout.tsx` wraps the
app in `next-themes`' `ThemeProvider`, which `@merqo/ui`'s always-on
account-menu Light/Dark/System control drives. See `CHANGELOG.md` for the
latest changes, including a fix restoring card/background contrast in
both modes after the Banknote Engrave rebrand had accidentally collapsed
them to the same color, two follow-ups that widened the gap further
(light mode, then dark mode again) after each pass still read as too
subtle at a glance, and security bumps of `next` to `16.3.4`,
`browserslist` to `4.28.9`, and `vitest` to `4.1.11`.

`getVendorSession` (`@/lib/vendor-session`) — paykit's single vendor-gate
entry point — also redirects a signed-in vendor with a stale terms/privacy
acceptance to `/legal/accept` before any dashboard page renders. paykit
owns no acceptance record itself; merqo does (`src/app/legal/README.md`,
`@merqo/ui` bumped to v0.25.0). `TermsAcceptanceCheckbox` no longer
collects a typed legal name — just the agree checkbox — since a plain
ToS/Privacy clickwrap doesn't need a signatory name for evidentiary
strength beyond the existing acceptance record. `/about` is a public
"Why Merqo" page rendering `@merqo/ui`'s shared `AboutMerqo` content,
linked from the landing `Nav` and footer.

The page chrome matches the other Merqo kits. `src/components/site-footer.tsx`
wraps `@merqo/ui`'s `Footer` (with a `Vendor sign in →` link on the landing
page and `/about`, without it in the dashboard), and the dashboard shell keeps
that footer at the bottom of a short page. Every page sets its own tab title
through the root layout's `%s | Paykit` template, and an unknown route gets a
branded `not-found.tsx` beside the existing error boundary. The plan page
compares Free and Pro with the shared `PlanComparisonTable`.

Sign-in (`/login`) supports email+password (with a "Check your email"
confirmation state and a real forgot-password flow) and Google OAuth. Once
signed in, a Free-tier vendor can file a real, one-click Pro-upgrade request
from the dashboard's Plan page — no payment provider involved; Pro is
granted manually, via a Merqo-team-only admin console (`/admin`, gated by
an `admins` allow-list) with platform-wide stats, a per-vendor plan
toggle, and a live Pro-price editor (`paykit.pricing`, `@merqo/ui`'s
`PricingForm`) — the Pro price (seeded at $4.99/mo) can be changed with no
redeploy, and every page that quotes it (plan page, dashboard nudge,
landing copy) reads it live instead of a hardcoded string. Pro's one
remaining gate is refund tracking; revenue stats are free for every
vendor. `/api/merqo/vendor-status` (merqo hub's own vendor-active/plan
lookup) paginates the Supabase admin-users API properly, via the same
`listAllUsers` helper the admin console uses — it no longer silently
truncates at the first 1000 auth users. `/api/merqo/metrics` now exists too
— merqo hub's cross-kit health/revenue dashboard already polled it the same
as qkit's and loopkit's, but paykit had no implementation, so it silently
never showed up there. `/api/merqo/vendor-activity` (merqo hub's
per-vendor `/admin/vendors/[email]` detail card) resolves one vendor's
plan, triage status (reusing `src/lib/vendor-health.ts`'s existing
`attention`/`stuck`/`quiet`/`new`/`healthy` vocabulary), and trailing-30d
transaction/volume/refund-rate metrics by email — same bearer secret and
email-lookup convention as `vendor-status`. The landing footer matches qkit's exactly (single-row
wordmark/tagline/copyright/sign-in link, no CTA band above it), and the
landing page's `BackToTop` button matches the cross-kit landing-page
parity pass.

Event-cart vendors (weddings, private events) can now take a deposit now
and bill the balance closer to the event instead of one-shot checkout —
`/dashboard/bookings` (`src/app/dashboard/bookings/README.md`). The
booking detail page shows the booking's own ID with a one-click copy
button — the one value a vendor needs to paste into qkit's booth
settings to link the two, previously only readable from the URL bar. A booking
links up to two `transactions` rows (deposit, then later balance) by id;
a Postgres trigger (`sync_booking_status()`,
`supabase/migrations/0010_paykit_bookings.sql`) keeps `bookings.status`
correct off those transactions' own `confirmed` state regardless of which
path confirmed them — the dashboard or the bearer-secret
`/api/v1/checkout/{id}/confirm` API another kit's flow calls. Reminders
are a dashboard-only "balance due soon/overdue" badge this round — this
repo has no cron or push-notification infrastructure, so it's computed at
render time (`src/lib/booking-status.ts`), not a push. The checkout-
creation logic `POST /api/v1/checkout` used is now shared, via
`src/lib/checkout.ts`, with the booking actions that create a deposit/
balance checkout directly from the dashboard instead of round-tripping
through HTTP. A booking can be rescheduled (dates change, no new status —
a deposit already paid stays counted) or cancelled with an optional refund
against its one unambiguously confirmed transaction, reusing the existing
Pro-gated `refunds` ledger rather than a second mechanism. Creating a
booking or its balance checkout now logs to the admin audit trail too,
closing the last two real gaps in that coverage. An accrual-aware
earnings report (`/dashboard/reports/earnings`, free for every vendor) —
revenue by month and by booking, tagged by event date rather than
claim/confirm date, CSV export — rounds out the event-cart bookings
feature set. A calling kit whose own vendor already knows their booking's
id (they created it here) can read its live status read-only via
`GET /api/v1/bookings/{booking_id}` — bearer-secret authenticated, same
trust model as every other `/api/v1/*` route — see
`src/app/api/v1/bookings/[booking_id]/README.md`.

`@merqo/ui` bumped to v0.27.0 (2026-09-15), which adds `DashboardTours` — a
route-matched multi-tour router for kits with more than one dashboard-page
tour (qkit's first consumer); purely additive, this kit's own `DashboardTour`
usage is unchanged.

`@merqo/ui` bumped to v0.29.3 (2026-09-16) — a radix-ui lockfile re-resolve
(v0.29.2's caret-range fix alone didn't move a sticky lockfile); no
consumer-facing change.

Client components exported by `@merqo/ui` require serializable props from a Server
Component — never a function, and
never a component reference such as `LinkComponent={Link}`. Both forms
crash at render with `Functions cannot be passed directly to Client
Components`, and because the crash happens at request time on a dynamic
route, `next build` does not catch it. The fix is one of two shapes: drop
the optional prop and let the component's own fallback render (this is
what `BackButton` on `/dashboard/plan` and `/dashboard/profile` now
does), or move the props into a `"use client"` wrapper that owns them
(`reports/earnings/earnings-tables.tsx` for `DataTable`'s `cell`/
`getRowKey`, matching the existing `admin/vendors` `VendorsTable`).
The full incident writeup lives in qkit at
`docs/meta/2026-09-18-social-links-backbutton-rsc-crash-aar.md`, and
`../merqo-ui/docs/usage-matrix.md` records which kit uses which export.

The booking detail page's deposit/balance QR codes render through
`@merqo/ui`'s shared `qrSvg`, generated server-side and passed down as a
plain markup string, so `react-qr-code` no longer ships to the browser on
that route. `react-qr-code` remains a dependency for
`dashboard/config/payment-config-form.tsx`, whose preview payload is
derived live from form state — `qrSvg` is async and server-only, so the
two are complements rather than replacements.

`@merqo/ui` bumped to v0.32.0 (2026-09-22). The payment config form's QR
image now uploads only when the vendor clicks Save (`deferUpload` +
`commitPendingImages`), so abandoning the form leaves nothing in storage; a
failed save deletes what it uploaded. Profile icons still upload on pick,
because picking one is the save.

Replacing or clearing a pointer config's QR image now deletes the old image
from storage (`removeReplacedQrImage` in `src/lib/qr-image-cleanup.ts`), from
both the dashboard config form and the kit config API. The image may have been
uploaded from paykit (`vendor-images`) or from qkit's booth form
(`booth-images`); both are checked, and only objects in the vendor's own
folder are ever deleted.

The payment setup page (`/dashboard/config`) accepts `return_to`, the page in
another Merqo app to go back to. After a save it shows a "Back to your booth"
link to that address, and only when the address is https on `merqo.io` or a
subdomain of it (`familyReturnUrl` in `src/lib/return-to.ts`). This is what
lets a calling kit send a vendor here to enter payment details instead of
keeping a payment form of its own.

`@merqo/ui` bumped to v0.34.1 (2026-10-16), which fixes `BackButton`: without
a `LinkComponent` it dropped its button styling, so "Dashboard" on the plan
and profile pages showed the arrow stacked above the label.

`@merqo/ui` bumped to v0.31.4 (2026-09-22), for its new
`storagePathFromPublicUrl`. Replacing or removing a profile icon now deletes the
old image from storage (`removeReplacedAvatar` in
`src/lib/image-upload-adapter.ts`); before this, every avatar change orphaned one
file, because `ImageUploader` names each upload randomly.

`@merqo/ui` bumped to v0.31.3 (2026-09-22), which stops `resizeToWebp`
mislabelling a PNG as WebP on browsers that cannot encode WebP (it now falls
back to JPEG, so those uploads are no longer oversized). Before that, v0.31.2
(2026-09-19). v0.31.0 replaced the
package-wide `"use client"` banner with per-module directives, so a
plain-data export is a real value inside a Server Component rather than an
opaque client-reference stub — the root cause of the 2026-09-18 RSC
crashes. It also promoted four modules paykit had its own copy of:
`safeRedirectPath`, `resizeToWebp`, `BackToTop` and `GoogleMark`. The
bookings and transactions tables joined the earnings and admin-vendors
tables on the shared `DataTable`, and the social-link inputs now use the
shared `SocialLinksFields` — paykit had kept plain lucide glyphs to avoid
the `@icons-pack/react-simple-icons` dependency, but the shared package
carries it, so those fields now show real brand marks like every other
repo. v0.31.1 fixes a latent `resizeToWebp` bug where a dotless filename
yielded the whole name as its extension. Which repo uses which shared
export is tracked in `../merqo-ui/docs/usage-matrix.md`.

See `AGENTS.md` for stack, commands, data model, rules, and the AI
harness/CI setup (templateCentral-based); `CHANGELOG.md`
for what's shipped since the MVP, including the "Name | Tagline" Title Case
browser-tab title convention shared across every Merqo kit. Folder-level `README.md`s (`src/lib/`,
`src/components/`, and their subfolders) cover what each module does and
how it's wired together. See
`docs/superpowers/specs/2026-07-15-paykit-mvp-design.md` for the original
approved design and `docs/superpowers/plans/2026-07-15-paykit-mvp.md` for
its implementation plan — later work has its own dated specs/plans under
the same `docs/superpowers/` folders.

Source lives in the `merqo-io` GitHub organization (`github.com/merqo-io/paykit`); `@merqo/ui` installs from `github:merqo-io/merqo-ui`.

`e2e/` holds the Playwright public smoke and auth-guard specs, run with `pnpm test:e2e` (see its own README).

## October 2026 audit status

Booking deposit checkout failures now preserve the booking and expose a vendor-scoped retry action. Migration0016 adds atomic, validated deposit linking and confirmation reconciliation. It is prepared but not applied; see [the audit evidence](docs/paykit-audit-2026-10-08.md) for verification and remaining findings.

The shared UI dependency is pinned to immutable commit 7b386558af36a1cbf008a9b4c4073c07ffc105ba, tagged `v0.34.2`, carrying the reviewed upload lifecycle, storage URL validation and safe money parsing fixes. Since `v0.32.1`, `Section` title tooltips and default-mode `InfoTooltip`s open on a tap as well as on hover and keyboard focus. Since `v0.32.2` every info icon also takes taps through a 44px touch area on touch devices. Since `v0.32.3` a long tooltip wraps inside the viewport. Since `v0.34.2` signing out from the account menu, whose `signOutAction` ends in `redirect("/login")`, no longer flashes "NEXT_REDIRECT" under the Sign out item. pnpm 11.10 permits preparation only for that exact locked source URL; update the dependency and its build allowlist together, leaving no entry for an older commit. Scripts under `scripts/` keep LF endings on every platform (`.gitattributes`), because Vitest cannot load a shebang script checked out with CRLF. `*.sh` files keep LF too, so `scripts/staging-migrate.sh` runs in its Linux container from a Windows checkout.

Component consolidation is documented in [the cleanup spec](docs/meta/2026-10-10-component-reuse-spec.md). Shared presentation components retain payment configuration boundaries and monetary input validation.

The AI harness follows templateCentral 6.0.4: hook commands are anchored on the project directory, and the guard against committing to `main` reads the branch of the directory a command runs in. The dated entry in `AGENTS.md` lists what was adopted.

Payment screenshots belong to the transaction. A calling kit may attach the customer's screenshot to `POST /api/v1/checkout/{id}/claim` as a `multipart/form-data` `proof` file; paykit keeps it in the private `paykit-payment-proofs` bucket with one `payment_evidence` row (migration `0022`, applied by hand). `GET /api/v1/checkout/{id}/evidence` returns a 300-second link to it plus two hints, `duplicate_of` and `amount_match`. The amount is read out of the screenshot on the server with Tesseract (`src/lib/proof-ocr.ts`, language data in `ocr-data/`), after the claim has answered. Neither hint ever changes a transaction's status. `ocr-data/` and the `outputFileTracingIncludes` entry in `next.config.ts` must stay together: without the entry the amount check fails silently on Vercel. See `src/app/api/v1/checkout/[id]/evidence/README.md` and the `payment_evidence` entry in `AGENTS.md`'s data model section.

The customer can pay on a page paykit hosts. A calling kit passes `return_url` and `title` to `POST /api/v1/checkout` and sends the customer to the `pay_url` it answers. `/pay/{transaction_id}?k=<token>` is one of paykit's two public, unauthenticated pages: the random token in the link is the whole authorization (paykit keeps only its sha256), `return_url` must be on the kit's registered `kit_api_keys.return_origin`, and the page takes the screenshot and the claim through the same `claimTransaction` as the claim endpoint before sending the customer back. Migration `0024` (applied by hand) adds the columns. See `src/app/pay/[id]/README.md`.

## Booking inquiries

An event vendor can take inquiries before there is a booking. On Bookings they set up an inquiry form (business name, an optional link to their own booking terms with a version) and share its public link, `/inquire/{public_id}`, paykit's second public page. A client sends their name, phone, an optional event date and a message, ticks the vendor's terms when the vendor set some (paykit records the url, version and time), and sees the PDPA collection notice. There is no marketing consent box. A honeypot field, a 3 second fill-time check and per-address and per-form rate limits keep bots out. The vendor gets a Telegram alert through merqo's shared vendor bot, works the inquiry from the Inquiries table and converts it into a normal booking. Migration `0025` (applied by hand) adds the tables. Design: `docs/superpowers/specs/2026-10-23-booking-inquiries-design.md`; code: `src/app/inquire/`, `src/app/dashboard/bookings/`.

## Security headers and MFA

`src/proxy.ts` sets the CSP (nonce on per-request routes) and `X-Robots-Tag` off production. The admin area requires TOTP MFA; see `src/app/mfa/README.md` and `docs/security/`.
