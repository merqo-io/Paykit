# terms

## Purpose

The public Terms of Service page.

## Contents

- `page.tsx` — `TermsPage`, a one-line Server Component rendering
  `@merqo/ui`'s `<LegalDocument doc="terms" kit="paykit" />`. The `kit`
  prop scopes the rendered Annex to paykit's own schedule only, not every
  sibling kit's. Content lives in `@merqo/ui`, not here — see the parent
  README.

## Tab title

`page.tsx` exports `metadata.title = "Terms of Service"`, which the root layout's `%s | Paykit` template turns into "Terms of Service | Paykit". `src/app/page-titles.test.ts` checks it.

## Parent

[legal](../README.md)
