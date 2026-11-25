# reports

## Purpose

The Reports page (`/dashboard/reports`, the third nav link): one `PageHeader`
titled "Reports" over two server-rendered tabs. The
active tab comes from `?tab=` (`overview` default, or `earnings`) and the
earnings year from `?year=`; both are Zod-validated in `search-params.ts` and
fall back to safe defaults. A Free vendor (or an unreadable plan) sees only
today's and yesterday's totals by Singapore date on Overview and a lock on
Earnings (which holds the CSV export); a paid plan sees the full chart,
earnings and export. Free never loads the hidden ranges.

## Contents

- `page.tsx` — `ReportsPage({searchParams})` (server, async `searchParams`):
  reads the plan, then fetches only the active tab's data. Paid: Overview
  renders `../stats/revenue-chart` or a dashed `EmptyState`; Earnings renders
  `EarningsPanel`. Free: Overview renders `FreeRevenueSummary` from
  `listConfirmedBetween`; Earnings renders a `ProLock`.
- `free-revenue-summary.tsx` — `FreeRevenueSummary({ today, yesterday })`:
  two `StatCard`s (today and yesterday, each captioned with its payment count) and a `ProLock` to the plan page
  for the weekly and monthly ranges.
- `search-params.ts` — `parseReportsParams()` (Zod, `.catch` defaults) and
  `reportsHref()`, the single place that builds report URLs. The default
  earnings year is the Singapore year. `search-params.test.ts` covers it.
- `reports-tabs.tsx` — `ReportsTabs`: plain `Link`s with `aria-current`, so
  tabs are deep-linkable with no client state.
- `page.dom.test.tsx` — tabs, overview/earnings rendering, year arrow labels,
  empty states, param fallbacks, and the Free gates (today/yesterday only,
  locked Earnings, no CSV button, no full-history read).
- `earnings/` — the Earnings tab's panel and old-URL redirect (own README).

## Parent

[dashboard](../README.md)

Page chrome here (PageHeader and EmptyState) comes from `@merqo/ui`; paykit keeps no local copy.

Buttons, inputs, dialogs, badges and the other shared primitives here are imported from `@merqo/ui/primitives`, not from a local `components/ui` copy.

`search-params.ts` keeps `REPORT_TABS` module-private; only the parser and the `ReportTab` type are exported.

Money and times here come from `@merqo/ui` (`Money`, `formatMoney`, `Timestamp`, `formatDate`, `formatDateTime`): "S$4.50", "7 Nov 2026", Singapore time.
