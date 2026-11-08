# vendors

## Purpose

Admin vendors console — every vendor with a payment config, their triage
status, plan (read-only, from the entitlement cache), and transaction count.

## Contents

- `page.tsx` — `AdminVendorsPage`: `requireAdmin()` + fetches
  `listVendors()` (pre-sorted most-urgent status first) and renders
  `VendorsTable` in a flat bordered card, or `EmptyState` when there are no
  vendors, under the shared `PageHeader`.
- `vendors-table.tsx` — `VendorsTable`: `"use client"` wrapper owning the
  `columns` array (`cell` render callbacks) and the `getRowKey` function it
  passes to `@merqo/ui`'s shared `DataTable` — vendor email with
  `payee_name`/`label` as a muted subline, a `VendorStatusBadge` status
  column, plan badge, transaction count, and joined date. Client-side because `DataTable` is a
  `@merqo/ui` Client Component and function props (`cell`, `getRowKey`)
  can't be passed to it from `page.tsx`'s Server Component (same pattern as
  `../activity/activity-section.tsx`).
- `vendor-status.tsx` — `VendorStatusBadge`: wraps `@merqo/ui`'s shared
  `StatusBadge` with a `Record<VendorStatus, StatusBadgeConfig>` built from
  paykit's own theme-aware brand tokens (`destructive`/`primary`/`muted`/
  `flow`/`mint`) — one color per triage band from `@/lib/vendor-health`.

## Tab title

`page.tsx` exports `metadata.title = "Vendors"`, which the root layout's `%s | paykit` template turns into "Vendors | paykit". `src/app/page-titles.test.ts` checks it.

## Parent

[admin](../README.md)

Page chrome here (PageHeader and EmptyState) comes from `@merqo/ui`; paykit keeps no local copy.

Buttons, inputs, dialogs, badges and the other shared primitives here are imported from `@merqo/ui/primitives`, not from a local `components/ui` copy.
