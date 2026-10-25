# supabase

## Purpose

Local Supabase stack configuration and the paykit schema.

## Contents

- `config.toml`: local stack settings. TOTP enrol and verify are on so an admin flow can clear MFA locally.
- `migrations/`: the numbered SQL chain for the `paykit` schema (see its README).
- `tests/`: pgTAP suites run by `supabase test db`.

## Parent

[Paykit](../README.md)
