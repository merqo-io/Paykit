# callback

## Purpose

Supabase auth callback: exchanges the OAuth code for a session, then redirects.

## Contents

- `route.ts`: `GET`. Parses the `code` and `next` query values with `authCallbackQuerySchema` and `redirectPathSchema`. A missing, oversized or failing code goes to `/login?error=oauth`; `next` is followed only when it is a same-origin relative path, otherwise `/dashboard`.
- `route.test.ts`: missing and oversized codes, a successful exchange, safe and unsafe `next` values, an exchange error.

## Parent

[auth](../../README.md)
