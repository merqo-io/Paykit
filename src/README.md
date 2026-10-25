# src

## Purpose

Root-level files that don't belong to any single feature area — Next.js
runtime hooks and cross-cutting middleware. Everything else lives in
`app/`/`lib`/`components` — see `AGENTS.md`'s file layout table.

## Contents

- `proxy.ts` — Supabase session refresh + `/dashboard` route guard (Next 16
  renamed `middleware.ts` to `proxy.ts`).
- `instrumentation.ts` — Next.js's `register()`/`onRequestError` hooks,
  wiring `@sentry/nextjs` for server-side error tracking. Activates only
  when `SENTRY_DSN` is set (see `.env.example`) — the SDK no-ops with no
  dsn, so this is safe to leave unset in dev/preview.

## Parent

See the repo root [README.md](../README.md) for the full layout.

`proxy.ts` sets the nonce CSP and, off production, `X-Robots-Tag: noindex`; see `lib/security-headers.ts`.
