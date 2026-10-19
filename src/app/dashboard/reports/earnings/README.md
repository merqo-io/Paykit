# earnings

## Purpose

A yearly revenue record for a vendor's own bookkeeping — scoped and labeled
as a **Revenue** figure, not a computed Profit/Loss or a Form-B-ready
submission (paykit only sees inbound confirmed claims, never a vendor's
own costs). Free for every vendor regardless of plan, same as `stats/` —
a view over data (confirmed transactions, bookings) that's already free to
see raw.

Accrual-aware: revenue is tagged by the _event_ the money is for (a linked
booking's `event_date`), not the date the payment was claimed or
confirmed — a deposit collected in one month for an event delivered in a
later one counts toward the later month, matching IRAS's own guidance that
self-employed income is recorded on the date it's earned. A confirmed
transaction with no linked booking (paykit also serves one-shot,
non-booking checkouts) falls back to its own `created_at` date instead of
being silently dropped.

## Contents

- `page.tsx` — `EarningsReportPage({searchParams})` (server, Next 16 async
  `searchParams`): reads an optional `?year=` (defaults to the current UTC
  year), fetches `listTransactions()` + `listBookings()` in parallel, and
  renders `buildEarningsReport()`'s (`@/lib/earnings-report`) result — a
  total-revenue tile, a 12-month table, a per-booking-or-checkout line
  table (hidden when empty), prev/next-year links, and `DownloadCsvButton`.
  Both tables render via `earnings-tables.tsx`'s wrapper components, passed
  plain row data, not `@merqo/ui`'s `DataTable` directly.
- `earnings-tables.tsx` — `"use client"` wrapper, `EarningsMonthsTable`/
  `EarningsLinesTable`, added 2026-09-19: builds the `DataTableColumn`
  `cell`/`getRowKey` callbacks and renders `@merqo/ui`'s `DataTable`
  internally. `page.tsx` can't pass those callbacks to `DataTable` itself —
  the shared package at the time used a package-wide client banner, so a function prop crossing
  straight from this Server Component 500'd in production (invisible to
  `next build`/jsdom tests). Mirrors `admin/vendors/vendors-table.tsx`'s
  existing wrapper pattern; same bug class already fixed in the sibling
  qkit repo (PRs #159/#160).
- `download-csv-button.tsx` — `DownloadCsvButton({report})`, client:
  builds the CSV via `@/lib/earnings-csv`'s `earningsReportToCsv()`
  entirely client-side (the report data is already on the page, non-secret,
  the vendor's own — no server round-trip needed), then a `Blob` +
  `URL.createObjectURL` + a temporary anchor's `.click()` to trigger the
  browser download (`paykit-earnings-<year>.csv`).
- `download-csv-button.dom.test.tsx` — stubs the global `Blob` constructor
  to capture what was actually serialized, and `URL.createObjectURL`/
  `revokeObjectURL`, asserting the CSV content and that the object URL is
  revoked after the click.
- `page.dom.test.tsx` — awaits the async server component directly (same
  pattern as `bookings/[id]/page.dom.test.tsx`): the requested year's
  total/months/lines render, the default-to-current-year path, and the
  per-booking table hiding itself when there's no revenue for the year.

## Connectivity

Reachable from `dashboard-nav.tsx`'s "Earnings" link. `page.tsx` reads via
`@/lib/vendor-session`, `@/lib/transactions`, and `@/lib/bookings`; the pure
aggregation lives in `@/lib/earnings-report`'s `buildEarningsReport()`
(unit-tested directly, no fetch mocking needed) and the CSV serialization
— including formula-injection escaping for `customer_name`, real
vendor-entered text, not app-generated — in `@/lib/earnings-csv`.

## Tab title

`page.tsx` exports `metadata.title = "Earnings report"`, which the root layout's `%s | Paykit` template turns into "Earnings report | Paykit". `src/app/page-titles.test.ts` checks it.

## Parent

[reports](../README.md)

The shared package now preserves each module's own client/server directive.
These wrappers retain local callback ownership and historical fix provenance;
the package no longer applies a blanket client banner.
