# privacy

## Purpose

The public Privacy Policy page.

## Contents

- `page.tsx` — `PrivacyPage`, a Server Component rendering (via `../legal-page-client.tsx`)
  `@merqo/ui`'s `<LegalPage doc="privacy" />` with paykit's `Wordmark`. Content lives in
  `@merqo/ui`, not here — see the parent README.

## Tab title

`page.tsx` exports `metadata = legalPageMetadata("privacy")` (title "Privacy Policy"), which the root layout's `%s | paykit` template turns into "Privacy Policy | paykit". `src/app/page-titles.test.ts` checks it.

## Parent

[legal](../README.md)
