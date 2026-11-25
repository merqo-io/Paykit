# app

## Purpose

Next.js App Router tree — every page, layout, route handler, and API surface
for this project.

## Contents

- `actions/`, server actions shared across routes: auth, feedback, support messages.
- `about/` — `AboutPage`, the public "Why Merqo" page: `@merqo/ui`'s
  shared `AboutMerqo` (the qkit origin story), wrapped in this app's own
  `Nav` and `SiteFooter` with a link back to `/#how`. Linked from both.
- `faq/` � `FaqRoute`, the public `/faq` page: `@merqo/ui`'s shared
  `FaqPage` in this app's own `Nav` and `SiteFooter`, with nine rows in three
  groups and FAQPage JSON-LD. Linked from `Nav`.
- `admin/`, Merqo-team internal admin console (`/admin`), gated by `requireAdmin()`, platform overview stats and a cross-vendor table with each vendor's plan (read-only).
- `api/` — the cross-kit `v1` payment API (`checkout`, `vendors`) plus internal `merqo/*` provisioning routes.
- `apple-icon.tsx` — `AppleIcon` route handler; renders `brandIcon(180)` as a 180×180 PNG for iOS home-screen touch icons.
- `auth/` — Supabase auth routes: `callback/` (OAuth code exchange) and `confirm/` (own-domain email links, verified on a button POST).
- `dashboard/` — authenticated vendor area (payment config, transactions, reports, profile, plan).
- `legal/` — public `/legal/terms` + `/legal/privacy` pages (rendered from `@merqo/ui`'s shared content) and the `/legal/accept` interstitial a signed-in vendor is bounced to when their accepted terms/privacy versions fall behind `@merqo/ui`'s `LEGAL_VERSIONS` — see `src/lib/legal-gate.ts` and its hook in `getVendorSession` (`@/lib/vendor-session`).
- `error.tsx` — root-level error boundary (`"use client"`) rendering `@merqo/ui`'s `ErrorPage` for every route not covered by a more specific one (landing, login, auth, admin; `dashboard/` has its own `error.tsx` because it renders inside the dashboard shell). Keeps the paykit wordmark, a "Try again" (`reset()`) and a "Back to home" (`next/link`) action, logs the caught error to the console, and shows Next's digest as a "Reference: <digest>" line when it supplies one.
- `globals.css` — Tailwind v4 entry point: theme tokens, base layer, and custom utility classes; `@source` includes `node_modules/@merqo/ui/dist` so its components' Tailwind classes get compiled here too. It defines no load-time animation: public pages do not animate sections in on load. Color tokens are named "Banknote Engrave" in the file's own header comment (engraved teal-green primary, warm-grey secondary — was steel-blue until 2026-08-25, changed since it read too close to the primary's own hue) — the founder-approved cross-kit brand pick as of 2026-08-19. Also defines `.tour-example`/`.tour-example-row`/`.tour-example-label`, the shared styling for the small HTML preview embedded in the dashboard tour's first step — its status pill is the real `TransactionStatusBadge`, rendered via `renderToStaticMarkup`, not its own CSS class (see `src/components/README.md`'s `tour-steps.ts` entry). `--card`/`--popover` were fixed to differ from `--background` in both modes after the Banknote Engrave rebrand had accidentally collapsed them to the same value; two follow-ups widened the gap further (light mode, then dark mode again) after each pass still read as too subtle at a glance. `--success` (exposed as the Tailwind `success` colour) is the up state of `@merqo/ui`'s `DeltaPill` as of 0.54.0: the mint hue, darkened in light mode so its text keeps contrast on the tint.
- `icon.tsx` — `Icon` route handler; renders `brandIcon(32)` as a 32×32 PNG favicon.
- `layout.tsx` — `RootLayout`. Loads `Fraunces`/`Inter`/`JetBrains_Mono` via `next/font/google`, sets `metadata` (the landing tab title `paykit | Vendor payments` and the `%s | paykit` template every other page's own `metadata.title` fills), wraps children in `next-themes`' `ThemeProvider` (`attribute="class"`, system default) so `@merqo/ui`'s always-on account-menu Light/Dark/System control actually toggles the `.dark` class, then `TooltipProvider` (wrapping children in `AppLinks`) + `Toaster`.
- `not-found.tsx` — branded 404 for any unknown route or `notFound()` call outside a more specific boundary, rendering `@merqo/ui`'s `NotFound` with the paykit wordmark, "Page not found" and a "Back to home" link; tab title "Page not found | paykit". `not-found.dom.test.tsx` covers it.
- `global-error.tsx` — renders `@merqo/ui`'s `GlobalError` when the root layout itself throws. It carries literal copies of the light tokens from `globals.css` because the stylesheet has not loaded; `global-error.dom.test.tsx` covers the retry.
- `page-titles.test.ts` — imports each page's (or `login/layout.tsx`'s) `metadata` and checks its tab title, so a new page without one is noticed (the payments ledger at `/dashboard/transactions` is titled "Payments").
- `login/` — combined sign-in/sign-up page, including the "Forgot password?" flow.
- `reset-password/` — page where a vendor who followed a reset email chooses a new password.
- `inquire/`: a vendor's public booking inquiry form, `/inquire/{public_id}`: no session, service role only. See its README.
- `pay/` — the hosted pay page, `/pay/{id}?k=<token>`: one of paykit's two public, unauthenticated pages (with `inquire/`). See its README.
- `page.tsx` — `Home` async server component, the marketing landing page. Composes `Nav`, `Hero` and the `HowItWorks`, `YourMoney`, `LandingFaq` sections from `@/components/landing/`, `SiteFooter showSignIn` from `@/components/site-footer`, and shared `BackToTop`. `LandingFaq` also carries the closing call to action. Only reads the session, for the nav sign-in link or Dashboard link plus account menu (`landingNavUser`); the landing publishes no price. `src/app/page.dom.test.tsx` renders the real sections as a copy guard (no `$`, em dash or banned words, the pilot pricing line, the single "In pilot with Merqo stalls" line, waitlist CTAs, the hero h1 "Get paid by PayNow. Know who has paid." and the footer).

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

`mfa/` is the TOTP enrol/verify page that `requireAdmin()` redirects password-only admins to. `robots.ts` disallows crawling except on production. The login layout forces per-request rendering so the nonce reaches its scripts.

Buttons, inputs, dialogs, badges and the other shared primitives here are imported from `@merqo/ui/primitives`, not from a local `components/ui` copy.

The root layout takes its theme props from `@merqo/ui/next`, and the icon routes build their mark with `brandIcon` from `@merqo/ui` and the options in `lib/brand-mark.ts`.

Money and times here come from `@merqo/ui` (`Money`, `formatMoney`, `Timestamp`, `formatDate`, `formatDateTime`): "S$4.50", "7 Nov 2026", Singapore time.
