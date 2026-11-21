# terms

## Purpose

The public Terms of Service page.

## Contents

- `page.tsx` — `TermsPage`, a Server Component rendering (via `../legal-page-client.tsx`)
  `@merqo/ui`'s `<LegalPage doc="terms" kit="paykit" />` with paykit's
  `Wordmark` (linked home) and `next/link`. The `kit`
  prop scopes the rendered Annex to paykit's own schedule only, not every
  sibling kit's. Content lives in `@merqo/ui`, not here — see the parent
  README.

## Tab title

`page.tsx` exports `metadata = legalPageMetadata("terms")` (title "Terms of Service"), which the root layout's `%s | paykit` template turns into "Terms of Service | paykit". `src/app/page-titles.test.ts` checks it.

## Parent

[legal](../README.md)
