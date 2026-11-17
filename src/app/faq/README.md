# faq

## Purpose

The public `/faq` page: full answers for vendors beyond the four rows on the
landing page.

## Contents

- `page.tsx`: `FaqRoute`, an async Server Component. Reflects the session
  (same pattern as `src/app/about/page.tsx`) so `Nav` shows Dashboard or Sign
  in, then renders `@merqo/ui`'s shared `FaqPage` between `Nav` and
  `SiteFooter`. No `closing` line is passed, and the schema.org JSON-LD is on.
  Its typed `metadata.title` is "FAQ", shown as "FAQ | paykit".
- `faq-content.ts`: the intro and the three groups of rows (nine in total).
  The copy says paykit is in build and never names plans or prices; the cost
  row reuses `PILOT_PRICING_LINE`.
- `page.dom.test.tsx`: covers the groups and rows, the missing closing line,
  the JSON-LD, opening a row by touch, and the copy guardrails.

## Connectivity

Linked from `Nav` (`src/components/landing/nav.tsx`).

## Parent

[app](../README.md)
