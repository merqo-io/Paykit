# verify

## Purpose

POST target of the `/auth/confirm` form: verifies the emailed token on this origin and redirects.

## Contents

- `route.ts`: `POST` only, via `handleAuthConfirm` from `@merqo/ui/auth`. Lands on `/dashboard` (or a safe `next`); a recovery link goes to `/dashboard/profile`. Every failure, including a cross-origin POST, redirects to `/login?error=link`.
- `route.test.ts`: success, safe `next`, recovery, failed verification, cross-origin rejection, no `GET` export.

## Parent

[confirm](../README.md)
