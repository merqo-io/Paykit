# plan

## Purpose

The vendor's plan page: current plan, this month's transaction count,
a link to the Merqo account (`merqoBaseUrl()/dashboard`), a Free-only "what paid plans add" list (its closing line names the catalog's plans, with a literal Starter and Pro fallback) with a count of payments older than the 30-day cutoff, and merqo's plan catalog rendered by
`@merqo/ui`'s `PricingLadder`. Merqo owns pricing and subscriptions, so paykit
stores no price: the catalog is fetched from merqo's `/api/plans` (sent with the kit bearer from `MERQO_CUSTOMER_SECRET` when set), and
when it is unreachable the page shows a calm "Prices are unavailable" line. The
plan is read from the entitlement cache. Since `@merqo/ui` v0.46.0 the ladder renders a pilot notice above the
plans ("Merqo is free during the pilot...").

## Contents

- `page.tsx` — `PlanPage()` (server, `revalidate = 0`): calls
  `getVendorSession()`, `readVendorPlan()` (`@/lib/vendor-entitlement`, falling
  back to Free when the read fails) and `txCountThisMonth()` and
  `fetchPlanCatalog(merqoBaseUrl())` in parallel, resolves the view through
  `resolvePlanView()` (`@/lib/plan-view`), and renders the plan card and
  `<PricingLadder highlight="qkit" showEventPass={false} />` (Pro; Event Pass is a qkit offer, so the ladder hides it) (or the unavailable line). Content sits in a plain
  `mx-auto max-w-2xl` div (not `<main>`, the parent `dashboard/layout.tsx`
  owns that landmark). The header is the local `PageHeader` (no eyebrow); there is no back button, since the avatar menu and wordmark lead home.
- `page.dom.test.tsx` — awaits `PlanPage()` directly and renders the result
  (same pattern as `dashboard/layout.dom.test.tsx`): Free and Pro plan copy,
  the Merqo account pointer, prices only from a mocked catalog, and the
  null/rejected catalog fallback with no price. It also asserts the pilot notice renders and the Event Pass block does not.

## Connectivity

Reachable from `dashboard-nav.tsx`'s account-menu "Plan" item. `page.tsx`
reads plan state via `@/lib/vendor-entitlement` and usage via
`@/lib/transactions`, and formats it via `@/lib/plan-view`.

## Tab title

`page.tsx` exports `metadata.title = "Plan"`, which the root layout's `%s | paykit` template turns into "Plan | paykit". `src/app/page-titles.test.ts` checks it.

## Parent

[dashboard](../README.md)

Page chrome here (PageHeader) comes from `@merqo/ui`; paykit keeps no local copy.

The merqo base URL used by the page comes from `@merqo/ui/kit-api`.

Signed-out and stale-terms vendors come back here after sign-in or terms acceptance: the page passes its own path and query to `getVendorSession` as `returnTo`.
