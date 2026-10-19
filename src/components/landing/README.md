# landing

## Purpose

The marketing homepage (`src/app/page.tsx`), broken into one section per
file. Presentational only — no data fetching, no client state beyond the
`authed` prop threaded down from the page for the nav/CTA sign-in links.

## Contents

- `nav.tsx` — sticky top nav: `Wordmark` + an `/about` link + an `#faq`
  anchor link (sm+, same-page hash jump to `faq.tsx`'s section) +
  sign-in/dashboard link. Composes `@merqo/ui`'s `LandingNav` shell
  (v0.9.0) for the sticky header/`max-w-6xl` row instead of hand-rolling
  it — this file now owns only the `wordmark` slot (the `Wordmark` link +
  sr-only text) and the `end` slot (About link, FAQ button,
  sign-in/dashboard links), both passed straight through as `ReactNode`
  props. Visual output is unchanged from the pre-migration markup, aside
  from the shared shell's own `end`-row gap (`gap-2 sm:gap-4`, replacing a
  fixed `gap-3`) — a byproduct of adopting the shared component's
  contract, same as qkit's landing nav will pick up once it migrates.
- `nav.test.tsx` — asserts the About link and the Sign in/Get
  started/Dashboard state switch.
- `hero.tsx` — headline, stat row, CTA, and the decorative `CheckoutCard`.
- `checkout-card.tsx` — stylized non-functional "live checkout" artifact for
  the hero (not a real scannable QR — a stand-in with a status pill using
  the product's own pending/claimed/confirmed language).
- `benefits.tsx` — the "why paykit" feature grid. Takes
  `{ monthlyPriceLabel }` (formatted from the live admin-tunable
  `pricing` row, `@/lib/pricing`) for the "Free while you're small" tile's
  Pro-price mention — no hardcoded price string.
- `how-it-works.tsx` — 3-step explainer (connect method → share checkout →
  confirm).
- `faq.tsx` — Q&A list, including "does paykit hold my money?"; takes
  `{ monthlyPriceLabel }` (the `FAQ` array lives in the component body, not
  module scope, so its "what does the free plan include?" answer can
  interpolate the live price) — same source as `benefits.tsx`'s prop, both
  fed by `src/app/page.tsx`'s single `getPricing` call. Heading uses the
  same eyebrow (`font-mono uppercase tracking-widest`) + `font-display`
  heading pair as `how-it-works.tsx`/`benefits.tsx`, not a bespoke centered
  heading.
- `closing-cta.tsx` — full-bleed `bg-ink text-ink-foreground` closing
  section between `Faq` and `Footer` (the family's shared "dark
  authoritative band" convention documented on the `--ink`/`--ink-foreground`
  tokens in `globals.css`, previously defined but unused anywhere in
  `src/app`/`src/components`) with a headline and a "Get started"/"Go to
  dashboard" CTA (`authed`-aware, same href logic as `hero.tsx`'s primary
  CTA). A standalone section, not a band inside the family footer
  (`src/components/site-footer.tsx`), which stays CTA-free.
- `BackToTop` — shared scroll-to-top control imported from `@merqo/ui`.
- `wordmark.tsx` — `Wordmark`: the "Pay**kit**" mark, mint accent on "Pay"
  (distinct from qkit's ember / loopkit's gold) — visual mark only, prose
  stays lowercase "paykit" per
  `Merqo Business/docs/business/2026-07-15-kit-brand-naming-convention.md`.

## Connectivity

Assembled by `src/app/page.tsx` in the order listed above (nav → hero →
benefits → how-it-works → faq → closing-cta → footer → back-to-top). The
footer is `src/components/site-footer.tsx`, outside this folder, because the
dashboard and `/about` use it too. `wordmark.tsx` is also used by
`dashboard-nav.tsx`, `site-footer.tsx` and the not-found and error pages.

## Shared package note

`back-to-top.tsx` moved to `@merqo/ui` (v0.31.0) as `BackToTop` — it was byte-identical across four kits.

## Parent

[components](../README.md)
