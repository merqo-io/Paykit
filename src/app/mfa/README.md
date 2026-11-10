# mfa

## Purpose

Second-step sign-in for the paykit admins. `requireAdmin()` redirects any team
session below `aal2` here, so the operator console is never reachable with a
password alone.

## Contents

- `page.tsx` — server page; `requireTeamMember()` only (it lives outside
  `/admin` so the `aal2` gate cannot loop back), forwards an `aal2` session to
  `/admin`, otherwise passes the verified TOTP factor (or stale unverified ones)
  to the form.
- `mfa-form.tsx` — thin adapter over the shared `MfaForm` from `@merqo/ui`: it
  supplies the Supabase TOTP enrol (dropping stale factors first) and
  `challengeAndVerify` calls, then enters `/admin`. Every failure, including a
  thrown network error, maps to the fixed setup or wrong-code copy. Shared-form
  behaviour: the input has `pattern="[0-9]*"` and strips non-digits as typed,
  is disabled while pending, clears the error on edit, and controls are
  `rounded-xl`.
- The card is a flat surface with a 2px bottom border (no blurred shadow); the code input and button are 44px tall with 16px text.
- `mfa-form.dom.test.tsx` — verify, wrong code, short code, enrol-then-verify, enrol failure, input attributes.

## Connectivity

Needs TOTP enrolment and verification enabled in Supabase Auth.

Buttons, inputs, dialogs, badges and the other shared primitives here are imported from `@merqo/ui/primitives`, not from a local `components/ui` copy.

`loading.tsx` is the loading fallback for the sign-in card; like the page it keeps a `<main>` landmark and an inner `role="status"` element with an sr-only "Loading" label.
