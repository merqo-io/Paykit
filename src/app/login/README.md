# login

## Purpose

The single sign-in/sign-up page (`/login`) — email+password and Google
OAuth, plus password reset. No separate `/signup` or `/reset-password`
route; mode is a client-side toggle on this one page.

## Contents

- `page.tsx` — `LoginPage()` wraps `LoginScreen` in `<Suspense>` (it reads
  `useSearchParams()` for `?error=oauth` and `?mode=signup`). The screen is
  the shared `AuthShell` and `LoginForm` from `@merqo/ui`; this file supplies
  the Supabase callbacks:
  - Google OAuth via `supabase.auth.signInWithOAuth`, redirecting through
    `/auth/callback`; `queryParams: { hl: "en" }` forces an English consent
    screen regardless of the visitor's browser/account locale. The button
    stays disabled after success (`navigatingAway()`) while the browser leaves.
  - Email+password sign-in/sign-up via `supabase.auth.signInWithPassword`/
    `signUp`. A sign-up that returns no session (email confirmation on)
    swaps the form for a local "Check your email" card instead of silently
    redirecting to a dashboard the unconfirmed user can't reach yet; "Back to
    sign in" returns to the form in sign-in mode. The shared form's inline
    `{ notice }` cannot express that card, so it stays local.
  - "Forgot password?" (sign-in mode only) calls
    `supabase.auth.resetPasswordForEmail`. The shared form asks for the
    email first, a failed call shows a plain sentence, and success toasts.
    Every callback maps Supabase errors through `auth-errors.ts`
    (`friendlyAuthError`) and returns the final copy; a thrown failure shows
    "Could not connect. Try again.". `mapError` is the identity because the
    form only passes it a string, which would lose the HTTP status the
    rate-limit rule matches. The reset link lands on `/auth/callback`, which
    establishes a recovery session and forwards to `/dashboard/profile`.
  - `Wordmark` (`@/components/landing/wordmark`) and the tagline fill
    `AuthShell`'s wordmark slot; the heading and subtitle follow the mode via
    `onModeChange`.
  - Gaps against the shared components are in
    [`docs/merqo-ui-login-gaps.md`](../../../docs/merqo-ui-login-gaps.md).
- `page.test.tsx` — RTL/jsdom tests: the `?error=oauth` banner, the
  check-your-email state on a sessionless sign-up (and returning from it via
  "Back to sign in"), the redirect-on-session-present path, password sign-in
  and Google sign-in by touch, the mode toggle, and the Forgot password flow
  (visible only in sign-in mode, sends a reset email and toasts, asks for an
  email when empty, shows plain copy on a failed reset call).
- `login-page.dom.test.tsx` — RTL/jsdom test asserting the page renders a
  single top-level heading alongside the Google and email/password form.

## Connectivity

Signed-out visitors land here from `landing/nav.tsx`'s "Log in"/"Get
started" links. On success it calls `router.push("/dashboard")` +
`router.refresh()`; `/dashboard`'s `layout.tsx` (`getVendorSession()`) is
the actual auth gate this page's happy path leads into.

Google branding uses `GoogleMark` from `@merqo/ui`; no local copy remains.

## Tab title

`layout.tsx` exports `metadata.title = "Sign in"`, which the root layout's `%s | paykit` template turns into "Sign in | paykit". `layout.tsx` exists only to set it, because `page.tsx` is a client component and cannot export `metadata`. `src/app/page-titles.test.ts` checks it.

## Parent

[paykit](../../../README.md)

`layout.tsx` also forces per-request rendering so the nonce CSP from `proxy.ts` reaches this page's scripts.

Buttons, inputs, dialogs, badges and the other shared primitives here are imported from `@merqo/ui/primitives`, not from a local `components/ui` copy.
