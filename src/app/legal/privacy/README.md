# privacy

## Purpose

The public Privacy Policy page.

## Contents

- `page.tsx` — `PrivacyPage`, a one-line Server Component rendering
  `@merqo/ui`'s `<LegalDocument doc="privacy" />`. Content lives in
  `@merqo/ui`, not here — see the parent README.

## Tab title

`page.tsx` exports `metadata.title = "Privacy Policy"`, which the root layout's `%s | Paykit` template turns into "Privacy Policy | Paykit". `src/app/page-titles.test.ts` checks it.

## Parent

[legal](../README.md)
