# plan

## Purpose

The vendor's plan page: current plan, this month's transaction count, the Free
vs. Pro feature list (Free gets unlimited transactions + revenue stats; Pro
adds refund tracking, the one remaining gate), and the line "Change plan from
your Merqo account." Merqo owns pricing and subscriptions, so the page shows no
price and has no upgrade action; the plan is read from the entitlement cache.

## Contents

- `page.tsx` — `PlanPage()` (server, `revalidate = 0`): calls
  `getVendorSession()`, `readVendorPlan()` (`@/lib/vendor-entitlement`, falling
  back to Free when the read fails) and `txCountThisMonth()`, resolves the
  view through `resolvePlanView()` (`@/lib/plan-view`), and renders the plan
  card and `@merqo/ui`'s `PlanComparisonTable`. Content sits in a plain
  `mx-auto max-w-2xl` div (not `<main>` — the parent `dashboard/layout.tsx`
  owns that landmark). The "Dashboard" back-nav button is `@merqo/ui`'s
  `BackButton`, rendered with no `LinkComponent`: passing a component
  reference into it as a prop from this Server Component 500'd in production
  (invisible to `next build`/jsdom tests).
- `page.dom.test.tsx` — awaits `PlanPage()` directly and renders the result
  (same pattern as `dashboard/layout.dom.test.tsx`): Free and Pro plan copy,
  the Merqo account pointer, no price and no button.

## Connectivity

Reachable from `dashboard-nav.tsx`'s account-menu "Plan" item. `page.tsx`
reads plan state via `@/lib/vendor-entitlement` and usage via
`@/lib/transactions`, and formats it via `@/lib/plan-view`.

## Tab title

`page.tsx` exports `metadata.title = "Plan"`, which the root layout's `%s | paykit` template turns into "Plan | paykit". `src/app/page-titles.test.ts` checks it.

## Parent

[dashboard](../README.md)
