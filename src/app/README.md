# app

## Purpose

Next.js App Router tree — every page, layout, route handler, and API surface
for this project.

## Contents

- `actions/` — server actions shared across routes: auth, feedback, Pro-upgrade requests, support messages.
- `about/` — `AboutPage`, the public "Why Merqo" page: `@merqo/ui`'s
  shared `AboutMerqo` (the qkit origin story), wrapped in this app's own
  `Nav`/`Footer` with a link back to `/#how`. Linked from both.
- `admin/` — Merqo-team internal admin console (`/admin`), gated by `requireAdmin()` — platform overview stats and a cross-vendor plan-management table.
- `api/` — the cross-kit `v1` payment API (`checkout`, `vendors`) plus internal `merqo/*` provisioning routes.
- `apple-icon.tsx` — `AppleIcon` route handler; renders `brandIcon(180)` as a 180×180 PNG for iOS home-screen touch icons.
- `auth/` — Supabase auth callback route (OAuth code exchange).
- `dashboard/` — authenticated vendor area (payment config, transactions, stats, profile, plan).
- `legal/` — public `/legal/terms` + `/legal/privacy` pages (rendered from `@merqo/ui`'s shared content) and the `/legal/accept` interstitial a signed-in vendor is bounced to when their accepted terms/privacy versions fall behind `@merqo/ui`'s `LEGAL_VERSIONS` — see `src/lib/legal-gate.ts` and its hook in `getVendorSession` (`@/lib/vendor-session`).
- `error.tsx` — root-level error boundary (`"use client"`) for every route not covered by a more specific one (landing, login, auth, admin — `dashboard/` has its own `error.tsx`). Branded like `login/page.tsx` (`@merqo/ui`'s `ElevatedCard` + `Wordmark`), with a "Try again" (`reset()`) and a "Back to home" (`next/link`) action. Logs the caught error to the console.
- `globals.css` — Tailwind v4 entry point: theme tokens, base layer, and custom utility classes; `@source` includes `node_modules/@merqo/ui/dist` so its components' Tailwind classes get compiled here too. Color tokens are named "Banknote Engrave" in the file's own header comment (engraved teal-green primary, warm-grey secondary — was steel-blue until 2026-08-25, changed since it read too close to the primary's own hue) — the founder-approved cross-kit brand pick as of 2026-08-19. Also defines `.tour-example`/`.tour-example-row`/`.tour-example-label`, the shared styling for the small HTML preview embedded in the dashboard tour's first step — its status pill is the real `TransactionStatusBadge`, rendered via `renderToStaticMarkup`, not its own CSS class (see `src/components/README.md`'s `tour-steps.ts` entry). `--card`/`--popover` were fixed to differ from `--background` in both modes after the Banknote Engrave rebrand had accidentally collapsed them to the same value; two follow-ups widened the gap further (light mode, then dark mode again) after each pass still read as too subtle at a glance.
- `icon.tsx` — `Icon` route handler; renders `brandIcon(32)` as a 32×32 PNG favicon.
- `layout.tsx` — `RootLayout`. Loads `Fraunces`/`Inter`/`JetBrains_Mono` via `next/font/google`, sets `metadata`, wraps children in `next-themes`' `ThemeProvider` (`attribute="class"`, system default) so `@merqo/ui`'s always-on account-menu Light/Dark/System control actually toggles the `.dark` class, then `TooltipProvider` + `Toaster`.
- `login/` — combined sign-in/sign-up page, including the "Forgot password?" flow.
- `pay/` — the hosted pay page, `/pay/{id}?k=<token>`: paykit's one public, unauthenticated page. See its README.
- `page.tsx` — `Home` async server component, the marketing landing page. Composes `Nav`, `Hero`, `HowItWorks`, `Benefits`, `Faq`, `ClosingCta`, `Footer`, and shared `BackToTop` from `@/components/landing/`. `ClosingCta` is the family's documented ink-band closing section, rendered between `Faq` and `Footer`. Reads the live Pro price via `getPricing()` (`@/lib/pricing`) and passes it down to `Benefits`/`Faq` as `monthlyPriceLabel` — no hardcoded price string.

## Connectivity

`login/` is the vendor auth entry point; `dashboard/` is the authenticated
vendor area. `admin/` is a separate, Merqo-team-only authenticated area
(session-gated the same way as `dashboard/`, but additionally requiring an
`admins` table row). `api/` is the cross-kit payment surface (bearer-secret
authenticated) plus Merqo's admin-facing provisioning routes. `actions/`
holds server actions shared across routes rather than colocated with one
page. `layout.tsx` is the ancestor of every route below; `page.tsx` (the
landing page) is the only route directly under `app/` besides the special
Next.js files.

## Shared package note

`page.tsx` now imports `BackToTop` from `@merqo/ui` (v0.31.0) rather than a paykit-local copy.

## Parent

[src](../README.md)

## Boundary and coverage

Global Tailwind base rules stay in the base layer so component utility classes control typography and surfaces. API boundaries retain authenticated kit ownership; vendor pages resolve their own session. Component and action tests validate failures as well as the happy path.
