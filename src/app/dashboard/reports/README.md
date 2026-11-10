# reports

## Purpose

The Reports page (`/dashboard/reports`, the third nav link): one `PageHeader`
titled "Reports" over two server-rendered tabs, free for every vendor. The
active tab comes from `?tab=` (`overview` default, or `earnings`) and the
earnings year from `?year=`; both are Zod-validated in `search-params.ts` and
fall back to safe defaults. Plan gating covers refund tracking only, so
nothing here is Pro-gated.

## Contents

- `page.tsx` — `ReportsPage({searchParams})` (server, async `searchParams`):
  fetches only the active tab's data. Overview renders `../stats/revenue-chart`
  or a dashed `EmptyState`; Earnings renders `EarningsPanel`.
- `search-params.ts` — `parseReportsParams()` (Zod, `.catch` defaults) and
  `reportsHref()`, the single place that builds report URLs.
- `reports-tabs.tsx` — `ReportsTabs`: plain `Link`s with `aria-current`, so
  tabs are deep-linkable with no client state.
- `page.dom.test.tsx` — tabs, overview/earnings rendering, year arrow labels,
  empty states, param fallbacks.
- `earnings/` — the Earnings tab's panel and old-URL redirect (own README).

## Parent

[dashboard](../README.md)

Page chrome here (PageHeader and EmptyState) comes from `@merqo/ui`; paykit keeps no local copy.

Buttons, inputs, dialogs, badges and the other shared primitives here are imported from `@merqo/ui/primitives`, not from a local `components/ui` copy.

`search-params.ts` keeps `REPORT_TABS` module-private; only the parser and the `ReportTab` type are exported.
