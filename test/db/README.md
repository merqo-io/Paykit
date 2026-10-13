# test/db

## Purpose

Cheap regex-presence guards against silent drift in the hand-written SQL
migrations — a fast sanity check, not a substitute for `supabase/tests/rls.test.sql`
(pgTAP against real Postgres, run in CI's `db` job).

## Contents

- `schema.test.ts` — asserts `0001_paykit_core.sql` creates the `paykit` schema and its core tables/RLS.
- `admin-schema.test.ts` — asserts `0006_paykit_admin.sql` creates `admins`/`is_admin`/`admin_audit` with RLS and the expected grants.
- `payment-audit-schema.test.ts` — asserts `0011_paykit_payment_audit.sql` creates `payment_audit` with RLS and the immutable-from-creation grant.
- `rate-limit-schema.test.ts` — asserts `0012_paykit_rate_limit.sql` creates `rate_limits`/`check_rate_limit()` with RLS, the cleanup index, and the explicit service-role `EXECUTE` grant. Effective denial of inherited PUBLIC execution is tested by `supabase/tests/private-rate-limiter.test.sql` after migration `0019`.
- `auth-failures-schema.test.ts` — asserts `0014_paykit_auth_failures.sql` creates `auth_failures` with `kit_slug`/`ip` nullable, `reason` required, RLS enabled, and only `select`/`insert` (never `update`/`delete`) granted to `service_role`.
- `payment-evidence-schema.test.ts` — asserts `0022_payment_evidence.sql` creates the bucket the app writes to (name and size limit read from `src/lib/proof-file.ts`, so the two cannot drift), the folder-scoped object policy, `payment_evidence` with RLS, the unique `(transaction_id, kind)` the upsert relies on, and the grants.
- `transactions-expires-at-schema.test.ts` — asserts `0023_transactions_expires_at.sql` adds a nullable `expires_at`, backfills only unpaid `qkit` rows at 30 minutes after creation, and changes no status.

## Parent

See the repo root [README.md](../../README.md) for the full layout.
