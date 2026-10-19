# plan

## Purpose

The vendor's billing page: current tier, this month's transaction count, the
Free feature list vs. Pro's (Free gets unlimited transactions + revenue
stats; Pro adds refund tracking, the one remaining gate), and — for Free
vendors — a real Pro-upgrade CTA. Pro's price is read live from the
admin-tunable `pricing` table (`@/lib/pricing`), not a hardcoded constant.
No payment provider is involved; Pro is granted manually once a vendor's
upgrade request comes in.

## Contents

- `page.tsx` — `PlanPage()` (server, `revalidate = 0`): calls
  `getVendorSession()`/`getVendorPlan()`, `txCountThisMonth()`, and
  `getPricing()` (`@/lib/pricing`), resolves the free/pro branching through
  `resolvePlanView()` (`@/lib/plan-view`), and renders the plan card +
  feature list + (Free only) the nudge copy, `UpgradeCta`, and a one-line
  turnaround expectation ("We usually action this within one business
  day.") under the CTA. Kept deliberately thin — the feature list, count-copy
  pluralization, nudge/upgrade visibility, and the live price's display
  formatting are pure logic in `plan-view.ts`, not inline JSX branching, so
  they're unit-testable without rendering this async server component.
  Content sits in a plain `mx-auto max-w-2xl` div (not `<main>` — the parent
  `dashboard/layout.tsx` owns that landmark and the page-family's canonical
  `max-w-7xl` outer width); the plan card + feature list read better
  narrower than the full dashboard width. The "Dashboard" back-nav button is
  `@merqo/ui`'s `BackButton`, rendered with no `LinkComponent` (defaults to
  a plain `<a>` tag) — `LinkComponent={Link}` was removed 2026-09-19:
  the shared package at the time used a package-wide client banner, so passing a component
  reference into it as a prop from this Server Component 500'd in
  production (invisible to `next build`/jsdom tests; same bug class
  already fixed in the sibling qkit repo, PRs #159/#160).
- `upgrade-cta.tsx` — `UpgradeCta`: client component, "Ask us to upgrade to
  Pro" button. Calls `requestProUpgradeAction()` (`@/app/actions/plan`) in a
  transition and toasts success/failure — mirrors qkit's `UpgradeCta`
  pattern, simplified for paykit's single free→pro path.
- `upgrade-cta.dom.test.tsx` — jsdom tests: renders idle with no action
  call, files the request and toasts success, toasts the action's error
  message on failure.
- `page.dom.test.tsx` — awaits `PlanPage()` directly and renders the result
  (same pattern as `dashboard/layout.dom.test.tsx`): Free vs. Pro plan
  copy/feature list, the nudge-threshold branch, and that the upgrade CTA
  only shows for Free vendors.

## Connectivity

Reachable from `dashboard-nav.tsx`'s account-menu "Plan" item. `page.tsx`
reads plan/usage state via `@/lib/vendor-session` and `@/lib/transactions`,
formats it via `@/lib/plan-view`, and renders `upgrade-cta.tsx`, which calls
the `requestProUpgradeAction` server action in `src/app/actions/plan.ts`
(files into the shared `merqo.support_messages` inbox, category `billing`).

## Tab title

`page.tsx` exports `metadata.title = "Plan"`, which the root layout's `%s | Paykit` template turns into "Plan | Paykit". `src/app/page-titles.test.ts` checks it.

## Parent

[dashboard](../README.md)

The shared package now preserves each module's own client/server directive.
These wrappers retain local callback ownership and historical fix provenance;
the package no longer applies a blanket client banner.
