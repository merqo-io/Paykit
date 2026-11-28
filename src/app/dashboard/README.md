# dashboard

The authenticated vendor area for payment setup, transactions, bookings,
reports, plan display and account settings.

## Shell

`layout.tsx` obtains the vendor session, shared profile and plan, then composes
`dashboard-nav.tsx`. The navigation adapter owns
Paykit's routes, brand and tier display (labels from `tierLabel`), and adapts feedback/support results to
the shared account menu's rejecting-promise contract. Below 1024px the vendor
navigates with a fixed bottom tab bar (Home, Payments with a badge counting
payments waiting to confirm, Bookings, Reports, More); `layout.tsx` reads that
count and mounts the bar, so it and the header do not re-render on navigation.
`DashboardNav` passes `mobileNav="none"` to the shared header (no burger) and no
inline links: the tab bar below `lg` and the left rail (`DashboardRail`) from
`lg` carry the destinations. More holds Payment setup, Profile, Plan, a Setup
guide row (reopens the Home checklist, then goes Home) and the legal links (the
footer is hidden below `lg`); Help,
Feedback, Switch products and Sign out stay in the account menu. All of it comes
from `src/lib/nav.ts`. `main` has bottom padding that clears the tab bar and the
safe-area inset.

The navigation wrapper uses `contents print:hidden` so it does not constrain the
shared sticky header. One layout-level `main` owns the outer content width;
pages may use narrower inner containers. Links come from the root `AppLinks`
provider (client-side navigation). Function props cannot be passed
from a Server Component directly to a shared Client Component.

The shell is a `flex min-h-screen flex-col` column: `main` is `flex-1`, so
the family footer (`SiteFooter` without the sign-in link) sits at the bottom
of a short page instead of mid-screen. The footer is wrapped in
`contents print:hidden`, like the navigation, so a printed booking or report
leaves it out.

`loading.tsx` (shared `StatTileSkeleton` and `ListSkeleton`) covers page loading inside this shell with a title, two stat tiles and five list rows at the list-page width. Start of today and of the month on Home come from the shared `startOfSgDay`. `error.tsx` (shared `ErrorPage` from `@merqo/ui`, titled "This page didn't load") offers retry
for page render/data failures; it offers "Try again" and a "Back to dashboard" link; it cannot catch its own segment's layout errors.

## Routes

- `page.tsx` is a status hub: payment method (or "Not set"), the SGD amount
  and count of payments waiting to be confirmed (as `StatCard` captions; the link goes to `/dashboard/transactions?status=claimed` when something is waiting) and this
  month's confirmed amount and payment count; a vendor with no setup sees only the setup prompt. Usage does not impose a volume
  cap. It also shows a Confirmed today card (Singapore day) and the five most recent payments (each opens the ledger, filtered to its reference on paid plans) with a "View all payments" link.
- `config/` saves PayNow or a payment link/QR image. Deferred uploads commit on
  Save.
- `transactions/` lists vendor transactions and Pro-gated refund bookkeeping.
- `bookings/` manages deposit/balance checkouts, recoverable deposit setup,
  cancellation, rescheduling and printing. Due reminders are dashboard badges.
- `reports/` is the Reports page: an Overview tab (revenue chart from `stats/`)
  and an Earnings tab (yearly event-date revenue record and escaped CSV), both
  free. The old `stats/` and `reports/earnings/` URLs redirect to the matching tab.
- `plan/` shows the current plan and points to the Merqo account; merqo owns pricing.
- `profile/` saves shared stall name/social links and Supabase account metadata.
- `layout.tsx` labels the account menu with `accountLabel(user, stall_name)` from `@merqo/ui`: the stall name, else the auth name, else the email local part.

`page.tsx` (Home, titled "Home") renders the "Get set up" checklist above the summary, from
`lib/onboarding.ts`: step 1 is a payment config row, step 2 is
`vendor_prefs.qr_previewed_at`, step 3 is any `confirmed` transaction.
`onboarding-actions.ts` holds the writes: `dismissOnboarding`, `reopenOnboarding`
(for a later "Setup guide" entry) and `markQrPreviewed` (called by the payment
setup form when the live QR preview first renders). All are best-effort and
RLS-scoped; a failed write can lose a stamp, so none of this is authorization.
Home never writes `tour_seen_at`; it only marks vendors who saw the retired tour.

## Verification

Layout tests cover the sticky wrapper and single header. Navigation tests cover
route links, feedback/support adaptation, sign-out and product switching.
Overview tests cover payment summary, usage, nudge and checklist visibility branches.
Each feature folder documents its own boundary and behavior coverage.

## Parent

[app](../README.md)

The dashboard navigation uses the existing local `Wordmark`, preserving its typography and link destination.

Page chrome here (PageHeader) comes from `@merqo/ui`; paykit keeps no local copy.

Buttons, inputs, dialogs, badges and the other shared primitives here are imported from `@merqo/ui/primitives`, not from a local `components/ui` copy.

The merqo base URL and the `ActionResult` shape come from `@merqo/ui/kit-api`; `useAsyncAction` comes from `@merqo/ui`.

The hub tiles show amounts through `@merqo/ui` `formatMoney` ("S$4.50").

Signed-out and stale-terms vendors come back here after sign-in or terms acceptance: the page passes its own path and query to `getVendorSession` as `returnTo`.
