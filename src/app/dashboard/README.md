# dashboard

The authenticated vendor area for payment setup, transactions, bookings,
reports, plan requests and account settings.

## Shell

`layout.tsx` obtains the vendor session, shared profile and plan, then composes
`dashboard-nav.tsx` and the shared dashboard tour. The navigation adapter owns
Paykit's routes, brand and tier display, and adapts feedback/support results to
the shared account menu's rejecting-promise contract.

The navigation wrapper uses `contents print:hidden` so it does not constrain the
shared sticky header. One layout-level `main` owns the outer content width;
pages may use narrower inner containers. `LinkComponent={Link}` is supplied by
the client adapter for client-side navigation. Function props cannot be passed
from a Server Component directly to a shared Client Component.

The shell is a `flex min-h-screen flex-col` column: `main` is `flex-1`, so
the family footer (`SiteFooter` without the sign-in link) sits at the bottom
of a short page instead of mid-screen. The footer is wrapped in
`contents print:hidden`, like the navigation, so a printed booking or report
leaves it out.

`loading.tsx` covers page loading inside this shell. `error.tsx` offers retry
for page render/data failures; it cannot catch its own segment's layout errors.

## Routes

- `page.tsx` shows a configured payment-method summary or setup prompt, monthly
  transaction usage and a Free-tier Pro nudge. Usage does not impose a volume cap.
- `config/` saves PayNow or a payment link/QR image. Deferred uploads commit on
  Save; plan is excluded from vendor-writable columns.
- `transactions/` lists vendor transactions and Pro-gated refund bookkeeping.
- `bookings/` manages deposit/balance checkouts, recoverable deposit setup,
  cancellation, rescheduling and printing. Due reminders are dashboard badges.
- `stats/` charts confirmed revenue; `reports/earnings/` provides the yearly
  event-date revenue record and escaped CSV. Both are available to Free vendors.
- `plan/` shows the live price and sends an upgrade request to Merqo support.
- `profile/` saves shared stall name/social links and Supabase account metadata.

`tour-actions.ts` and the overview's server-render stamp delegate to
`lib/tour-prefs.ts`. Both are best-effort; navigation or a failed write can
prevent persistence, so the tour must not be treated as business authorization.

## Verification

Layout tests cover the sticky wrapper and single header. Navigation tests cover
route links, feedback/support adaptation, sign-out and product switching.
Overview tests cover payment summary, usage, nudge and tour timestamp branches.
Each feature folder documents its own boundary and behavior coverage.

## Parent

[app](../README.md)

The dashboard navigation uses the existing local `Wordmark`, preserving its typography and link destination.
