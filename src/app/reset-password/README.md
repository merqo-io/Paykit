# reset-password

## Purpose

`/reset-password`: where a vendor who followed a password-reset email chooses
a new password. It works on the recovery session that `/auth/callback`
establishes, so it renders for both signed-in and signed-out visitors (only
`/dashboard` is protected in `src/lib/supabase/middleware.ts`).

## Contents

- `page.tsx`: the shared `AuthShell` with the paykit wordmark and the
  "Choose a new password for your account." subtitle.
- `layout.tsx`: tab title "Reset password", and per-request rendering so the
  nonce CSP from `proxy.ts` reaches the page's scripts (`/reset-password` is
  in `src/lib/nonce-prefixes.ts`).
- `reset-password-form.tsx`: client form with four states. `getUser()`
  decides between checking, ready, no-session ("This link has expired", with
  a link back to `/login`) and failed (a lookup error or rejection, with a
  "Try again" retry). Submit validates with `passwordChangeSchema`, then
  calls `supabase.auth.updateUser({ password })`; success toasts "Password
  updated" and goes to `/dashboard`. Update errors go through
  `friendlyAuthError(error, "update")` and show inline with `role="alert"`,
  so a `weak_password` rejection names the failed rule and the raw Supabase
  message is never shown. A "Password requirements" tap-to-open `InfoTooltip`
  (`PASSWORD_REQUIREMENTS_HINT`) sits beside the New password label.
- `reset-password-form.dom.test.tsx`: the states, Zod blocking, success,
  weak-password and generic errors, a thrown call, and the hint.

"Forgot password?" on `/login` sends links through
`/auth/callback?next=/reset-password`. Links sent through `/auth/confirm`
still land on `/dashboard/profile` until `recovery.path` in
`src/app/auth/confirm/verify/route.ts` is pointed here; that file is not part
of this change.

## Parent

[paykit](../../../README.md)
