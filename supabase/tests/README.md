# tests

## Purpose

The pgTAP suite that proves paykit's Postgres-enforced authorization
actually holds. Because authorization lives in RLS policies and grants
rather than in application code (see `AGENTS.md`), this suite — not the
Vitest suite — is the authoritative check on it: a mocked unit test can only
assert what the app _asks_ the database for, never what the database
_permits_.

## Contents

- `rls.test.sql` — one rolled-back transaction with inline fixed-UUID
  fixtures (Vendor A: free plan, UEN PayNow config; Vendor B: pro plan,
  mobile PayNow config). Asserts, per role:
  - **RLS is enabled** on every protected table (`vendor_payment_config`,
    `transactions`, `refunds`, `kit_api_keys`, `feedback`, `vendor_prefs`,
    `bookings`).
  - **`admin_audit` is append-only** (migration `0009`) — `service_role`
    can still `SELECT`/`INSERT` (the app's only write path, via
    `recordAudit()`) but a direct `UPDATE`/`DELETE` raises `42501`, checked
    independently of RLS (which never binds `service_role`).
  - **Cross-vendor isolation** — A reads/writes only its own
    `vendor_payment_config`/`transactions`; B's rows (including refunds)
    are invisible.
  - **Pro-gated refunds** — B (pro) can insert a refund against its own
    `confirmed` transaction; A (free) cannot, and neither vendor can read
    or write the other's.
  - **`anon` is locked out** of everything except the cross-kit checkout
    API's own service-role path — no direct table access.
  - **`payment_audit` is append-only** (migrations `0011` and `0019`),
    same treatment as `admin_audit`; A/B each read only their own
    transaction's rows.
  - **`check_rate_limit` is service-role-only** (migration `0019`, correcting the inherited PUBLIC privilege from `0012`) —
    `EXECUTE` is granted to `service_role`, not `authenticated`/`anon`.
  - **Booking ownership** — A reads/inserts/cancels only its own
    `bookings` row (an update targeting B's booking id affects 0 rows);
    inserting one for B's `vendor_id` throws. `deposit_transaction_id`/
    `balance_transaction_id` are excluded from the vendor's own `UPDATE`
    grant (`0010_paykit_bookings.sql`) — A repointing its own booking's
    `deposit_transaction_id` at B's transaction gets a `permission denied`
    error, not a silent no-op, since that FK is what
    `sync_booking_status()` trusts.
  - **`legal_check_state` is service-role-only** (migration `0015`) — RLS
    enabled, zero policies; both `authenticated` (vendor A) and `anon`
    are denied direct `SELECT`, matching `kit_api_keys`'s treatment.

  Keep `select plan(N)` in step with the number of assertions; pgTAP fails
  the run on a count mismatch.

- `db-hygiene.test.sql` — the `0026` foreign key indexes, RLS on every table, admin-only `admins` reads, public `pricing` reads and no client access to `auth_failures`.

## Connectivity

Run with `supabase test db` (Supabase CLI, Docker required), which applies
`../migrations/` to a fresh local database first — so a malformed migration
fails here too. CI runs it as the `db` job in `.github/workflows/ci.yml`.
The fixtures are inline and self-contained — no seed file, no API keys, no
running Next.js app needed.

## Parent

See the repo root [README.md](../../README.md) for the full layout.

`refund-integrity.test.sql` covers cumulative refund caps, atomic multirow rejection, vendor authorization, integer overflow, and service corrections. `isolation/refund-concurrency.spec` is a PostgreSQL isolationtester specification for concurrent READ COMMITTED and REPEATABLE READ inserts; it is not run by `supabase test db` and has not yet been executed. The parent checkout write deliberately forces a serialization failure for conflicting repeatable-read snapshots. See [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html) and [trigger visibility](https://www.postgresql.org/docs/current/trigger-datachanges.html).

Focused pgTAP suites: `deposit-recovery.test.sql` validates atomic deposit linking, `balance-link.test.sql` validates balance ownership and payment identity, `checkout-snapshot.test.sql` protects stored payment destinations, and `private-rate-limiter.test.sql` checks service-only bounded counters and append-only audit privileges. Prepared security migrations and SQL fixtures require local database execution before claiming runtime validation.

`payment-evidence.test.sql` covers migration `0022`: a vendor reads only their own `payment_evidence` rows and only their own objects in `paykit-payment-proofs`, cannot find another vendor's row by its hash, and cannot write, edit or delete evidence; anon has no access; the service role inserts and replaces but cannot delete; and the bucket is private with its size and type limits.

`booking-inquiries.test.sql` covers migration `0025`: RLS on `inquiry_forms` and `inquiries`; a form gets a random 16-hex public id the vendor cannot choose; a terms snapshot needs url, version and time together; a vendor reads only their own inquiries and form, cannot insert an inquiry or set `booking_id`, can change status, cannot delete or create another vendor's rows; anon has no access.
