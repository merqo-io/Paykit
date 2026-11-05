# stats

## Purpose

Home of the revenue chart that backs the Reports Overview tab
(`/dashboard/reports`), plus a redirect for the old `/dashboard/stats` URL.
Revenue stats are free for every vendor regardless of plan; only refund
tracking is Pro (see `dashboard/plan/`).

## Contents

- `page.tsx` — `StatsRedirect()`: redirects to `/dashboard/reports` so old
  bookmarks keep working. No metadata or data fetching.
- `revenue-chart.tsx` — `RevenueChart({ data })`: client component. A 3-tile
  stat row (`StatTile`: Total revenue, Payments, Avg / day) sits above a
  `recharts` `BarChart` (dollars by day, bars filled with `var(--color-mint)`)
  in a `ResponsiveContainer`. `ChartTooltip` shows the SGD-formatted date,
  amount and payment count on hover, without a shadow. Recharts renders an
  inline SVG with no text alternative, so the wrapping `div` carries
  `role="img"` plus a summarizing `aria-label`, and an `sr-only` `<table>`
  holds the per-day numbers.
- `page.dom.test.tsx` — the redirect target.
- `revenue-chart.dom.test.tsx` — aria-label summary branches, the sr-only
  table and the 3 stat tiles (including the empty state).

## Connectivity

Rendered by `../reports/page.tsx`. Data comes from `@/lib/transactions` and
`@/lib/revenue-report`.

## Parent

[dashboard](../README.md)

## Boundary and coverage

The Reports page uses the complete vendor transaction reader before
aggregation, so database failures surface rather than rendering a plausible
partial chart. The stat cards compose shared StatTile with local label
typography, value spacing and the existing border/padding shell.
