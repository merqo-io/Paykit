# e2e

## Purpose

Playwright end-to-end smoke tests. They need only `pnpm dev` and
`playwright install`, with dummy Supabase values and no live database.

## Contents

- `smoke.spec.ts` — public smoke: the landing page renders its "One payment
  setup" hero heading, and `/login` renders its "Continue with Google"
  button.
- `auth-guard.spec.ts` — signed-out route protection: `/dashboard` and
  `/dashboard/transactions` redirect to `/login`. `src/proxy.ts` resolves
  `user: null` locally when there is no session cookie, so the redirect fires
  without a database.
- `pay-page.spec.ts` — the hosted pay page's refusals: no token, an empty,
  short, padded or repeated token and an id that is not a uuid are all a 404
  showing no payment, a well-formed link with no database behind it shows
  only the retry notice, and the page sends `Referrer-Policy: no-referrer`
  and `X-Robots-Tag: noindex, nofollow`.

## Connectivity

Run by `pnpm test:e2e` (`playwright.config.ts`, which starts `pnpm dev`) and
by the `e2e (public smoke)` job in `.github/workflows/ci.yml`. Vitest does
not pick these files up: its `include` covers `test/` and `src/` only.

## Parent

[paykit](../README.md)
