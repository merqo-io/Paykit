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
- `mfa-form.tsx` — client form: enrol an authenticator (QR plus manual key) or
  verify a 6-digit code with `challengeAndVerify`, then enter `/admin`.
- The card is a flat surface with a 2px bottom border (no blurred shadow); the code input and button are 44px tall with 16px text.
- `mfa-form.dom.test.tsx` — verify, wrong code, enrol-then-verify, bad input.

## Connectivity

Needs TOTP enrolment and verification enabled in Supabase Auth.

Buttons, inputs, dialogs, badges and the other shared primitives here are imported from `@merqo/ui/primitives`, not from a local `components/ui` copy.
