# seed

## Purpose

SQL run by hand against the hosted staging Supabase project. Nothing here runs
in CI or on `supabase start`.

## Contents

- `staging-kit-keys.sql` registers qkit as a paykit caller on staging: the
  SHA-256 hash of qkit's staging `PAYKIT_KIT_SECRET`, its callback URL on
  `qkit-staging.merqo.io`, its staging `PAYKIT_CALLBACK_SECRET` and its
  `return_origin` (`https://qkit-staging.merqo.io`, without which the hosted
  pay page refuses qkit's return URL and qkit skips it), upserted
  into `paykit.kit_api_keys`. It refuses to run while a placeholder is left or
  when the database's registry points at production hosts, and is safe to
  re-run. See merqo's `docs/STAGING.md`.

## Parent

[paykit](../../README.md)
