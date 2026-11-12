# admin

## Purpose

Merqo-team internal admin console — the gated layout, shared nav, and shared
figure-tile helper used by the overview and vendors screens.

## Contents

- Plans and pricing are not editable here: merqo owns them and pushes each
  vendor's entitlement to `/api/merqo/entitlement`. `recordAudit()` lives in
  `src/lib/admin-audit.ts` so mutating actions outside `/admin` (e.g.
  `issueRefundAction` in `dashboard/transactions/actions.ts`) can append an
  `admin_audit` row, see `admin_audit`'s own retention/immutability notes in
  the repo-root `AGENTS.md`.
- `activity/`
- `admin-nav.tsx` — `AdminNav` client component: the Overview/Vendors/Activity
  tab bar, a labelled nav whose active link carries `aria-current="page"`
  (44px targets).
- `layout.tsx` — `AdminLayout`: gates every `/admin` route with
  `requireAdmin()`, renders the header (wordmark, Admin badge, sign-out) and
  `AdminNav`.
- `page.tsx` — `AdminOverviewPage`: platform-wide stat tiles (vendors by
  plan, transactions by status, confirmed volume with 7d/30d deltas, and a
  trailing-30d refund count/volume tile), a Security stat block (failed
  bearer-auth attempts and rate-limited kits, both trailing 24h — see
  `securityStats()` in `@/lib/admin-data`), a recent cross-vendor activity
  feed (flat bordered card, or `EmptyState` when empty). Page titles use the
  shared `PageHeader`; statuses read Awaiting payment / Marked paid / Received.
- Overview figures use `@merqo/ui`'s shared `StatCard` (label/value plus optional
  `caption` and a period-over-period `delta`/`deltaTooltip` pill, `deltaSize="xs"`).
- `vendors/`

## Connectivity

`vendors/` and `activity/` are the admin sections linked from
`admin-nav.tsx`'s tab bar (alongside this folder's own `page.tsx` for
Overview); all render inside `layout.tsx`'s gated shell. `vendors/page.tsx`
is read-only. `activity/page.tsx` pulls `admin-data.ts`'s `auditLog()`
(read-only — no Server Action of its own).

## Tab title

`page.tsx` exports `metadata.title = "Admin overview"`, which the root layout's `%s | paykit` template turns into "Admin overview | paykit". `src/app/page-titles.test.ts` checks it.

## Parent

[app](../README.md)

Every page and action is gated by `requireAdmin()`, which needs `aal2`; a password-only session is redirected to `/mfa`. Service-client imports carry an eslint-disable reason.

Buttons, inputs, dialogs, badges and the other shared primitives here are imported from `@merqo/ui/primitives`, not from a local `components/ui` copy.

`loading.tsx` is the `/admin/*` loading fallback (shared `Skeleton`): it keeps the page's `<main>` landmark and marks an inner element `role="status"` with an sr-only "Loading" label.
