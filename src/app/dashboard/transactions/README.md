# transactions

## Purpose

The vendor's payments ledger — every payment paykit has tracked for them,
across every kit — plus, for Pro vendors, a per-payment refund action.

## Contents

- `page.tsx` — `TransactionsPage()` (server): calls `getVendorSession()`/
  `readVendorPlan()` (`@/lib/vendor-entitlement`) and `queryTransactions()`, renders `TransactionFilters`, `TransactionTable` and the shared `UrlPager` (plain links, no client router).
  URL params (Zod, `search-params.ts`, invalid values dropped): `q` (reference or title, paid only; ignored for Free), `status` (`pending`|`claimed`|`confirmed`; `?status=claimed` is the dashboard's "to confirm" deep link), `from`/`to` (YYYY-MM-DD, Singapore days) and `page` (25 per page; a page past the end redirects to the last page). Free's window is floored at the 30-day cutoff whatever `from` says (`resolveListRange`).
  Free also sees search disabled with an upgrade note and an "N older payments hidden on Free" line. Empty filter results show "No payments match" with a clear-filters link. On Free the date pickers stop at the cutoff day and a range cut short shows "Free shows the last 30 days." A failed read shows a local `role="alert"` card with "Try again", distinct from the empty state.
  A Free vendor's list is limited to the last 30 days (`freeListCutoff`) and a
  count-only `countTransactionsBefore()` drives a one-line note that older
  transactions are kept; nothing is deleted.
  Titled "Payments" through the shared `PageHeader`; content sits in a
  plain div (not `<main>` — the parent `dashboard/layout.tsx` owns that
  landmark and the `max-w-7xl` outer width), same as the overview page.
- `transaction-table.tsx` — `TransactionTable({ transactions, isPro })`:
  renders `Kit`/`Reference`/`Amount`/`Status`/`Created` columns through `@merqo/ui` DataTable, plus a `Refund` column with `RefundDialog` when `isPro`. Amounts
  are formatted via `Intl.NumberFormat` (SGD). Empty state is the
  shared dashed `EmptyState` ("No payments yet"); the table sits in an
  `overflow-x-auto` wrapper so it scrolls instead of widening the page on a phone.
- `transaction-notices.tsx` — `HiddenNote` (older payments Free hides) and `FreeRangeNote` ("Free shows the
  last 30 days."). A failed read renders the shared `ListError` ("Couldn't load payments"); the filter select uses `FILTER_SELECT_CLASS`.
- `transaction-status-badge.tsx` — `TransactionStatusBadge({ status })`
  (labels: pending → "Awaiting payment", claimed → "Marked paid", confirmed
  → "Received"; stored values are unchanged): a
  pure presentational component (extracted from `transaction-table.tsx` so
  `src/components/tour-steps.ts` can render the real thing instead of a
  hand-copied color), now a thin wrapper around `@merqo/ui`'s shared
  `StatusBadge` (the dot + uppercase bordered-pill chip qkit's
  `OrderStatusBadge` originated) instead of shadcn's `Badge`. `claimed` keeps
  its own `text-mint border-mint/35 bg-mint/12` treatment instead of falling
  into a `pending`/`confirmed`-shared tone — it's the one status that
  actually needs the vendor's attention (customer says they've paid, waiting
  on vendor confirmation), so it shouldn't look inert. Paired with
  `@merqo/ui`'s `InfoTooltip` (`trigger="tap"`, not its "hover" default —
  a native hover hint has no touch equivalent on any mobile browser, and
  most vendors check this on a phone) carrying a per-status hint (what
  "Marked paid" vs "Received" actually means) so that distinction doesn't
  rely solely on a vendor remembering the one-time tour explanation.
- `transaction-status-badge.test.tsx` — asserts `claimed` gets the mint
  accent and `pending`/`confirmed` don't.
- `transaction-status-badge.dom.test.tsx` — jsdom test that the per-status
  hint text is absent until the info button is tapped, then appears (an
  `InfoTooltip` `trigger="tap"` Popover only renders its content once
  open, so this can't be asserted via `renderToStaticMarkup`).
- `refund-dialog.tsx` — Pro-only dialog (submit is `AsyncSubmitButton` from
  `@merqo/ui`): calls `issueRefundAction` to file a
  refund against a `confirmed` transaction (bookkeeping only — no real
  money movement, see `AGENTS.md`'s data model). The amount field is
  dollar-denominated (`refunded_amount`, `type="number" step="0.01"`),
  matching every other money value in the dashboard (`transaction-table.tsx`'s
  `formatCents`) instead of asking the vendor to enter raw cents; `actions.ts`
  converts it to cents before validation. The `useActionState`
  action passed in is a local wrapper around `issueRefundAction` (not the
  server action directly): on `status: "ok"` it toasts, resets the form
  (`formRef`), and closes the dialog (`setOpen(false)`) inline, as part of
  the submit itself — not a `useEffect` keyed on the result, which
  `eslint-plugin-react-hooks`'s `set-state-in-effect` rule flags. Without
  this, a successful refund left the dialog open with the same
  amount/reason still filled in and the submit button re-enabled, inviting
  an accidental duplicate refund.
- `refund-dialog.dom.test.tsx` — jsdom tests for the refund flow: opening
  and wiring the transaction id, that a successful submit toasts, clears,
  and closes the dialog (reopening shows a blank form), and that a failed
  submit keeps the dialog open with the inline error.
- `actions.ts` — `issueRefundAction`: converts the form's dollar amount
  (`refunded_amount`) to cents (`dollarsToCents`), validates it with
  `issueRefundInputSchema` (still cents-denominated — that's the DB column's
  unit), then inserts into `refunds` and calls
  `revalidatePath("/dashboard/transactions")` so the transactions table
  reflects the refund without a manual reload. Ownership, `confirmed`-only,
  and Pro-only enforcement is the `refunds_insert_own` RLS policy, not this
  action — it only validates shape/UX. Also appends an `admin_audit` row
  (`recordAudit()`, imported from `lib/admin-audit.ts`) so a vendor's own
  refund is reconstructable later, not just admin-console actions.
- `actions.test.ts` — unit coverage for `issueRefundAction`.
- `page.dom.test.tsx` — awaits `TransactionsPage()` directly and renders
  the result (same pattern as `dashboard/layout.dom.test.tsx`), with
  `TransactionTable` rendered for real: the empty state, and that the
  Refund column only shows for a Pro vendor (including no-config-yet
  defaulting to Free).

## Connectivity

Reachable from `dashboard-nav.tsx`'s "Payments" link. `page.tsx` reads
transactions via `@/lib/vendor-session` and `@/lib/transactions`, and
renders `transaction-table.tsx`, which renders `refund-dialog.tsx` for Pro
vendors — that dialog calls `issueRefundAction` in `actions.ts`.

## Shared package note

`transaction-table.tsx` now renders through `@merqo/ui`'s shared `DataTable` instead of a local shadcn `Table`, and is a `"use client"` module for the same reason as `bookings/booking-table.tsx`. The Pro-only Refund column is appended to the column list rather than conditionally rendered per cell, so a Free vendor's table has no empty trailing column.

## Tab title

`page.tsx` exports `metadata.title = "Transactions"`, which the root layout's `%s | paykit` template turns into "Transactions | paykit". `src/app/page-titles.test.ts` checks it.

## Parent

[dashboard](../README.md)

Page chrome here (PageHeader and EmptyState) comes from `@merqo/ui`; paykit keeps no local copy.

Buttons, inputs, dialogs, badges and the other shared primitives here are imported from `@merqo/ui/primitives`, not from a local `components/ui` copy.

Timestamps display through `formatSgtDate`/`formatSgtDateTime` from `@/lib/utils`, pinned to Asia/Singapore so server and client render identically (no hydration mismatch).

Signed-out and stale-terms vendors come back here after sign-in or terms acceptance: the page passes its own path and query to `getVendorSession` as `returnTo`.
