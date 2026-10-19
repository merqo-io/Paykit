# admin

## Purpose

Merqo-team internal admin console — the gated layout, shared nav, and shared
figure-tile helper used by the overview and vendors screens.

## Contents

- `actions.ts` — Server Actions (admin-only via `requireAdmin()`):
  `setVendorPlan` writes `vendor_payment_config.plan` directly via the
  service-role client (the intended write path — `plan` is writer-restricted
  to service_role only, see `0001_paykit_core.sql`), then appends an
  `admin_audit` row; `setPricing` updates the single `pricing` row
  (`monthly_cents`) the same way, revalidating every route that displays
  the price. `recordAudit()` lives in `src/lib/admin-audit.ts` so other real mutating
  actions outside `/admin` (e.g. `issueRefundAction` in
  `dashboard/transactions/actions.ts`) can append an `admin_audit` row too
  — see `admin_audit`'s own retention/immutability notes in the repo-root
  `AGENTS.md`.
- `activity/`
- `admin-nav.tsx` — `AdminNav` client component: the Overview/Vendors/Activity
  tab bar, highlighting the active section by path.
- `layout.tsx` — `AdminLayout`: gates every `/admin` route with
  `requireAdmin()`, renders the header (wordmark, Admin badge, sign-out) and
  `AdminNav`.
- `page.tsx` — `AdminOverviewPage`: platform-wide stat tiles (vendors by
  plan, transactions by status, confirmed volume with 7d/30d deltas, and a
  trailing-30d refund count/volume tile), a Security stat block (failed
  bearer-auth attempts and rate-limited kits, both trailing 24h — see
  `securityStats()` in `@/lib/admin-data`), a recent cross-vendor activity
  feed (`@merqo/ui`'s `ElevatedCard`-wrapped), and a Pricing section (`PricingSection`)
  for editing the live Pro price.
- `pricing-section.tsx` — `PricingSection`: client component wrapping
  `@merqo/ui`'s `PricingForm` with paykit's single `monthly_cents` field,
  wiring `setPricing` (`onSave`) and the `sonner` toast convention every
  other paykit form already uses.
- `stat.tsx` — `Stat`: a small labeled-value tile (`@merqo/ui`'s `ElevatedCard`-based,
  wrapping `@merqo/ui`'s shared `StatTile`) used on the admin overview page
  — label/value plus optional `caption` and a period-over-period `delta`/
  `deltaTooltip` pill (`deltaSize="xs"`, matching loopkit's own `StatTile`
  wrapper convention).
- `vendors/`

## Connectivity

`vendors/` and `activity/` are the admin sections linked from
`admin-nav.tsx`'s tab bar (alongside this folder's own `page.tsx` for
Overview); all render inside `layout.tsx`'s gated shell. `vendors/page.tsx`
pulls `actions.ts` for the Server Action its `VendorPlanToggle` client
component calls. `activity/page.tsx` pulls `admin-data.ts`'s `auditLog()`
(read-only — no Server Action of its own).

## Tab title

`page.tsx` exports `metadata.title = "Admin overview"`, which the root layout's `%s | Paykit` template turns into "Admin overview | Paykit". `src/app/page-titles.test.ts` checks it.

## Parent

[app](../README.md)
