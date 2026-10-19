# vendors

## Purpose

Admin vendors console — every vendor with a payment config, their triage
status, plan, transaction count, and a Free/Pro plan toggle.

## Contents

- `page.tsx` — `AdminVendorsPage`: `requireAdmin()` + fetches
  `listVendors()` (pre-sorted most-urgent status first) and renders
  `VendorsTable` inside `@merqo/ui`'s `ElevatedCard`.
- `vendors-table.tsx` — `VendorsTable`: `"use client"` wrapper owning the
  `columns` array (`cell` render callbacks) and the `getRowKey` function it
  passes to `@merqo/ui`'s shared `DataTable` — vendor email with
  `payee_name`/`label` as a muted subline, a `VendorStatusBadge` status
  column, plan badge, transaction count, joined date, and a
  `VendorPlanToggle` action column. Client-side because `DataTable` is a
  `@merqo/ui` Client Component and function props (`cell`, `getRowKey`)
  can't be passed to it from `page.tsx`'s Server Component (same pattern as
  `../activity/activity-section.tsx`).
- `vendor-status.tsx` — `VendorStatusBadge`: wraps `@merqo/ui`'s shared
  `StatusBadge` with a `Record<VendorStatus, StatusBadgeConfig>` built from
  paykit's own theme-aware brand tokens (`destructive`/`primary`/`muted`/
  `flow`/`mint`) — one color per triage band from `@/lib/vendor-health`.
- `vendor-plan-toggle.tsx` — `VendorPlanToggle`: calls the `setVendorPlan`
  Server Action to flip a vendor's `vendor_payment_config.plan` between
  `free` and `pro` immediately, no confirm modal.

## Tab title

`page.tsx` exports `metadata.title = "Vendors"`, which the root layout's `%s | Paykit` template turns into "Vendors | Paykit". `src/app/page-titles.test.ts` checks it.

## Parent

[admin](../README.md)
