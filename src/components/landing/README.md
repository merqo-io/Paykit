# landing

## Purpose

The marketing homepage (`src/app/page.tsx`), broken into one section per
file. No data fetching. Client state is limited to the interactive demos: the
hero phone's "I've paid" tap and the sample
ledger search, plus the `authed` prop threaded down from the page for the nav
sign-in/dashboard link.

## Contents

- `account-nav.tsx` — Client Component that wires `@merqo/ui`'s `LandingAccountNav` (a Client Component so the server actions can be passed in; links come from the root `AppLinks` provider). `nav.tsx` renders it for signed-in users.
- `nav.tsx` — sticky top nav built on `@merqo/ui`'s `LandingNav` shell
  (v0.59.1). The `wordmark` slot holds the `Wordmark` link; About and FAQ
  (`/about`, `/faq`) are passed as plain-data `links`, which the shell shows
  inline from `sm` up and collapses into a burger menu below it, so the
  header stays one line on phones. The `end` slot holds only the account
  controls: `@merqo/ui`'s `LandingAccountNav` (Dashboard link plus account
  menu with Sign out, Get help, Feedback) when signed in, or Sign in and
  Join the waitlist when signed out. `Nav` takes a `user` (`NavUser | null`)
  built by `landingNavUser` in `@/lib/landing-nav-user`; the help and
  feedback server actions come from `@/app/actions/landing-account`.
  Errors use the shared sonner toast, and the root layout mounts the
  `Toaster`.
- `nav.dom.test.tsx` — asserts the About link, the Sign in/Join the
  waitlist/Dashboard state switch, and that the account menu opens by touch
  and offers Sign out.
- `hero.tsx` - headline, lede, waitlist CTA, one quiet "In pilot with Merqo
  stalls" line (the only readiness statement on the page) and the payment
  object. No badge and no stat row.
- `waitlist.ts` - `WAITLIST_URL` (every signup CTA) and `PILOT_PRICING_LINE`
  (the only pricing statement on public pages).
- `qkit-phone.tsx` - `QkitPhone` (`#how`), the hero's product object: a
  `PhoneFrame` showing a customer's qkit order (stall, two items, total from
  `Money`), the PayNow QR paykit makes for it and qkit's "I've paid" tap, which
  leads to "Payment sent. The stall is checking it." with an Undo. Wording is
  qkit's own. Only the tap moves it, so reduced motion needs no case. The QR
  encodes `https://paykit.merqo.io/faq`, never a PayNow payload.
- `after-payment.tsx` - `AfterPayment` (`#after`), the part of paykit that is
  not the QR: a searchable sample ledger (same columns and status labels as
  `dashboard/transactions`), a report block (Total revenue, Payments, Avg /
  day tiles and a bar chart by day, all derived from one set of sample days
  in plain HTML; Kit and Created columns hide on phones). Each block has its
  point beside it (ledger and refund tracking that only records; reports with
  CSV), with no numerals. Labelled as sample data; imports nothing from the
  dashboard.
- `status.tsx` - `STATUS` (labels and tones copied from the dashboard's
  `TransactionStatusBadge`) and `StatusPill`, so one colour means one state
  in the ledger.
- `sections.tsx` - `LandingFaq` (three `FaqRows` picked by question from
  `FAQ_GROUPS`, plus a link to `/faq`) and `LandingClosing` (FAQ-column layout,
  with `PILOT_PRICING_LINE`, the waitlist CTA and the funds statement).
- `rhythm.ts` - `CONTAINER` and `SECTION_PAD_Y`, the one width and spacing
  scale for every block.
- `sections.dom.test.tsx` - three FAQ rows that open and the closing call.
- `qkit-phone.dom.test.tsx` - order total and QR, no state toggle, the "I've paid" tap and Undo.
- `after-payment.dom.test.tsx` - sample labelling, ledger search, derived
  tiles, and status labels kept in step with the dashboard's badge.
- `BackToTop` — shared scroll-to-top control imported from `@merqo/ui`.
- `wordmark.dom.test.tsx` — text, mint accent and caller size override.
- `wordmark.tsx` — `Wordmark`: thin wrapper over the shared `Wordmark` shell
  from `@merqo/ui` (weight, tracking, size); supplies the "Pay**kit**" letters, mint accent on "Pay"
  (distinct from qkit's ember / loopkit's gold) — visual mark only, prose
  stays lowercase "paykit" per
  `Merqo Business/docs/business/2026-07-15-kit-brand-naming-convention.md`.

## Surfaces

The checkout card and FAQ rows use `rounded-lg`, the single small radius for
page surfaces; the phones keep their own device corners. The landing has no glow, shadow or section reveals, and the
body carries no background wash, per the shared public page rules.

## Connectivity

Assembled by `src/app/page.tsx` in the order listed above (nav → hero →
after payment → faq → closing call → footer → back-to-top). The
footer is `src/components/site-footer.tsx`, outside this folder, because the
dashboard and `/about` use it too. `wordmark.tsx` is also used by
`dashboard-nav.tsx`, `site-footer.tsx` and the not-found and error pages.

## Shared package note

`back-to-top.tsx` moved to `@merqo/ui` (v0.31.0) as `BackToTop` — it was byte-identical across four kits.

## Parent

[components](../README.md)

Buttons, inputs, dialogs, badges and the other shared primitives here are imported from `@merqo/ui/primitives`, not from a local `components/ui` copy.
